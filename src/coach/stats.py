"""Turn graded games into the numbers the dashboard shows.

With a few dozen games, raw percentages are noisy, so every rate comes with a 90%
Jeffreys interval: "35% (27–44%)" rather than a falsely exact "35%".
"""

import itertools
import json
import sqlite3
import statistics
import time
from collections import Counter, defaultdict

import chess
from scipy.stats import beta

from . import config, db, engine, grading

MISTAKES = ("mistake", "miss", "blunder")

TAG_INFO = {
    "hanging_piece": {
        "kind": "allowed",
        "title": "Leaving pieces hanging",
        "what": "After your move, a piece could be taken for free or by a cheaper piece.",
        "fix": "Before you move, check every piece of yours: is it attacked, and is it defended?",
    },
    "allowed_fork": {
        "kind": "allowed",
        "title": "Walking into forks",
        "what": "Your move let one enemy piece attack two of yours at once.",
        "fix": "Look for squares where an enemy knight or pawn could hit two of your pieces.",
    },
    "allowed_mate": {
        "kind": "allowed",
        "title": "Missing checkmate threats",
        "what": "Your move allowed a forced checkmate.",
        "fix": "Before every move, list your opponent's checks. Can any of them lead to mate?",
    },
    "back_rank_mate": {
        "kind": "allowed",
        "title": "Back-rank weakness",
        "what": "You allowed mate on your back rank, with your king boxed in by its own pawns.",
        "fix": "After castling, push one pawn in front of your king to give it an escape square.",
    },
    "lost_material": {
        "kind": "allowed",
        "title": "Losing material to threats",
        "what": "Your move let your opponent win material with a short sequence of moves.",
        "fix": "Look one move deeper: after your opponent's best reply, is anything of yours under attack?",
    },
    "allowed_stalemate": {
        "kind": "allowed",
        "title": "Stalemating won games",
        "what": "You were winning and left your opponent with no legal moves, which is a draw.",
        "fix": "When far ahead, make sure the enemy king always has a move unless you are giving mate.",
    },
    "missed_free_piece": {
        "kind": "missed",
        "title": "Missing free pieces",
        "what": "You could win a piece for free, or with a cheaper piece, and played something else.",
        "fix": "Start every move by asking: what can I capture, and is it defended?",
    },
    "missed_fork": {
        "kind": "missed",
        "title": "Missing forks",
        "what": "You had a move that attacked two pieces at once and won material.",
        "fix": "Look for checks and for moves that attack two things at the same time.",
    },
    "missed_mate": {
        "kind": "missed",
        "title": "Missing checkmates",
        "what": "You had a forced checkmate and played something else.",
        "fix": "Look at every check you have before considering any other move.",
    },
    "missed_tactic": {
        "kind": "missed",
        "title": "Missing winning tactics",
        "what": "You had a check or capture that started a sequence winning material.",
        "fix": "When enemy pieces are loose or lined up, look for forcing moves: checks, captures, threats.",
    },
    # Named only by the tactic classifier on the site (web/src/analysis/tactics.ts, ml/REPORT.md).
    "allowed_discovered_attack": {
        "kind": "allowed",
        "title": "Walking into discovered attacks",
        "what": "Your move let your opponent move one piece out of the way and attack with the piece behind it.",
        "fix": "Watch enemy queens, rooks and bishops that sit behind their own pieces and point at yours.",
    },
    "allowed_pin": {
        "kind": "allowed",
        "title": "Walking into pins",
        "what": "Your move let your opponent pin one of your pieces to a more valuable one behind it.",
        "fix": "Don't line up your king or queen behind another piece on a line an enemy bishop, rook or queen can reach.",
    },
    "allowed_skewer": {
        "kind": "allowed",
        "title": "Walking into skewers",
        "what": "Your move let a long-range piece attack a valuable piece of yours and win the one behind it.",
        "fix": "Keep your king and queen off lines shared with your other pieces when enemy rooks, bishops or queens are near.",
    },
    "trapped_piece": {
        "kind": "allowed",
        "title": "Getting pieces trapped",
        "what": "Your move left one of your pieces with no safe square, so it could be attacked and won.",
        "fix": "Before sending a piece deep into enemy territory, check that it has a safe way back.",
    },
    "missed_discovered_attack": {
        "kind": "missed",
        "title": "Missing discovered attacks",
        "what": "You could move one piece out of the way with a threat and attack with the piece behind it.",
        "fix": "Look at your queen, rooks and bishops: which of your own pieces block them, and what if that piece moved with a threat?",
    },
    "missed_pin": {
        "kind": "missed",
        "title": "Missing pins",
        "what": "You had a move that pinned an enemy piece to a more valuable one and won material.",
        "fix": "Look for enemy pieces lined up with their king or queen on a line your bishop, rook or queen can reach.",
    },
    "missed_skewer": {
        "kind": "missed",
        "title": "Missing skewers",
        "what": "You could attack a valuable enemy piece and win the one behind it once it moved.",
        "fix": "When the enemy king or queen shares a line with another piece, look for a check or attack along that line.",
    },
    "missed_trapped_piece": {
        "kind": "missed",
        "title": "Missing trapped pieces",
        "what": "An enemy piece had no safe square, and you could have attacked it and won it.",
        "fix": "When an enemy piece is far from home, count its escape squares: can you take them all away?",
    },
    "time_pressure": {
        "kind": "clock",
        "title": "Blundering under time pressure",
        "what": "A mistake or blunder played with less than a minute on your clock.",
        "fix": "Spend less time on routine moves early so you have time left for hard positions.",
    },
    "rushed": {
        "kind": "clock",
        "title": "Moving too fast",
        "what": "A mistake or blunder played in under 3 seconds while you still had time.",
        "fix": "Take five seconds before each move to ask what your opponent's last move threatens.",
    },
}

