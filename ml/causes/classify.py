"""Why do beginners' mistakes go unexplained? A census of causes, from the engine's own lines.

The site explains a mistake when a rule names it: a hanging piece, a fork, a mate, a missed free piece, and (with the
tactic model) a few more tactics. Many mistakes get no reason at all. This runs real beginner games through Stockfish,
tags every mistake with the site's rules (src/coach/motifs.py), and then checks each one against candidate causes that
are facts in the engine's lines, not judgements:

- threat: before the move, the opponent already had a threat (a null-move search: if the player could pass, would the
  opponent win material or mate?), and the move didn't deal with it.
- mate_attack: the reply line mates, but in more moves than the site names (over 3).
- slow_material: material is lost later in the line than the site looks (plies 10 to 20).
- pawn: a single pawn lost or missed, under the site's 2-pawn bar.
- promotion: the opponent's line promotes a pawn, or the best line would have.
- king: the reply line checks the player's king at least twice in its first six moves.
- slip: the player was clearly winning (70%+) and the move let much of it go, without losing material.
- endgame: six or fewer pieces besides kings and pawns.

    python -m causes.classify            # from ml/, with the ml virtualenv

Writes results/causes.json and results/causes.md (counts only). The chess.com games come from ml/rating's sample of
random public games (data/rating, ignored by git); examples from them stay in data/causes.
"""

import io
import json
import logging
import os
import re
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

import chess
import chess.engine
import chess.pgn
from coach import config, grading, motifs

ML = Path(__file__).resolve().parent.parent
DATA = ML / "data"
RESULTS = ML / "results"
SAMPLE = ML.parent / "web" / "public" / "sample" / "games.json"
CHESSCOM = DATA / "rating" / "games.jsonl"
OUT = DATA / "causes"

NODES = 300_000
MISTAKE = 10.0          # win % lost: the site's mistake bar (mistake 10-20, blunder 20+)
BEGINNER = 1000         # chess.com games where the two players average under this
LONG = 20               # plies of a line to play out for slow material
THREAT_PLIES = 4        # the threat pays off within this many plies of the threatening move
EXTEND = int(os.environ.get("EXTEND", "12"))  # lengthen lines shorter than this many plies (0: as Stockfish gives them)
SPECIFIC = {"hanging_piece", "allowed_fork", "allowed_mate", "back_rank_mate", "allowed_stalemate",
            "missed_free_piece", "missed_fork", "missed_mate"}
GENERIC = {"lost_material", "missed_tactic"}  # the model may name these; the rules can't
CLOCK = re.compile(r"\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]")

_engine: chess.engine.SimpleEngine | None = None


def _start() -> None:
    global _engine
    logging.getLogger("chess.engine").setLevel(logging.ERROR)  # null-move searches warn once per call
    _engine = chess.engine.SimpleEngine.popen_uci(config.stockfish_path())
    _engine.configure({"Threads": 1, "Hash": 32})


