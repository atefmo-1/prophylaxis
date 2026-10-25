"""Sample chess.com games for the rating-from-one-game study.

Public API only, one request at a time, with the research User-Agent, backing off on 429. Every response is cached
under ml/data/rating/cache so a stopped run resumes without asking again. Raw games and usernames stay under
ml/data/rating (git ignores ml/data); nothing this writes is meant to be committed.

    uv run --frozen python -m rating.collect sample   # one game per player, stratified by rating band
    uv run --frozen python -m rating.collect multi    # ~20 recent games each for a subset of those players
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import random
import time
from pathlib import Path

import chess.pgn
import httpx

DATA = Path(__file__).resolve().parent.parent / "data" / "rating"
CACHE = DATA / "cache"
UA = "prophylaxis-research (github.com/atefmo-1/prophylaxis)"
COUNTRIES = ["US", "IN", "GB", "PH", "BR", "DE", "FR", "ES", "TR", "EG", "ID", "NG"]
TITLES = ["NM", "CM", "FM", "WFM", "WCM", "IM"]
BANDS = [0, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200]  # lower edges; the last band is open
CAP = {0: 70, 400: 70, 600: 70, 800: 70, 1000: 70, 1200: 70, 1400: 70, 1600: 60, 1800: 50, 2000: 50, 2200: 60}
MIN_PLIES = 40  # at least 20 moves each


def band(rating: int) -> int:
    return max(b for b in BANDS if rating >= b)


class Api:
    def __init__(self) -> None:
        self.client = httpx.Client(headers={"User-Agent": UA}, timeout=30, follow_redirects=True)
        self.requests = 0
        CACHE.mkdir(parents=True, exist_ok=True)

    def get(self, url: str) -> dict | None:
        """One request at a time; cached; None for 404/410 (closed accounts, missing archives)."""
        path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")
        if path.exists():
            body = json.loads(path.read_text())
            return None if body.get("_missing") else body
        wait = 2.0
        for _ in range(8):
            try:
                r = self.client.get(url)
            except httpx.HTTPError:
                time.sleep(wait)
                wait *= 2
                continue
            self.requests += 1
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(float(r.headers.get("Retry-After", wait)))
                wait *= 2
                continue
            if r.status_code in (404, 410, 403):
                path.write_text(json.dumps({"_missing": True}))
                return None
            r.raise_for_status()
            path.write_text(r.text)
            return r.json()
        raise RuntimeError(f"gave up on {url}")


def plies(pgn: str) -> int:
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None or game.headers.get("SetUp") == "1":
        return 0
    return sum(1 for _ in game.mainline_moves())


def qualifies(g: dict) -> bool:
    return (
        g.get("rules") == "chess"
        and g.get("rated")
        and g.get("time_class") in ("rapid", "blitz")
        and "pgn" in g
        and plies(g["pgn"]) >= MIN_PLIES
    )


def latest_games(api: Api, user: str, months: int) -> list[dict]:
    """Qualifying games from the newest `months` monthly archives, newest first."""
    arch = api.get(f"https://api.chess.com/pub/player/{user}/games/archives")
    out: list[dict] = []
    for month in reversed((arch or {}).get("archives", [])[-months:]):
        body = api.get(month) or {}
        out += sorted((g for g in body.get("games", []) if qualifies(g)), key=lambda g: -g["end_time"])
    return out


def current_rating(stats: dict | None) -> int | None:
    """The player's latest rapid or blitz rating, whichever was played last."""
    best = None
    for key in ("chess_rapid", "chess_blitz"):
        last = (stats or {}).get(key, {}).get("last")
        if last and (best is None or last["date"] > best["date"]):
            best = last
    return best["rating"] if best else None


