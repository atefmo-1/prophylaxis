"""SQLite storage. One file, created on first use."""

import sqlite3
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS games (
    id                TEXT PRIMARY KEY,   -- chess.com game id from the URL
    url               TEXT NOT NULL,
    start_time        INTEGER NOT NULL,   -- unix seconds, UTC
    end_time          INTEGER NOT NULL,
    time_class        TEXT NOT NULL,      -- bullet / blitz / rapid / daily
    time_control      TEXT NOT NULL,
    base_s            INTEGER,            -- NULL for daily games
    inc_s             INTEGER,
    rated             INTEGER NOT NULL,
    my_color          TEXT NOT NULL,      -- white / black
    my_rating         INTEGER NOT NULL,
    opp_name          TEXT NOT NULL,
    opp_rating        INTEGER NOT NULL,
    result            TEXT NOT NULL,      -- win / loss / draw
    my_code           TEXT NOT NULL,      -- chess.com result code: win, checkmated, timeout, ...
    opp_code          TEXT NOT NULL,
    eco               TEXT,
    opening           TEXT NOT NULL,
    opening_family    TEXT NOT NULL,
    chesscom_accuracy REAL,               -- only present when the game was reviewed on chess.com
    pgn               TEXT NOT NULL,
    session_id        INTEGER,
    my_accuracy       REAL,
    opp_accuracy      REAL,
    analysis_version  INTEGER
);

CREATE TABLE IF NOT EXISTS moves (
    game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ply         INTEGER NOT NULL,         -- 1 = white's first move
    color       TEXT NOT NULL,
    is_mine     INTEGER NOT NULL,
    san         TEXT NOT NULL,
    uci         TEXT NOT NULL,
    fen_before  TEXT NOT NULL,
    fen_after   TEXT NOT NULL,
    clock_after REAL,                     -- seconds left after the move
    clock_before REAL,                    -- seconds left when the move started
    time_spent  REAL,
    win_white   REAL NOT NULL,            -- white's win % after the move (for the graph)
    eval_cp     INTEGER,                  -- white POV after the move; NULL when mate
    eval_mate   INTEGER,                  -- white POV moves to mate; NULL when no mate
    win_before  REAL NOT NULL,            -- mover's win % before / after
    win_after   REAL NOT NULL,
    win_loss    REAL NOT NULL,
    accuracy    REAL NOT NULL,
    best_uci    TEXT,
    best_san    TEXT,
    best_line   TEXT,                     -- JSON list of SAN
    reply_line  TEXT,                     -- JSON list of SAN: engine's best answer to the played move
    move_class  TEXT NOT NULL,
    phase       TEXT NOT NULL,
    PRIMARY KEY (game_id, ply)
);

CREATE TABLE IF NOT EXISTS move_tags (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ply     INTEGER NOT NULL,
    tag     TEXT NOT NULL,
    detail  TEXT,                         -- JSON
    PRIMARY KEY (game_id, ply, tag)
);

CREATE TABLE IF NOT EXISTS engine_cache (
    key   TEXT NOT NULL,                  -- EPD of the position
    nodes INTEGER NOT NULL,
    lines TEXT NOT NULL,                  -- JSON: [{cp, mate, pv}] white POV, best first
    PRIMARY KEY (key, nodes)
);

CREATE TABLE IF NOT EXISTS move_scores (
    key    TEXT NOT NULL,                 -- EPD of the position
    nodes  INTEGER NOT NULL,
    scores TEXT NOT NULL,                 -- JSON: {uci: {cp, mate}} white POV, every legal move
    PRIMARY KEY (key, nodes)
);

CREATE TABLE IF NOT EXISTS sync_state (
    url           TEXT PRIMARY KEY,
    etag          TEXT,
    last_modified TEXT,
    fetched_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA)
    return conn


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))