ENDINGS = {
    ("win", "checkmated"): "Won by checkmate",
    ("win", "resigned"): "Won by resignation",
    ("win", "timeout"): "Won on time",
    ("win", "abandoned"): "Won, opponent left",
    ("loss", "checkmated"): "Lost by checkmate",
    ("loss", "resigned"): "Lost by resignation",
    ("loss", "timeout"): "Lost on time",
    ("loss", "abandoned"): "Left the game",
    ("draw", "stalemate"): "Draw by stalemate",
    ("draw", "repetition"): "Draw by repetition",
    ("draw", "agreed"): "Draw agreed",
    ("draw", "insufficient"): "Draw, insufficient material",
    ("draw", "timevsinsufficient"): "Draw, time out vs. insufficient material",
    ("draw", "50move"): "Draw, 50-move rule",
}


def interval(k: int, n: int, level: float = 0.9) -> dict | None:
    """Jeffreys interval for k successes out of n."""
    if n == 0:
        return None
    tail = (1 - level) / 2
    lo = 0.0 if k == 0 else float(beta.ppf(tail, k + 0.5, n - k + 0.5))
    hi = 1.0 if k == n else float(beta.ppf(1 - tail, k + 0.5, n - k + 0.5))
    return {"k": k, "n": n, "rate": k / n, "lo": lo, "hi": hi}


def ending(game: sqlite3.Row | dict) -> str:
    code = game["opp_code"] if game["result"] == "win" else game["my_code"]
    return ENDINGS.get((game["result"], code), game["result"].capitalize())


def _record(games: list) -> dict:
    counts = Counter(g["result"] for g in games)
    n = len(games)
    return {
        "games": n,
        "win": counts["win"],
        "loss": counts["loss"],
        "draw": counts["draw"],
        "score": (counts["win"] + 0.5 * counts["draw"]) / n if n else None,
    }


def _mean(values) -> float | None:
    values = [v for v in values if v is not None]
    return statistics.fmean(values) if values else None


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3:
        return None
    try:
        return statistics.correlation(xs, ys)
    except statistics.StatisticsError:
        return None


def _example(move: sqlite3.Row, game: sqlite3.Row, detail: dict | None = None) -> dict:
    return {
        "game_id": game["id"],
        "ply": move["ply"],
        "move_number": (move["ply"] + 1) // 2,
        "fen": move["fen_before"],
        "played": move["san"],
        "played_uci": move["uci"],
        "best": move["best_san"],
        "best_uci": move["best_uci"],
        "win_loss": round(move["win_loss"], 1),
        "opponent": game["opp_name"],
        "date": game["start_time"],
        "color": game["my_color"],
        "detail": detail or {},
    }


