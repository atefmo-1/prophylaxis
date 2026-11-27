"""Grade every move of every game from cached engine lines, and store moves, tags and accuracies."""

import io
import json
import sqlite3
from collections.abc import Callable

import chess
import chess.pgn

from . import book, config, engine, grading, motifs

GREAT_MIN_GAP = 20.0     # win % between the only good move and the next best
GREAT_MIN_WIN = 25.0     # ignore "only moves" in positions that were already lost
BAD = ("mistake", "blunder")
ALLOWED_TAGS = {
    "hanging_piece", "allowed_fork", "allowed_mate", "back_rank_mate", "lost_material", "allowed_stalemate", "ignored_threat", "lost_pawn",
}


def _replay(row: sqlite3.Row) -> tuple[list[chess.Board], list[chess.pgn.ChildNode]]:
    game = chess.pgn.read_game(io.StringIO(row["pgn"]))
    nodes = list(game.mainline())
    board = game.board()
    boards = [board.copy()]
    for node in nodes:
        board.push(node.move)
        boards.append(board.copy())
    return boards, nodes


def _san_line(board: chess.Board, ucis: list[str], limit: int = 8) -> list[str]:
    board = board.copy(stack=False)
    sans = []
    for uci in ucis[:limit]:
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            break
        sans.append(board.san(move))
        board.push(move)
    return sans


def positions_to_analyse(rows: list[sqlite3.Row]) -> set[str]:
    keys = set()
    for row in rows:
        boards, _ = _replay(row)
        keys.update(engine.position_key(b) for b in boards if not engine.is_terminal(b))
    return keys


def _is_great(before: chess.Board, lines: list[dict], win_before: float) -> bool:
    """Played the only good move in a position that mattered (not a check escape). An only-move recapture counts,
    as it does on chess.com, so the two counts agree side by side."""
    if len(lines) < 2 or before.is_check() or win_before < GREAT_MIN_WIN:
        return False
    second = grading.pov(grading.line_win_white(lines[1]), before.turn)
    return win_before - second >= GREAT_MIN_GAP


def _win_white(boards: list[chess.Board], lines: list) -> list[float]:
    return [
        grading.terminal_win_white(b) if l is None else grading.line_win_white(l[0])
        for b, l in zip(boards, lines)
    ]


def threat_positions(row: sqlite3.Row, lines_by_key: dict[str, list[dict]]) -> dict[int, str]:
    """For each of your moves that loses enough to get a reason: the position as if you could pass, whose engine line
    says what your opponent already threatened (motifs.ignored_threat). Keyed by ply."""
    boards, _ = _replay(row)
    my_color = chess.WHITE if row["my_color"] == "white" else chess.BLACK
    lines = [None if engine.is_terminal(b) else lines_by_key[engine.position_key(b)] for b in boards]
    win_white = _win_white(boards, lines)
    out = {}
    for ply in range(1, len(boards)):
        before = boards[ply - 1]
        loss = grading.pov(win_white[ply - 1], before.turn) - grading.pov(win_white[ply], before.turn)
        if before.turn == my_color and loss >= motifs.ALLOWED_MIN_LOSS and (p := motifs.passed(before)) is not None:
            out[ply] = engine.position_key(p)
    return out


