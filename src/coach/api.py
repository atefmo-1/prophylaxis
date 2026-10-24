"""Local API serving the same JSON as the static export, computed live from the database.

The dashboard fetches `/data/...` either way: from this server in development, or from
exported files once deployed.
"""

from fastapi import FastAPI, HTTPException

from . import db, stats

app = FastAPI(title="Chess Coach")


@app.get("/data/overview.json")
def overview() -> dict:
    with db.connect() as conn:
        return stats.overview(conn)


@app.get("/data/games.json")
def games() -> list[dict]:
    with db.connect() as conn:
        return stats.game_list(conn)


@app.get("/data/games/{game_id}.json")
def game(game_id: str) -> dict:
    with db.connect() as conn:
        review = stats.game_review(conn, game_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Game not found or not analysed yet")
    return review