RECENT_GAMES = 20


def _trend(items: list, played: list, my_moves: dict[str, int]) -> dict | None:
    """How often a habit shows up per move in your last 20 played games, against the games before them.

    Per move rather than per game, so a run of longer games doesn't look like a habit getting worse.
    """
    if len(played) < RECENT_GAMES * 2:
        return None
    recent_ids = {g["id"] for g in played[-RECENT_GAMES:]}
    recent_moves = sum(my_moves[g] for g in recent_ids)
    before_moves = sum(my_moves[g["id"]] for g in played) - recent_moves
    if recent_moves == 0 or before_moves == 0:
        return None
    recent = sum(1 for m, _ in items if m["game_id"] in recent_ids)
    recent_rate = recent / recent_moves * 100
    before_rate = (len(items) - recent) / before_moves * 100
    change = (recent_rate - before_rate) / max(before_rate, 0.5)
    direction = "rising" if change >= 0.3 else "falling" if change <= -0.3 else "steady"
    return {"recent": recent_rate, "before": before_rate, "games": RECENT_GAMES, "direction": direction}


SKILL_RECENT = 20
SAFETY_TAGS = {
    "hanging_piece", "allowed_fork", "lost_material", "allowed_mate",
    "allowed_discovered_attack", "allowed_pin", "allowed_skewer", "trapped_piece",
}
MISSED_TAGS = {
    "missed_free_piece", "missed_fork", "missed_mate", "missed_tactic",
    "missed_discovered_attack", "missed_pin", "missed_skewer", "missed_trapped_piece",
}


def _skills(played: list, moves_by_game: dict, tags_by_name: dict, games: list) -> list[dict]:
    """Six skill areas as plain measurements, each for your last 20 games and the games before them."""
    tagged_games = defaultdict(set)
    tag_counts = defaultdict(Counter)
    for tag, items in tags_by_name.items():
        for m, _ in items:
            tagged_games[tag].add(m["game_id"])
            tag_counts[m["game_id"]][tag] += 1

    def measure(group: list) -> dict[str, float | None]:
        ids = [g["id"] for g in group]
        mine = [m for gid in ids for m in moves_by_game[gid] if m["is_mine"]]
        opening = [m["accuracy"] for m in mine if m["phase"] == "opening"]
        endgame = [m["accuracy"] for m in mine if m["phase"] == "endgame"]
        winning = [
            g for g in group
            if max((m["win_white"] if g["my_color"] == "white" else 100 - m["win_white"]) for m in moves_by_game[g["id"]]) >= 85
        ]
        n = len(ids) or 1
        return {
            "opening": _mean(opening),
            "safety": 100 * sum(any(gid in tagged_games[t] for t in SAFETY_TAGS) for gid in ids) / n,
            "tactics": sum(tag_counts[gid][t] for gid in ids for t in MISSED_TAGS) / n,
            "endgame": _mean(endgame) if len(endgame) >= 20 else None,
            "converting": 100 * sum(g["result"] == "win" for g in winning) / len(winning) if winning else None,
            "time": 100 * sum(g["result"] == "loss" and g["my_code"] == "timeout" for g in group) / n,
        }

    recent = measure(played[-SKILL_RECENT:])
    before = measure(played[:-SKILL_RECENT]) if len(played) > SKILL_RECENT else {}
    meta = [
        ("opening", "Opening", "How accurate are your first ten moves?", "accuracy", "higher"),
        ("safety", "Piece safety", "How often do you lose material to a simple tactic?", "% of games", "lower"),
        ("tactics", "Spotting tactics", "How many winning chances do you miss?", "missed per game", "lower"),
        ("endgame", "Endgames", "How accurate are you once most pieces are gone?", "accuracy", "higher"),
        ("converting", "Converting wins", "When you get a winning position, do you win?", "% converted", "higher"),
        ("time", "Clock", "How often do you lose on time?", "% of games", "lower"),
    ]
    return [
        {"key": key, "title": title, "question": q, "unit": unit, "better": better,
         "recent": recent.get(key), "before": before.get(key), "games": min(SKILL_RECENT, len(played))}
        for key, title, q, unit, better in meta
    ]