def _line(board: chess.Board) -> dict | None:
    """One engine line, white POV, in the shape motifs.detect expects."""
    if board.is_game_over():
        return None
    info = _engine.analyse(board, chess.engine.Limit(nodes=NODES))
    score = info["score"].white()
    pv = info.get("pv", [])
    if EXTEND:
        # Stockfish cuts a line short when the search ends on a hash hit; carry it on from where it stops.
        end = board.copy(stack=False)
        for m in pv:
            end.push(m)
        for _ in range(4):
            if len(pv) >= EXTEND or end.is_game_over():
                break
            more = _engine.analyse(end, chess.engine.Limit(nodes=NODES // 4)).get("pv", [])
            if not more:
                break
            for m in more:
                end.push(m)
            pv = pv + more
    return {"cp": score.score(), "mate": score.mate(), "pv": [m.uci() for m in pv]}


def _win_white(board: chess.Board, line: dict | None) -> float:
    return grading.terminal_win_white(board) if line is None else grading.line_win_white(line)


def _seconds(comment: str) -> float | None:
    m = CLOCK.search(comment or "")
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else None


def _threat(before: chess.Board) -> dict | None:
    """What the opponent could do if the player passed: material they'd win, or a mate."""
    if before.is_check():
        return None
    passed = before.copy(stack=False)
    passed.push(chess.Move.null())
    if not passed.is_valid():
        return None
    line = _line(passed)
    if not line or not line["pv"]:
        return None
    me = before.turn
    mate = motifs._mover_mate(line, not me)
    if mate is not None and 0 < mate <= motifs.MATE_HORIZON:
        return {"kind": "mate", "in": mate, "move": line["pv"][0]}
    # A threat is something they win soon: within THREAT_PLIES of their move, not at the end of a long plan.
    won = motifs.material(motifs.play(passed, line["pv"], THREAT_PLIES), not me) - motifs.material(passed, not me)
    if won >= 1:
        return {"kind": "material", "amount": won, "move": line["pv"][0]}
    return None


def rethreat(row: dict) -> dict:
    """Recompute the threat test for one cached game's mistakes (the engine lines aren't cached, the positions are)."""
    for m in row["mistakes"]:
        m["threat"] = _threat(chess.Board(m["fen"]))
        m["ignored_threat"] = bool(m["threat"] and m["reply"] and m["reply"][0] == m["threat"]["move"])
    return row


def threats_main() -> None:
    for name in ("sample", "chesscom"):
        cache = OUT / f"{name}.jsonl"
        rows = [json.loads(line) for line in cache.open()]
        with Pool(max(1, (os.cpu_count() or 2) - 2), initializer=_start) as pool:
            rows = pool.map(rethreat, rows)
        cache.write_text("".join(json.dumps(r) + "\n" for r in rows))
        print(name, "threats redone", flush=True)


def _causes(before: chess.Board, move: chess.Move, best: dict | None, reply: dict | None, win_before: float,
            win_after: float, tags: set[str]) -> list[str]:
    me = before.turn
    after = before.copy(stack=False)
    after.push(move)
    best_pv = best["pv"] if best else []
    reply_pv = reply["pv"] if reply else []
    start = motifs.material(before, me)
    found = []
    mate_against = motifs._mover_mate(reply, me)
    if mate_against is not None and mate_against < -motifs.MATE_HORIZON:
        found.append("mate_attack")
    best_mate = motifs._mover_mate(best, me)
    if best_mate is not None and best_mate > motifs.MATE_HORIZON:
        found.append("missed_long_mate")
    played_long = motifs.material(motifs.play(after, reply_pv, LONG - 1), me) - start
    best_long = motifs.material(motifs.play(before, best_pv, LONG), me) - start
    played_short = motifs.material(motifs.play(after, reply_pv, motifs.HORIZON - 1), me) - start
    best_short = motifs.material(motifs.play(before, best_pv), me) - start
    # Lost later than the site looks: under 2 down at its horizon, 2+ down (and 2+ worse than best) by ply 20.
    if played_short > -2 and played_long <= -2 and best_long - played_long >= 2:
        found.append("slow_material")
    elif best_short - played_short == 1:
        found.append("pawn")

    def promotes(board: chess.Board, pv: list[str], side: chess.Color, plies: int = 12) -> bool:
        b = board.copy(stack=False)
        for uci in pv[:plies]:
            m = chess.Move.from_uci(uci)
            if m not in b.legal_moves:
                return False
            if m.promotion and b.turn == side:
                return True
            b.push(m)
        return False

    if promotes(after, reply_pv, not me) or promotes(before, best_pv, me):
        found.append("promotion")
    checks = 0
    b = after.copy(stack=False)
    for uci in reply_pv[:6]:
        m = chess.Move.from_uci(uci)
        if m not in b.legal_moves:
            break
        if b.turn != me and b.gives_check(m):
            checks += 1
        b.push(m)
    if checks >= 2:
        found.append("king")
    if win_before >= 70 and played_short > -2:
        found.append("slip")
    return found


def review(game: dict) -> list[dict]:
    """Every mistake in one game (both sides, or the sample player's side), with tags and candidate causes."""
    pgn = chess.pgn.read_game(io.StringIO(game["pgn"]))
    sides = [chess.WHITE, chess.BLACK]
    if game.get("only"):
        sides = [chess.WHITE if game["only"] == "white" else chess.BLACK]
    inc = int(game.get("time_control", "0").split("+")[1]) if "+" in game.get("time_control", "") else 0
    boards, moves, clocks = [pgn.board()], [], []
    for node in pgn.mainline():
        moves.append(node.move)
        clocks.append(_seconds(node.comment))
        b = boards[-1].copy(stack=False)
        b.push(node.move)
        boards.append(b)
    lines = [_line(b) for b in boards]
    out = []
    for ply, move in enumerate(moves):
        before, after = boards[ply], boards[ply + 1]
        me = before.turn
        if me not in sides:
            continue
        win_before = grading.pov(_win_white(before, lines[ply]), me)
        win_after = grading.pov(_win_white(after, lines[ply + 1]), me)
        loss = win_before - win_after
        if loss < MISTAKE:
            continue
        clock_before = clocks[ply - 2] if ply >= 2 else None
        spent = (clock_before - clocks[ply] + inc) if clock_before is not None and clocks[ply] is not None else None
        best = lines[ply]
        reply = lines[ply + 1]
        tags = {t for t, _ in motifs.detect(before, move, [best] if best else [], [reply] if reply else None, loss,
                                            clock_before, spent)}
        threat = _threat(before)
        # The threat still stood after the move if the opponent's best reply is the threatened move.
        ignored = bool(threat and reply and reply["pv"] and reply["pv"][0] == threat["move"])
        out.append({
            "game": game["url"].rsplit("/", 1)[-1], "ply": ply + 1, "fen": before.fen(), "move": move.uci(),
            "san": before.san(move), "loss": round(loss, 1), "win_before": round(win_before, 1),
            "phase": grading.phase(before, ply + 1), "tags": sorted(tags),
            "threat": threat, "ignored_threat": ignored,
            "causes": _causes(before, move, best, reply, win_before, win_after, tags),
            "best": best["pv"][:12] if best else [], "reply": reply["pv"][:12] if reply else [],
            "rating": game.get("rating"),
        })
    return out


def _games() -> dict[str, list[dict]]:
    sample = json.loads(SAMPLE.read_text())["games"]
    for g in sample:
        g["only"] = "white" if g["white"]["username"] == "sample-player" else "black"
    beginners = []
    for line in CHESSCOM.open():
        g = json.loads(line)
        try:
            avg = (g["white"]["rating"] + g["black"]["rating"]) / 2
        except (KeyError, TypeError):
            continue
        if avg < BEGINNER:
            g["rating"] = avg
            beginners.append(g)
    return {"sample": sample, "chesscom": beginners}


def bucket(m: dict) -> str:
    tags = set(m["tags"])
    if tags & SPECIFIC:
        return "named"
    if tags & GENERIC:
        return "generic"
    return "none"


CAUSE_ORDER = ["mate_attack", "missed_long_mate", "slow_material", "promotion", "king", "pawn", "slip", "endgame"]


def primary(m: dict) -> str:
    """The first cause that applies, in the order a coach would mention it; 'threat' first when it was ignored."""
    if m["ignored_threat"]:
        return "threat"
    causes = set(m["causes"]) | ({"endgame"} if m["phase"] == "endgame" else set())
    return next((c for c in CAUSE_ORDER if c in causes), "unknown")


def summarise(found: list[dict]) -> dict:
    n = len(found)
    buckets = Counter(bucket(m) for m in found)
    none = [m for m in found if bucket(m) == "none"]
    return {
        "mistakes": n,
        "buckets": dict(buckets),
        "ignored_threat_all": sum(m["ignored_threat"] for m in found),
        "rushed_all": sum("rushed" in m["tags"] for m in found),
        "time_pressure_all": sum("time_pressure" in m["tags"] for m in found),
        "unexplained": {
            "n": len(none),
            "primary": dict(Counter(primary(m) for m in none).most_common()),
            "any": dict(Counter(c for m in none for c in set(m["causes"]) | ({"threat"} if m["ignored_threat"] else set())
                                | ({"endgame"} if m["phase"] == "endgame" else set())).most_common()),
            "phase": dict(Counter(m["phase"] for m in none)),
            "blunders": sum(m["loss"] >= 20 for m in none),
        },
    }


def main() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    result = {"nodes": NODES, "mistake_bar": MISTAKE}
    for name, games in _games().items():
        cache = OUT / f"{name}.jsonl"
        done = {}
        if cache.exists():
            for line in cache.open():
                row = json.loads(line)
                done[row["url"]] = row["mistakes"]
        todo = [g for g in games if g["url"] not in done]
        print(f"{name}: {len(games)} games, {len(todo)} to review", flush=True)
        with cache.open("a") as f, Pool(max(1, (os.cpu_count() or 2) - 2), initializer=_start) as pool:
            for i, (g, found) in enumerate(zip(todo, pool.imap(review, todo)), 1):
                done[g["url"]] = found
                f.write(json.dumps({"url": g["url"], "mistakes": found}) + "\n")
                f.flush()
                if i % 20 == 0:
                    print(f"  {i} / {len(todo)}", flush=True)
        found = [m for g in games for m in done[g["url"]]]
        result[name] = {"games": len(games), **summarise(found)}
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "causes.json").write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    import sys

    threats_main() if sys.argv[1:] == ["threats"] else main()
