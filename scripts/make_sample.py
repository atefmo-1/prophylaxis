"""Generate the sample player's games: beginner-level chess played by weak Stockfish settings, so the demo and the
screenshots show realistic games that belong to nobody.

Each move, a side looks at Stockfish's best few moves at a low depth and picks one with some randomness; now and
then it plays any legal move instead, which is how hung pieces and missed tactics happen. The sample player gets a
little steadier over the games, so the habit trends have something to show. Games start from common openings, carry
clock times, and end the way real ones do: checkmate, resignation, time, or a draw.

Writes web/public/sample/games.json in chess.com's archive format. With --rival, writes a second made-up player for
the sample player to compare with (web/public/sample/rival-games.json): a quicker player with a few favourite openings.
Usage: uv run python scripts/make_sample.py [--games 36] [--seed 7]
       uv run python scripts/make_sample.py --rival
"""

import argparse
import io
import json
import math
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path

import chess
import chess.engine
import chess.pgn

from coach import config

SAMPLE = Path(__file__).resolve().parents[1] / "web" / "public" / "sample"
BASE_S = 600

# Who is generated: the sample player, or the rival it can be compared with.
PROFILES = {
    "player": {
        "name": "sample-player", "out": "games.json", "games": 36, "seed": 7, "rating": 412, "ids": "s", "opponents": "",
        "wild": (0.11, 0.06), "think": 1.0, "favourites": None,
    },
    # Quicker and less careful, and loyal to a few openings, so a comparison has something to say.
    "rival": {
        "name": "sample-rival", "out": "rival-games.json", "games": 30, "seed": 11, "rating": 430, "ids": "r", "opponents": "r",
        "wild": (0.10, 0.10), "think": 0.45,
        "favourites": {chess.WHITE: ["Italian-Game-Two-Knights-Defense", "Kings-Pawn-Opening-Kings-Knight-Variation"],
                       chess.BLACK: ["French-Defense-Advance-Variation", "Caro-Kann-Defense"]},
    },
}

# (chess.com opening page, first moves): real openings so the names and families read like chess.com's.
OPENINGS = [
    ("Italian-Game-Two-Knights-Defense", "e4 e5 Nf3 Nc6 Bc4 Nf6"),
    ("Ruy-Lopez-Opening", "e4 e5 Nf3 Nc6 Bb5"),
    ("Sicilian-Defense-Open", "e4 c5 Nf3 d6 d4 cxd4"),
    ("French-Defense-Advance-Variation", "e4 e6 d4 d5 e5"),
    ("Queens-Pawn-Opening-Accelerated-London-System", "d4 d5 Bf4"),
    ("Scandinavian-Defense-Mieses-Kotroc-Variation", "e4 d5 exd5 Qxd5"),
    ("Kings-Pawn-Opening-Kings-Knight-Variation", "e4 e5 Nf3"),
    ("Caro-Kann-Defense", "e4 c6"),
    ("Philidor-Defense", "e4 e5 Nf3 d6"),
    ("Queens-Gambit-Declined", "d4 d5 c4 e6"),
]


def choose(board: chess.Board, engine: chess.engine.SimpleEngine, wild: float, rng: random.Random, think: float = 1.0) -> tuple[chess.Move, float]:
    """A move for the side to play, and how long it took to think (seconds)."""
    if rng.random() < wild:
        # Any move at all: the source of most beginner blunders. Played fast more often than not.
        return rng.choice(list(board.legal_moves)), rng.choice([1.2, 2.0, 3.5, 6.0, 15.0]) * think
    infos = engine.analyse(board, chess.engine.Limit(depth=6), multipv=6)
    scored = [(i["pv"][0], i["score"].pov(board.turn).score(mate_score=3000)) for i in infos if i.get("pv")]
    top = max(s for _, s in scored)
    weights = [math.exp((s - top) / 90) for _, s in scored]
    move = rng.choices([m for m, _ in scored], weights)[0]
    return move, max(0.8, rng.lognormvariate(2.1, 0.8) * think)


def play(engine: chess.engine.SimpleEngine, rng: random.Random, my_wild: float, their_wild: float, my_color: chess.Color,
         think: float = 1.0, favourites: list[str] | None = None):
    pool = [o for o in OPENINGS if o[0] in favourites] if favourites and rng.random() < 0.8 else OPENINGS
    slug, line = rng.choice(pool)
    board = chess.Board()
    clocks = {chess.WHITE: float(BASE_S), chess.BLACK: float(BASE_S)}
    moves: list[tuple[chess.Move, float]] = []
    for san in line.split():
        move = board.parse_san(san)
        spent = rng.uniform(1, 4)
        clocks[board.turn] -= spent
        moves.append((move, clocks[board.turn]))
        board.push(move)

    result = None  # (winner color or None, loser's chess.com code, winner's code)
    losing_streak = {chess.WHITE: 0, chess.BLACK: 0}
    while result is None:
        if board.is_game_over(claim_draw=True):
            outcome = board.outcome(claim_draw=True)
            if outcome.winner is not None:
                result = (outcome.winner, "checkmated", "win")
            else:
                code = {
                    chess.Termination.STALEMATE: "stalemate",
                    chess.Termination.INSUFFICIENT_MATERIAL: "insufficient",
                    chess.Termination.THREEFOLD_REPETITION: "repetition",
                    chess.Termination.FIVEFOLD_REPETITION: "repetition",
                    chess.Termination.FIFTY_MOVES: "50move",
                    chess.Termination.SEVENTYFIVE_MOVES: "50move",
                }.get(outcome.termination, "agreed")
                result = (None, code, code)
            break
        if len(moves) >= 180:
            result = (None, "agreed", "agreed")
            break
        side = board.turn
        wild = my_wild if side == my_color else their_wild
        move, spent = choose(board, engine, wild, rng, think if side == my_color else 1.0)
        clocks[side] -= spent
        if clocks[side] <= 0:
            result = (not side, "timeout", "win")
            break
        moves.append((move, clocks[side]))
        board.push(move)
        # A side that is far behind for a while resigns, as beginners do (sometimes much later than they should).
        score = engine.analyse(board, chess.engine.Limit(depth=8))["score"].pov(side).score(mate_score=3000)
        losing_streak[side] = losing_streak[side] + 1 if score < -900 else 0
        if losing_streak[side] >= 3 and rng.random() < 0.35:
            result = (not side, "resigned", "win")
    return slug, moves, result


