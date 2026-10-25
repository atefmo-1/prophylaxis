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
ALLOWED_TAGS = {"hanging_piece", "allowed_fork", "allowed_mate", "back_rank_mate", "lost_material", "allowed_stalemate"}


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


def _is_great(
    before: chess.Board, move: chess.Move, prev: chess.Move | None, lines: list[dict], win_before: float
) -> bool:
    """Played the only good move in a position that mattered (not a routine recapture or check escape)."""
    if len(lines) < 2 or before.is_check() or win_before < GREAT_MIN_WIN:
        return False
    if prev is not None and move.to_square == prev.to_square and before.is_capture(move):
        return False
    second = grading.pov(grading.line_win_white(lines[1]), before.turn)
    return win_before - second >= GREAT_MIN_GAP


def analyse_game(conn: sqlite3.Connection, row: sqlite3.Row, lines_by_key: dict[str, list[dict]]) -> None:
    boards, nodes = _replay(row)
    my_color = chess.WHITE if row["my_color"] == "white" else chess.BLACK

    lines = [None if engine.is_terminal(b) else lines_by_key[engine.position_key(b)] for b in boards]
    win_white = [
        grading.terminal_win_white(b) if l is None else grading.line_win_white(l[0])
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
        cls = grading.classify(win_loss, move.uci() == best_uci)
        prev = nodes[ply - 2].move if ply >= 2 else None
        if cls == "best" and _is_great(before, move, prev, lines_before, win_before):
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

    accuracy = grading.game_accuracy(win_white)
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

    for row in rows:
        analyse_game(conn, row, lines_by_key)
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
