"""Stockfish analysis: a pool of single-threaded engines plus a cache keyed by position.

Many single-threaded engines analyse more positions per second than one multi-threaded
engine, and a fixed node budget keeps results reproducible from run to run.
"""

import json
import sqlite3
import threading
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed

import chess
import chess.engine

from . import config

_local = threading.local()


def position_key(board: chess.Board) -> str:
    """EPD drops the move counters, so transpositions share a cache entry."""
    return board.epd()


def is_terminal(board: chess.Board) -> bool:
    return board.is_checkmate() or board.is_stalemate() or board.is_insufficient_material()


def _engine(opened: list[chess.engine.SimpleEngine], lock: threading.Lock) -> chess.engine.SimpleEngine:
    engine = getattr(_local, "engine", None)
    if engine is None:
        engine = chess.engine.SimpleEngine.popen_uci(config.stockfish_path())
        engine.configure({"Threads": 1, "Hash": 64})
        _local.engine = engine
        with lock:
            opened.append(engine)
    return engine


def _analyse(epd: str, nodes: int, opened: list, lock: threading.Lock) -> tuple[str, list[dict]]:
    board = chess.Board()
    board.set_epd(epd)
    infos = _engine(opened, lock).analyse(board, chess.engine.Limit(nodes=nodes), multipv=config.ENGINE_MULTIPV)
    lines = []
    for info in infos:
        if "score" not in info or not info.get("pv"):
            continue
        score = info["score"].white()
        lines.append({"cp": score.score(), "mate": score.mate(), "pv": [m.uci() for m in info["pv"]]})
    return epd, lines


def engine_name() -> str:
    with chess.engine.SimpleEngine.popen_uci(config.stockfish_path()) as engine:
        return engine.id.get("name", "Stockfish")


def analyse_missing(
    conn: sqlite3.Connection,
    keys: Iterable[str],
    nodes: int = config.ENGINE_NODES,
    workers: int = config.ENGINE_WORKERS,
    progress: Callable[[int, int], None] | None = None,
) -> int:
    """Analyse every position not already cached. Returns how many were analysed."""
    cached = {row["key"] for row in conn.execute("SELECT key FROM engine_cache WHERE nodes = ?", (nodes,))}
    todo = sorted(set(keys) - cached)
    if not todo:
        return 0

    opened: list[chess.engine.SimpleEngine] = []
    lock = threading.Lock()
    done = 0
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_analyse, key, nodes, opened, lock) for key in todo]
            for future in as_completed(futures):
                key, lines = future.result()
                conn.execute(
                    "INSERT OR REPLACE INTO engine_cache (key, nodes, lines) VALUES (?, ?, ?)",
                    (key, nodes, json.dumps(lines)),
                )
                done += 1
                if done % 100 == 0:
                    conn.commit()
                if progress:
                    progress(done, len(todo))
    finally:
        conn.commit()
        for engine in opened:
            engine.quit()
    return done


RETRY_NODES = 600_000


def _score_moves(epd: str, nodes: int, opened: list, lock: threading.Lock) -> tuple[str, dict]:
    board = chess.Board()
    board.set_epd(epd)
    count = board.legal_moves.count()
    infos = _engine(opened, lock).analyse(board, chess.engine.Limit(nodes=nodes), multipv=count)
    scores = {}
    for info in infos:
        if "score" in info and info.get("pv"):
            score = info["score"].white()
            scores[info["pv"][0].uci()] = {"cp": score.score(), "mate": score.mate()}
    return epd, scores


def score_all_moves(
    conn: sqlite3.Connection,
    keys: Iterable[str],
    nodes: int = RETRY_NODES,
    workers: int = config.ENGINE_WORKERS,
    progress: Callable[[int, int], None] | None = None,
) -> int:
    """Score every legal move (MultiPV = all) in the given positions. Returns how many were analysed."""
    cached = {row["key"] for row in conn.execute("SELECT key FROM move_scores WHERE nodes = ?", (nodes,))}
    todo = sorted(set(keys) - cached)
    if not todo:
        return 0
    opened: list[chess.engine.SimpleEngine] = []
    lock = threading.Lock()
    done = 0
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for future in as_completed([pool.submit(_score_moves, key, nodes, opened, lock) for key in todo]):
                key, scores = future.result()
                conn.execute(
                    "INSERT OR REPLACE INTO move_scores (key, nodes, scores) VALUES (?, ?, ?)",
                    (key, nodes, json.dumps(scores)),
                )
                done += 1
                if progress:
                    progress(done, len(todo))
    finally:
        conn.commit()
        for engine in opened:
            engine.quit()
    return done


def load_move_scores(conn: sqlite3.Connection, key: str, nodes: int = RETRY_NODES) -> dict | None:
    row = conn.execute("SELECT scores FROM move_scores WHERE key = ? AND nodes = ?", (key, nodes)).fetchone()
    return json.loads(row["scores"]) if row else None


def load_lines(conn: sqlite3.Connection, keys: Iterable[str], nodes: int = config.ENGINE_NODES) -> dict[str, list[dict]]:
    keys = list(set(keys))
    found: dict[str, list[dict]] = {}
    for start in range(0, len(keys), 500):
        chunk = keys[start : start + 500]
        rows = conn.execute(
            f"SELECT key, lines FROM engine_cache WHERE nodes = ? AND key IN ({','.join('?' * len(chunk))})",
            (nodes, *chunk),
        )
        found.update({row["key"]: json.loads(row["lines"]) for row in rows})
    return found