def clk(seconds: float) -> str:
    seconds = max(0.0, seconds)
    return f"{int(seconds // 3600)}:{int(seconds % 3600 // 60):02d}:{seconds % 60:04.1f}"


def to_pgn(moves, headers: dict[str, str]) -> str:
    game = chess.pgn.Game()
    for k, v in headers.items():
        game.headers[k] = v
    node = game
    for move, left in moves:
        node = node.add_variation(move)
        node.comment = f"[%clk {clk(left)}]"
    out = io.StringIO()
    print(game, file=out, end="\n")
    return out.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rival", action="store_true", help="the made-up player the sample player compares with")
    parser.add_argument("--games", type=int)
    parser.add_argument("--seed", type=int)
    args = parser.parse_args()
    profile = PROFILES["rival" if args.rival else "player"]
    games = args.games or profile["games"]
    rng = random.Random(args.seed if args.seed is not None else profile["seed"])
    player, wild_start, wild_end = profile["name"], *profile["wild"]

    rating = profile["rating"]
    when = datetime(2026, 10, 1, 18, 0, tzinfo=UTC)
    archive = []
    with chess.engine.SimpleEngine.popen_uci(config.stockfish_path()) as engine:
        engine.configure({"Threads": 1, "Hash": 32})
        for i in range(games):
            # The sample player steadies over the month; opponents stay as they are.
            my_wild = wild_start - (wild_start - wild_end) * i / max(1, games - 1)
            their_wild = rng.uniform(0.07, 0.11)
            my_color = chess.WHITE if i % 2 == 0 else chess.BLACK
            favourites = profile["favourites"][my_color] if profile["favourites"] else None
            slug, moves, (winner, loser_code, winner_code) = play(engine, rng, my_wild, their_wild, my_color, profile["think"], favourites)

            opp_rating = rating + rng.randint(-45, 45)
            names = {my_color: player, not my_color: f"opponent-{profile['opponents']}{i + 1:02d}"}
            ratings = {my_color: rating, not my_color: opp_rating}
            if winner is None:
                codes = {chess.WHITE: loser_code, chess.BLACK: loser_code}
                pgn_result = "1/2-1/2"
            else:
                codes = {winner: winner_code, not winner: loser_code}
                pgn_result = "1-0" if winner == chess.WHITE else "0-1"
            start = when
            end = start + timedelta(seconds=sum(1 for _ in moves) * 9 + rng.randint(30, 120))
            headers = {
                "Event": "Live Chess", "Site": "Prophylaxis sample", "Date": start.strftime("%Y.%m.%d"),
                "White": names[chess.WHITE], "Black": names[chess.BLACK], "Result": pgn_result,
                "UTCDate": start.strftime("%Y.%m.%d"), "UTCTime": start.strftime("%H:%M:%S"),
                "TimeControl": str(BASE_S), "ECOUrl": f"https://www.chess.com/openings/{slug}",
            }
            archive.append({
                "url": f"https://prophylaxis.invalid/sample/{profile['ids']}{i + 1:02d}",
                "pgn": to_pgn(moves, headers),
                "time_control": str(BASE_S),
                "time_class": "rapid",
                "end_time": int(end.timestamp()),
                "rated": True,
                "rules": "chess",
                "eco": f"https://www.chess.com/openings/{slug}",
                "white": {"username": names[chess.WHITE], "rating": ratings[chess.WHITE], "result": codes[chess.WHITE]},
                "black": {"username": names[chess.BLACK], "rating": ratings[chess.BLACK], "result": codes[chess.BLACK]},
            })
            mine = codes[my_color]
            rating += 8 if mine == "win" else 0 if winner is None else -8
            # Sessions of two to four games in an evening, then a day or two off.
            when = end + (timedelta(minutes=rng.randint(2, 10)) if rng.random() < 0.7 else timedelta(days=rng.randint(1, 2), hours=rng.randint(-2, 2)))
            print(f"{i + 1:2d} {slug:46s} {len(moves):3d} plies  {mine}")

    out = SAMPLE / profile["out"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"games": archive}, indent=0))
    print(f"{len(archive)} games -> {out}")


if __name__ == "__main__":
    main()
