"""Sync finished games from the chess.com public API.

API docs: https://www.chess.com/news/view/published-data-api
The API asks clients to make requests one at a time, so nothing here runs in parallel.
"""

import io
import sqlite3
import time
from datetime import UTC, datetime

import chess.pgn
import httpx

from . import config, openings

API = "https://api.chess.com/pub/player"
DRAW_CODES = {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}
SESSION_GAP_S = 30 * 60


def _get(client: httpx.Client, url: str, headers: dict[str, str] | None = None) -> httpx.Response:
    for attempt in range(4):
        response = client.get(url, headers=headers or {})
        if response.status_code != 429:
            return response
        time.sleep(5 * 2**attempt)
    response.raise_for_status()
    return response


def parse_time_control(tc: str) -> tuple[int | None, int | None]:
    """'600' -> (600, 0), '600+5' -> (600, 5), daily '1/86400' -> (None, None)."""
    if "/" in tc or not tc:
        return None, None
    base, _, inc = tc.partition("+")
    return int(base), int(inc or 0)


def _start_time(headers: chess.pgn.Headers) -> int | None:
    date, clock = headers.get("UTCDate"), headers.get("UTCTime")
    if not date or not clock:
        return None
    dt = datetime.strptime(f"{date} {clock}", "%Y.%m.%d %H:%M:%S").replace(tzinfo=UTC)
    return int(dt.timestamp())


def parse_game(game: dict, username: str) -> dict | None:
    """Turn one chess.com archive entry into a `games` row, or None if it isn't ours / isn't standard chess."""
    if game.get("rules") != "chess" or not game.get("pgn"):
        return None
    white, black = game["white"], game["black"]
    if white["username"].lower() == username:
        my_color, me, opp = "white", white, black
    elif black["username"].lower() == username:
        my_color, me, opp = "black", black, white
    else:
        return None

    pgn = chess.pgn.read_game(io.StringIO(game["pgn"]))
    if pgn is None:
        return None
    code = me["result"]
    result = "win" if code == "win" else "draw" if code in DRAW_CODES else "loss"
    base_s, inc_s = parse_time_control(game.get("time_control", ""))
    opening, family = openings.parse(game.get("eco") or pgn.headers.get("ECOUrl"))

    return {
        "id": game["url"].rstrip("/").rsplit("/", 1)[-1],
        "url": game["url"],
        "start_time": _start_time(pgn.headers) or game["end_time"],
        "end_time": game["end_time"],
        "time_class": game["time_class"],
        "time_control": game.get("time_control", ""),
        "base_s": base_s,
        "inc_s": inc_s,
        "rated": int(bool(game.get("rated"))),
        "my_color": my_color,
        "my_rating": me["rating"],
        "opp_name": opp["username"],
        "opp_rating": opp["rating"],
        "result": result,
        "my_code": code,
        "opp_code": opp["result"],
        "eco": pgn.headers.get("ECO"),
        "opening": opening,
        "opening_family": family,
        "chesscom_accuracy": (game.get("accuracies") or {}).get(my_color),
        "pgn": game["pgn"],
    }


def sync(conn: sqlite3.Connection, username: str) -> int:
    """Fetch every monthly archive that changed since the last sync. Returns the number of new games."""
    username = username.lower()
    known = {row["id"] for row in conn.execute("SELECT id FROM games")}
    added = 0

    with httpx.Client(headers={"User-Agent": config.USER_AGENT}, timeout=30, follow_redirects=True) as client:
        response = _get(client, f"{API}/{username}/games/archives")
        response.raise_for_status()

        for url in response.json()["archives"]:
            state = conn.execute("SELECT etag, last_modified FROM sync_state WHERE url = ?", (url,)).fetchone()
            headers = {}
            if state and state["etag"]:
                headers["If-None-Match"] = state["etag"]
            if state and state["last_modified"]:
                headers["If-Modified-Since"] = state["last_modified"]

            archive = _get(client, url, headers)
            if archive.status_code == 304:
                continue
            archive.raise_for_status()

            for game in archive.json().get("games", []):
                row = parse_game(game, username)
                if row is None:
                    continue
                columns = ", ".join(row)
                placeholders = ", ".join(f":{k}" for k in row)
                # A game can be reviewed on chess.com after we first saw it, so refresh its accuracy.
                conn.execute(
                    f"INSERT INTO games ({columns}) VALUES ({placeholders}) "
                    "ON CONFLICT(id) DO UPDATE SET chesscom_accuracy = excluded.chesscom_accuracy",
                    row,
                )
                if row["id"] not in known:
                    known.add(row["id"])
                    added += 1

            conn.execute(
                "INSERT OR REPLACE INTO sync_state (url, etag, last_modified, fetched_at) VALUES (?, ?, ?, ?)",
                (url, archive.headers.get("etag"), archive.headers.get("last-modified"), int(time.time())),
            )
            conn.commit()

    assign_sessions(conn)
    return added


def assign_sessions(conn: sqlite3.Connection) -> None:
    """Group games into playing sessions: a new session starts after a 30-minute break."""
    session, last_end = 0, None
    for row in conn.execute("SELECT id, start_time, end_time FROM games ORDER BY start_time").fetchall():
        if last_end is not None and row["start_time"] - last_end > SESSION_GAP_S:
            session += 1
        conn.execute("UPDATE games SET session_id = ? WHERE id = ?", (session, row["id"]))
        last_end = row["end_time"]
    conn.commit()