def overview(conn: sqlite3.Connection) -> dict:
    games = conn.execute(
        "SELECT * FROM games WHERE analysis_version IS NOT NULL ORDER BY start_time"
    ).fetchall()
    by_id = {g["id"]: g for g in games}
    moves = conn.execute(
        "SELECT m.* FROM moves m JOIN games g ON g.id = m.game_id WHERE g.analysis_version IS NOT NULL ORDER BY m.game_id, m.ply"
    ).fetchall()
    tags = conn.execute("SELECT * FROM move_tags").fetchall()
    n_games = len(games)
    if n_games == 0:
        return {"empty": True}

    mine = [m for m in moves if m["is_mine"]]
    theirs = [m for m in moves if not m["is_mine"]]
    moves_by_game = defaultdict(list)
    for m in moves:
        moves_by_game[m["game_id"]].append(m)
    # Games that ended before a move count in the record, but never in per-game move statistics.
    played = [g for g in games if moves_by_game[g["id"]]]
    n_played = len(played)
    my_moves = {g["id"]: sum(m["is_mine"] for m in moves_by_game[g["id"]]) for g in played}
    played_ids = [g["id"] for g in played]

    # Rating and accuracy over time
    series = []
    for i, g in enumerate(games):
        window = [x["my_accuracy"] for x in games[max(0, i - 9) : i + 1] if x["my_accuracy"] is not None]
        series.append({
            "game_id": g["id"],
            "t": g["start_time"],
            "time_class": g["time_class"],
            "rating": g["my_rating"],
            "opp_rating": g["opp_rating"],
            "result": g["result"],
            "accuracy": g["my_accuracy"],
            "accuracy_avg10": statistics.fmean(window) if window else None,
        })

    # Move quality
    quality = Counter(m["move_class"] for m in mine)
    opp_quality = Counter(m["move_class"] for m in theirs)
    move_quality = [
        {
            "class": c,
            "mine": quality[c],
            "mine_per_game": quality[c] / n_played,
            "theirs": opp_quality[c],
            "theirs_per_game": opp_quality[c] / n_played,
        }
        for c in grading.CLASSES
    ]

    # Phases
    phases = []
    for phase in ("opening", "middlegame", "endgame"):
        pm = [m for m in mine if m["phase"] == phase]
        bad = sum(m["move_class"] in MISTAKES for m in pm)
        phases.append({
            "phase": phase,
            "moves": len(pm),
            "games": len({m["game_id"] for m in pm}),
            "accuracy": _mean(m["accuracy"] for m in pm),
            "mistakes": bad,
            "mistake_rate": interval(bad, len(pm)),
        })

    first_bad = []
    for game_moves in moves_by_game.values():
        ply = next((m["ply"] for m in game_moves if m["is_mine"] and m["move_class"] in MISTAKES), None)
        if ply is not None:
            first_bad.append((ply + 1) // 2)

    # Colors and openings
    colors = []
    for color in ("white", "black"):
        cg = [g for g in games if g["my_color"] == color]
        colors.append({"color": color, **_record(cg), "accuracy": _mean(g["my_accuracy"] for g in cg)})

    families = defaultdict(list)
    for g in games:
        families[(g["opening_family"], g["my_color"])].append(g)
    openings = sorted(
        (
            {
                "family": family,
                "color": color,
                **_record(fg),
                "accuracy": _mean(g["my_accuracy"] for g in fg),
            }
            for (family, color), fg in families.items()
        ),
        key=lambda o: (-o["games"], o["family"]),
    )

    # Clock
    timed = [m for m in mine if m["clock_before"] is not None]
    clock_buckets = []
    for label, lo, hi in (("Over 5 min", 300, None), ("2–5 min", 120, 300), ("1–2 min", 60, 120), ("Under 1 min", 0, 60)):
        bm = [m for m in timed if m["clock_before"] >= lo and (hi is None or m["clock_before"] < hi)]
        clock_buckets.append({"label": label, "moves": len(bm),
                              "mistake_rate": interval(sum(m["move_class"] in MISTAKES for m in bm), len(bm))})
    speed_buckets = []
    spent = [m for m in timed if m["time_spent"] is not None]
    for label, lo, hi in (("Under 3 s", 0, 3), ("3–10 s", 3, 10), ("10–30 s", 10, 30), ("Over 30 s", 30, None)):
        bm = [m for m in spent if m["time_spent"] >= lo and (hi is None or m["time_spent"] < hi)]
        speed_buckets.append({"label": label, "moves": len(bm),
                              "mistake_rate": interval(sum(m["move_class"] in MISTAKES for m in bm), len(bm))})
    clock = {
        "buckets": clock_buckets,
        "speed": speed_buckets,
        "median_time_per_move": statistics.median([m["time_spent"] for m in spent]) if spent else None,
        "lost_on_time": sum(g["result"] == "loss" and g["my_code"] == "timeout" for g in games),
    }

    # How games end
    endings = Counter(ending(g) for g in games)
    terminations = [
        {"label": label, "result": result, "count": endings[label]}
        for (result, _), label in ENDINGS.items()
        if endings[label]
    ]

    # Winning positions converted, losing positions saved
    winning, converted, losing, saved = 0, 0, 0, 0
    my_color_of = {g["id"]: g["my_color"] for g in games}
    for gid, game_moves in moves_by_game.items():
        mine_pov = [m["win_white"] if my_color_of[gid] == "white" else 100 - m["win_white"] for m in game_moves]
        if not mine_pov:
            continue
        result = by_id[gid]["result"]
        if max(mine_pov) >= 85:
            winning += 1
            converted += result == "win"
        if min(mine_pov) <= 15:
            losing += 1
            saved += result != "loss"

    # Tilt: how the next game in the same session goes
    after = {"win": [], "loss": []}
    for prev, g in itertools.pairwise(games):
        if prev["session_id"] == g["session_id"] and prev["result"] in after:
            after[prev["result"]].append(g)
    sessions = {key: {**_record(gs), "accuracy": _mean(g["my_accuracy"] for g in gs)} for key, gs in after.items()}

    # Weaknesses
    tags_by_name = defaultdict(list)
    move_index = {(m["game_id"], m["ply"]): m for m in mine}
    for t in tags:
        move = move_index.get((t["game_id"], t["ply"]))
        if move is not None:
            tags_by_name[t["tag"]].append((move, json.loads(t["detail"] or "{}")))

    weaknesses = []
    for tag, items in tags_by_name.items():
        info = TAG_INFO.get(tag)
        if info is None:
            continue
        games_with = len({m["game_id"] for m, _ in items})
        avg_loss = statistics.fmean(m["win_loss"] for m, _ in items)
        examples = sorted(items, key=lambda x: -x[0]["win_loss"])[:4]
        games_tagged = {m["game_id"] for m, _ in items}
        latest = max(items, key=lambda x: (by_id[x[0]["game_id"]]["start_time"], x[0]["ply"]))
        last, prev = played_ids[-HABIT_WINDOW:], played_ids[-2 * HABIT_WINDOW : -HABIT_WINDOW]
        weaknesses.append({
            "tag": tag,
            **info,
            "windows": {
                # Fewer games than the window: "in 4 of your last 5 games", not "of your last 10".
                "size": min(HABIT_WINDOW, n_played),
                "last": sum(gid in games_tagged for gid in last),
                "prev": sum(gid in games_tagged for gid in prev) if len(prev) == HABIT_WINDOW else None,
            },
            "occurrences": len(items),
            "per_game": len(items) / n_played,
            "games": interval(games_with, n_played),
            "trend": _trend(items, played, my_moves),
            "avg_loss": avg_loss,
            "impact": len(items) / n_played * avg_loss,
            "examples": [_example(m, by_id[m["game_id"]], d) for m, d in examples],
            "latest": _example(latest[0], by_id[latest[0]["game_id"]], latest[1]),
        })
    weaknesses.sort(key=lambda w: -w["impact"])

    skills = _skills(played, moves_by_game, tags_by_name, games)

    great = sorted((m for m in mine if m["move_class"] == "great"), key=lambda m: -m["win_before"])
    great_examples = [_example(m, by_id[m["game_id"]]) for m in great[:4]]

    # Validation against chess.com's own accuracy
    pairs = [(g["my_accuracy"], g["chesscom_accuracy"]) for g in games
             if g["my_accuracy"] is not None and g["chesscom_accuracy"] is not None]

    # Ratings differ by time control, so the one shown is the time control played most (the latest game's on a tie).
    count = Counter(g["time_class"] for g in games)
    last = {g["time_class"]: i for i, g in enumerate(games)}
    rating_class = max(count, key=lambda tc: (count[tc], last[tc]))
    rated = [g for g in games if g["time_class"] == rating_class]

    return {
        "generated_at": int(time.time()),
        "player": {
            "username": config.USERNAME,
            "rating": rated[-1]["my_rating"],
            "peak": max(g["my_rating"] for g in rated),
            "start_rating": rated[0]["my_rating"],
            "rating_time_class": rating_class,
            **_record(games),
            "accuracy": _mean(g["my_accuracy"] for g in games),
            "opp_accuracy": _mean(g["opp_accuracy"] for g in games),
            "first_game": games[0]["start_time"],
            "last_game": games[-1]["start_time"],
            "moves": len(mine),
            "played": n_played,
            "unplayed": n_games - n_played,
            "time_classes": sorted({g["time_class"] for g in games}),
        },
        "series": series,
        "move_quality": move_quality,
        "phases": phases,
        "first_mistake_move": statistics.median(first_bad) if first_bad else None,
        "games_without_mistake": n_played - len(first_bad),
        "colors": colors,
        "openings": openings,
        "clock": clock,
        "terminations": terminations,
        "conversion": {"winning": interval(converted, winning), "losing": interval(saved, losing)},
        "sessions": sessions,
        "weaknesses": weaknesses,
        "skills": skills,
        "great_moves": {"count": len(great), "examples": great_examples},
        "validation": {
            "pairs": [{"ours": a, "chesscom": b} for a, b in pairs],
            "pearson": _pearson([a for a, _ in pairs], [b for _, b in pairs]),
            "mean_abs_diff": _mean(abs(a - b) for a, b in pairs),
        },
        "method": {
            "engine": db.get_meta(conn, "engine_name") or "Stockfish",
            "nodes": config.ENGINE_NODES,
            "analysis_version": config.ANALYSIS_VERSION,
        },
    }


def practice_positions(conn: sqlite3.Connection) -> list[dict]:
    """Every position where you went wrong and a better move is known: the pool for practice."""
    tags = defaultdict(list)
    for t in conn.execute("SELECT * FROM move_tags"):
        tags[(t["game_id"], t["ply"])].append({"tag": t["tag"], "detail": json.loads(t["detail"] or "{}")})
    rows = conn.execute(
        f"""
        SELECT m.*, g.opp_name, g.start_time, g.my_color FROM moves m JOIN games g ON g.id = m.game_id
        WHERE m.is_mine = 1 AND m.move_class IN ({",".join("?" * len(MISTAKES))}) AND g.analysis_version IS NOT NULL
        ORDER BY g.start_time DESC, m.ply
        """,
        MISTAKES,
    ).fetchall()
    out = []
    for m in rows:
        retry = _retry(m, engine.load_move_scores(conn, engine.position_key(chess.Board(m["fen_before"]))))
        if not retry or _decided(m):
            continue
        out.append({
            "id": f"{m['game_id']}-{m['ply']}",
            "game": m["game_id"],
            "ply": m["ply"],
            "fen": m["fen_before"],
            "color": m["my_color"],
            "san": m["san"],
            "uci": m["uci"],
            "best": m["best_san"],
            "best_uci": m["best_uci"],
            "class": m["move_class"],
            "before": round(m["win_before"], 1),
            "after": round(m["win_after"], 1),
            "reply": (json.loads(m["reply_line"] or "[]") or [None])[0],
            "tags": tags.get((m["game_id"], m["ply"]), []),
            "opponent": m["opp_name"],
            "t": m["start_time"],
            "accept": retry["accept"],
            "wins": retry["wins"],
        })
    return out


def game_list(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT g.*,
               SUM(m.is_mine AND m.move_class = 'blunder') AS blunders,
               SUM(m.is_mine AND m.move_class IN ('mistake', 'miss')) AS mistakes,
               MAX(m.ply) AS plies
        FROM games g JOIN moves m ON m.game_id = g.id
        WHERE g.analysis_version IS NOT NULL
        GROUP BY g.id
        ORDER BY g.start_time DESC
        """
    ).fetchall()
    cost: dict[str, Counter] = defaultdict(Counter)
    for row in conn.execute(
        "SELECT t.game_id, t.tag, m.win_loss FROM move_tags t JOIN moves m USING (game_id, ply)"
    ):
        if row["tag"] in TAG_INFO:
            cost[row["game_id"]][row["tag"]] += row["win_loss"]
    return [
        {
            "id": g["id"],
            "t": g["start_time"],
            "color": g["my_color"],
            "opponent": g["opp_name"],
            "opp_rating": g["opp_rating"],
            "rating": g["my_rating"],
            "habit": (top := (cost[g["id"]].most_common(1) or [(None, 0)])[0][0]) and {"tag": top, "title": TAG_INFO[top]["title"]},
            "result": g["result"],
            "ending": ending(g),
            "opening": g["opening"],
            "family": g["opening_family"],
            "time_control": g["time_control"],
            "accuracy": g["my_accuracy"],
            "opp_accuracy": g["opp_accuracy"],
            "blunders": g["blunders"],
            "mistakes": g["mistakes"],
            "moves": (g["plies"] + 1) // 2,
        }
        for g in rows
    ]


HABIT_WINDOW = 10
RETRY_TOLERANCE = 3.0  # win % a retry move may give up against the best move and still count as found
DECIDED_HIGH, DECIDED_LOW = 95.0, 5.0


def _decided(move: sqlite3.Row) -> bool:
    """The game was already won or lost before this move, and the move didn't change that."""
    before, after = move["win_before"], move["win_after"]
    return (before >= DECIDED_HIGH and after >= DECIDED_HIGH - 10) or before <= DECIDED_LOW


def habit_context(conn: sqlite3.Connection) -> dict:
    """What a single game needs to know about the player's habits: their rank and which games show them."""
    ranked = [w["tag"] for w in overview(conn).get("weaknesses", [])]
    played = [
        row["id"]
        for row in conn.execute(
            "SELECT g.id FROM games g WHERE g.analysis_version IS NOT NULL "
            "AND EXISTS (SELECT 1 FROM moves m WHERE m.game_id = g.id) ORDER BY g.start_time"
        )
    ]
    tags_by_game = defaultdict(set)
    for row in conn.execute("SELECT game_id, tag FROM move_tags"):
        tags_by_game[row["game_id"]].add(row["tag"])
    return {"rank": {tag: i + 1 for i, tag in enumerate(ranked)}, "played": played, "tags": tags_by_game}


def _retry(move: sqlite3.Row, scores: dict | None) -> dict | None:
    """Moves that would have been good enough here, scored from the mover's side."""
    if not scores:
        return None
    white = move["color"] == "white"
    wins = {
        uci: grading.pov(grading.line_win_white({"cp": s["cp"], "mate": s["mate"], "pv": []}), white)
        for uci, s in scores.items()
    }
    best = max(wins.values())
    accept = sorted(
        (u for u, w in wins.items() if w >= best - RETRY_TOLERANCE and u != move["uci"]), key=lambda u: -wins[u]
    )
    if not accept and move["best_uci"]:
        accept = [move["best_uci"]]
    return {"accept": accept, "wins": {u: round(w, 1) for u, w in wins.items()}}


def game_review(conn: sqlite3.Connection, game_id: str, context: dict | None = None) -> dict | None:
    g = conn.execute("SELECT * FROM games WHERE id = ? AND analysis_version IS NOT NULL", (game_id,)).fetchone()
    if g is None:
        return None
    context = context or habit_context(conn)
    moves = conn.execute("SELECT * FROM moves WHERE game_id = ? ORDER BY ply", (game_id,)).fetchall()
    tags = defaultdict(list)
    for t in conn.execute("SELECT * FROM move_tags WHERE game_id = ?", (game_id,)):
        tags[t["ply"]].append({"tag": t["tag"], "detail": json.loads(t["detail"] or "{}")})

    mine = [m for m in moves if m["is_mine"]]
    costliest = sorted((m for m in mine if m["move_class"] in MISTAKES), key=lambda m: -m["win_loss"])[:3]
    key_moments = sorted(costliest, key=lambda m: m["ply"])

    # Each habit seen in this game: its overall rank, and how many of the last 10 games up to this one show it
    position = context["played"].index(game_id) if game_id in context["played"] else len(context["played"])
    window = context["played"][max(0, position - HABIT_WINDOW + 1) : position + 1]
    habits = {
        tag: {
            "rank": context["rank"].get(tag),
            "recent_games": sum(tag in context["tags"][gid] for gid in window),
            "window": len(window),
        }
        for ts in tags.values()
        for tag in {t["tag"] for t in ts}
    }

    previous = conn.execute(
        "SELECT my_rating FROM games WHERE start_time < ? AND time_class = ? ORDER BY start_time DESC LIMIT 1",
        (g["start_time"], g["time_class"]),
    ).fetchone()

    phases = []
    for phase in ("opening", "middlegame", "endgame"):
        pm = [m for m in mine if m["phase"] == phase]
        if pm:
            worst = max(pm, key=lambda m: m["win_loss"])
            phases.append({
                "phase": phase,
                "first_ply": next(m["ply"] for m in moves if m["phase"] == phase),
                "moves": len(pm),
                "mistakes": sum(m["move_class"] in MISTAKES for m in pm),
                "accuracy": _mean(m["accuracy"] for m in pm),
                "worst_class": worst["move_class"],
            })
    summary = {
        side: Counter(m["move_class"] for m in moves if bool(m["is_mine"]) == (side == "mine"))
        for side in ("mine", "theirs")
    }

    return {
        "game": {
            "id": g["id"],
            "url": g["url"],
            "t": g["start_time"],
            "color": g["my_color"],
            "opponent": g["opp_name"],
            "opp_rating": g["opp_rating"],
            "rating": g["my_rating"],
            "result": g["result"],
            "ending": ending(g),
            "opening": g["opening"],
            "time_control": g["time_control"],
            "accuracy": g["my_accuracy"],
            "opp_accuracy": g["opp_accuracy"],
            "chesscom_accuracy": g["chesscom_accuracy"],
            "rating_change": g["my_rating"] - previous["my_rating"] if previous else None,
        },
        "phases": phases,
        "habits": habits,
        "start_fen": moves[0]["fen_before"] if moves else None,
        "start_win_white": (
            grading.pov(moves[0]["win_before"], moves[0]["color"] == "white") if moves else 50.0
        ),
        "moves": [
            {
                "ply": m["ply"],
                "color": m["color"],
                "mine": bool(m["is_mine"]),
                "san": m["san"],
                "uci": m["uci"],
                "fen": m["fen_after"],
                "clock": m["clock_after"],
                "time_spent": m["time_spent"],
                "win_white": m["win_white"],
                "eval_cp": m["eval_cp"],
                "eval_mate": m["eval_mate"],
                "win_loss": m["win_loss"],
                "class": m["move_class"],
                "best": m["best_san"],
                "best_uci": m["best_uci"],
                "best_line": json.loads(m["best_line"] or "[]"),
                "reply_line": json.loads(m["reply_line"] or "[]"),
                "phase": m["phase"],
                "tags": tags.get(m["ply"], []),
                "decided": _decided(m),
                "retry": (
                    _retry(m, engine.load_move_scores(conn, engine.position_key(chess.Board(m["fen_before"]))))
                    if m["is_mine"] and m["move_class"] in MISTAKES
                    else None
                ),
            }
            for m in moves
        ],
        "key_moments": [m["ply"] for m in key_moments],
        "summary": {side: dict(counts) for side, counts in summary.items()},
        "tag_info": {tag: TAG_INFO[tag] for ts in tags.values() for t in ts if (tag := t["tag"]) in TAG_INFO},
    }