def sample(args: argparse.Namespace) -> None:
    api = Api()
    rng = random.Random(args.seed)
    pools = {}
    for c in COUNTRIES:
        players = (api.get(f"https://api.chess.com/pub/country/{c}/players") or {}).get("players", [])
        rng.shuffle(players)
        pools[c] = players
    # Interleave countries so each contributes about equally, whatever its list size.
    order = [(c, pools[c][i]) for i in range(max(map(len, pools.values()))) for c in COUNTRIES if i < len(pools[c])]
    out = DATA / "games.jsonl"
    natural: dict[int, int] = {b: 0 for b in BANDS}  # band of every random player with a rapid/blitz rating
    taken: dict[int, int] = {b: 0 for b in BANDS}
    seen: set[str] = set()
    rows = []
    sink = out.open("w")
    t0 = time.time()
    tried = 0
    for country, user in order:
        if tried >= args.max_players or time.time() - t0 > args.max_minutes * 60:
            break
        if all(taken[b] >= CAP[b] for b in BANDS if b < 1600):
            break
        tried += 1
        r = current_rating(api.get(f"https://api.chess.com/pub/player/{user}/stats"))
        if r is None:
            continue
        natural[band(r)] += 1
        if taken[band(r)] >= CAP[band(r)]:
            continue
        games = latest_games(api, user, 2)
        if not games:
            continue
        g = rng.choice(games)
        me = "white" if g["white"]["username"].lower() == user.lower() else "black"
        b = band(g[me]["rating"])
        if taken[b] >= CAP[b] or g["url"] in seen:
            continue
        taken[b] += 1
        seen.add(g["url"])
        rows.append({**g, "_sampled": user, "_side": me, "_source": f"country:{country}", "_band": b})
        sink.write(json.dumps(rows[-1]) + "\n")
        sink.flush()
        if tried % 50 == 0:
            print(f"{tried} players tried, {len(rows)} games, {api.requests} requests, {time.time() - t0:.0f} s", taken)
    # Top bands are rare in a random draw: fill them from titled players (a convenience sample, labelled as such).
    for title in TITLES:
        players = (api.get(f"https://api.chess.com/pub/titled/{title}") or {}).get("players", [])
        rng.shuffle(players)
        for user in players[: args.titled_per]:
            if all(taken[b] >= CAP[b] for b in (2000, 2200)):
                break
            if user in seen:
                continue
            games = latest_games(api, user, 1)
            if not games:
                continue
            g = rng.choice(games)
            me = "white" if g["white"]["username"].lower() == user.lower() else "black"
            b = band(g[me]["rating"])
            if b < 1800 or taken[b] >= CAP[b] or g["url"] in seen:
                continue
            taken[b] += 1
            seen.add(g["url"])
            rows.append({**g, "_sampled": user, "_side": me, "_source": f"titled:{title}", "_band": b})
            sink.write(json.dumps(rows[-1]) + "\n")
            sink.flush()
    sink.close()
    meta = {"players_tried": tried, "requests": api.requests, "natural_bands": natural, "taken": taken, "games": len(rows)}
    (DATA / "sample_meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))


def multi(args: argparse.Namespace) -> None:
    """~20 recent games for a subset of sampled players, spread across rating bands."""
    api = Api()
    rng = random.Random(args.seed + 1)
    rows = [json.loads(line) for line in (DATA / "games.jsonl").open()]
    by_band: dict[int, list[dict]] = {}
    for r in rows:
        by_band.setdefault(r["_band"], []).append(r)
    for cands in by_band.values():
        rng.shuffle(cands)
    out = DATA / "multi.jsonl"
    n = 0
    with out.open("w") as f:
        # Round-robin over bands, so a cap on players still spreads them across ratings.
        for _ in range(args.per_band):
            for b in BANDS:
                cands = by_band.get(b, [])
                for _try in range(6):
                    if not cands or n >= args.players:
                        break
                    user = cands.pop()["_sampled"]
                    games = latest_games(api, user, 4)[: args.games]
                    if len(games) < args.games:
                        continue
                    n += 1
                    for g in games:
                        me = "white" if g["white"]["username"].lower() == user.lower() else "black"
                        f.write(json.dumps({**g, "_sampled": user, "_side": me, "_band": b}) + "\n")
                    f.flush()
                    print(f"{n} players, {api.requests} requests")
                    break


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sample")
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--max-players", type=int, default=4000)
    s.add_argument("--max-minutes", type=float, default=40)
    s.add_argument("--titled-per", type=int, default=60)
    m = sub.add_parser("multi")
    m.add_argument("--seed", type=int, default=7)
    m.add_argument("--per-band", type=int, default=3)
    m.add_argument("--players", type=int, default=26)
    m.add_argument("--games", type=int, default=20)
    a = p.parse_args()
    {"sample": sample, "multi": multi}[a.cmd](a)


if __name__ == "__main__":
    main()
