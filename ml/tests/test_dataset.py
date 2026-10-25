"""Puzzle rows become examples, and the split keeps games together."""

from collections import Counter

from tactics import dataset


def row(pid: str, game: str, themes: str) -> dict:
    return {
        "PuzzleId": pid, "FEN": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1", "Moves": "g8f8 d1d8", "Rating": "900",
        "Themes": themes, "GameUrl": f"https://lichess.org/{game}/black#40",
    }


def test_example_applies_the_first_move():
    ex = dataset.example(row("abc", "Gm123456", "mateIn1 backRankMate short"))
    assert ex["fen"].startswith("5k2/")
    assert ex["line"] == ["d1d8"]
    assert ex["themes"] == ["mateIn1", "backRankMate"]
    assert ex["game"] == "Gm123456"


def test_split_keeps_each_game_in_one_split_and_stratifies():
    examples = []
    for g in range(400):
        theme = "fork" if g % 4 else "skewer"
        for k in range(1 + g % 3):
            examples.append({"id": f"{g}-{k}", "game": f"g{g}", "themes": [theme]})
    parts = dataset.split(examples)
    where = {ex["game"]: name for name, exs in parts.items() for ex in exs}
    assert all(where[ex["game"]] == name for name, exs in parts.items() for ex in exs)
    assert sum(len(v) for v in parts.values()) == len(examples)
    for name, share in dataset.SPLIT.items():
        counts = Counter(t for ex in parts[name] for t in ex["themes"])
        for theme in ("fork", "skewer"):
            total = sum(theme in ex["themes"] for ex in examples)
            assert abs(counts[theme] / total - share) < 0.03
