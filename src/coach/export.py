"""Write the dashboard's data as static JSON, so the site can be hosted anywhere without a server."""

import json
import shutil
import sqlite3
from pathlib import Path

from . import config, stats


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":")))


def run(conn: sqlite3.Connection, out_dir: Path = config.EXPORT_DIR) -> int:
    games_dir = out_dir / "games"
    if games_dir.exists():
        shutil.rmtree(games_dir)
    _write(out_dir / "overview.json", stats.overview(conn))
    games = stats.game_list(conn)
    _write(out_dir / "games.json", games)
    _write(out_dir / "practice.json", stats.practice_positions(conn))
    context = stats.habit_context(conn)
    for game in games:
        _write(games_dir / f"{game['id']}.json", stats.game_review(conn, game["id"], context))
    return len(games)