def analyse_game(
    conn: sqlite3.Connection,
    row: sqlite3.Row,
    lines_by_key: dict[str, list[dict]],
    threats: dict[int, dict] | None = None,
) -> None:
    """`threats`: the engine's line, by ply, in the positions threat_positions() names."""
    boards, nodes = _replay(row)
    my_color = chess.WHITE if row["my_color"] == "white" else chess.BLACK
    threats = threats or {}

    lines = [None if engine.is_terminal(b) else lines_by_key[engine.position_key(b)] for b in boards]
    win_white = _win_white(boards, lines)
    cp_white = [
        grading.terminal_cp_white(b) if l is None else grading.line_cp_white(l[0])
        for b, l in zip(boards, lines)
    ]

    in_book = book.book_plies(boards)
    clocks: dict[chess.Color, float | None] = {chess.WHITE: row["base_s"], chess.BLACK: row["base_s"]}
    move_rows, tag_rows = [], []

    for ply, node in enumerate(nodes, start=1):
        before, after = boards[ply - 1], boards[ply]
        move, mover = node.move, before.turn
        lines_before, lines_after = lines[ply - 1] or [], lines[ply]

        win_before = grading.pov(win_white[ply - 1], mover)
        win_after = grading.pov(win_white[ply], mover)
        win_loss = max(0.0, win_before - win_after)

        best_uci = lines_before[0]["pv"][0] if lines_before else None
        cp_loss = max(0, (cp_white[ply - 1] - cp_white[ply]) * (1 if mover == chess.WHITE else -1))
        cls = grading.classify(win_loss, move.uci() == best_uci, cp_loss)
        if cls == "best" and _is_great(before, lines_before, win_before):
            cls = "great"
        if grading.is_brilliant(before, move, win_before, win_after, win_loss):
            cls = "brilliant"
        if ply <= in_book and win_loss < grading.BOOK_MAX_LOSS:
            cls = "book"

        clock_after = node.clock()
        clock_before = clocks[mover]
        time_spent = None
        if clock_after is not None and clock_before is not None:
            time_spent = max(0.0, clock_before + (row["inc_s"] or 0) - clock_after)
        clocks[mover] = clock_after

        eval_line = lines_after[0] if lines_after else None
        move_rows.append({
            "game_id": row["id"],
            "ply": ply,
            "color": "white" if mover == chess.WHITE else "black",
            "is_mine": int(mover == my_color),
            "san": before.san(move),
            "uci": move.uci(),
            "fen_before": before.fen(),
            "fen_after": after.fen(),
            "clock_after": clock_after,
            "clock_before": clock_before,
            "time_spent": time_spent,
            "win_white": win_white[ply],
            "eval_cp": eval_line["cp"] if eval_line else None,
            "eval_mate": eval_line["mate"] if eval_line else None,
            "win_before": win_before,
            "win_after": win_after,
            "win_loss": win_loss,
            "accuracy": grading.move_accuracy(win_before, win_after),
            "best_uci": best_uci,
            "best_san": before.san(chess.Move.from_uci(best_uci)) if best_uci else None,
            "best_line": json.dumps(_san_line(before, lines_before[0]["pv"])) if lines_before else "[]",
            "reply_line": json.dumps(_san_line(after, lines_after[0]["pv"])) if lines_after else "[]",
            "move_class": cls,
            "phase": grading.phase(before, ply),
        })

        if mover == my_color:
            tags = motifs.detect(before, move, lines_before, lines_after, win_loss, clock_before, time_spent)
            threat = motifs.ignored_threat(before, move, lines_after, threats.get(ply), win_loss)
            if threat:
                # The threat sentence already says what it wins: don't name the same pawn twice.
                tags = [(t, d) for t, d in tags if not (t == "lost_pawn" and d["move"] == threat[1]["move"])]
                clock = next((i for i, (t, _) in enumerate(tags) if t in ("time_pressure", "rushed")), len(tags))
                tags.insert(clock, threat)
            tag_rows.extend((row["id"], ply, tag, json.dumps(detail)) for tag, detail in tags)
            # chess.com's "Miss": your opponent had just gone wrong and you didn't punish it
            names = {tag for tag, _ in tags}
            opponent_erred = len(move_rows) >= 2 and move_rows[-2]["move_class"] in BAD
            if (
                cls in BAD
                and opponent_erred
                and any(t.startswith("missed_") for t in names)
                and not names & ALLOWED_TAGS
            ):
                move_rows[-1]["move_class"] = "miss"

    accuracy = grading.game_accuracy(win_white, boards[0].turn)
    conn.execute("DELETE FROM moves WHERE game_id = ?", (row["id"],))
    conn.execute("DELETE FROM move_tags WHERE game_id = ?", (row["id"],))
    if move_rows:
        columns = ", ".join(move_rows[0])
        placeholders = ", ".join(f":{k}" for k in move_rows[0])
        conn.executemany(f"INSERT INTO moves ({columns}) VALUES ({placeholders})", move_rows)
    conn.executemany("INSERT INTO move_tags (game_id, ply, tag, detail) VALUES (?, ?, ?, ?)", tag_rows)
    conn.execute(
        "UPDATE games SET my_accuracy = ?, opp_accuracy = ?, analysis_version = ? WHERE id = ?",
        (accuracy[my_color], accuracy[not my_color], config.ANALYSIS_VERSION, row["id"]),
    )


def run(
    conn: sqlite3.Connection,
    regrade_all: bool = False,
    progress: Callable[[int, int], None] | None = None,
) -> tuple[int, int]:
    """Analyse new games (or all, with `regrade_all`). Returns (positions sent to Stockfish, games graded)."""
    query = "SELECT * FROM games"
    if not regrade_all:
        query += " WHERE analysis_version IS NULL OR analysis_version != ?"
    rows = conn.execute(query, () if regrade_all else (config.ANALYSIS_VERSION,)).fetchall()
    if not rows:
        return 0, 0

    keys = positions_to_analyse(rows)
    analysed = engine.analyse_missing(conn, keys, progress=progress)
    lines_by_key = engine.load_lines(conn, keys)

    # What your opponent already threatened before each of your mistakes: one more search per mistake.
    threat_keys = {row["id"]: threat_positions(row, lines_by_key) for row in rows}
    wanted = {key for keys_ in threat_keys.values() for key in keys_.values()}
    analysed += engine.analyse_missing(conn, wanted, progress=progress)
    threat_lines = engine.load_lines(conn, wanted)

    for row in rows:
        threats = {ply: threat_lines[key][0] for ply, key in threat_keys[row["id"]].items() if threat_lines.get(key)}
        analyse_game(conn, row, lines_by_key, threats)
    conn.commit()

    # Every legal move scored in the positions where you went wrong, so a retry can accept any good move.
    retry = [
        r["fen_before"]
        for r in conn.execute(
            "SELECT fen_before FROM moves WHERE is_mine = 1 AND move_class IN ('mistake', 'miss', 'blunder')"
        )
    ]
    analysed += engine.score_all_moves(conn, {engine.position_key(chess.Board(f)) for f in retry}, progress=progress)
    return analysed, len(rows)
