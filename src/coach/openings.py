"""Readable opening names from chess.com ECO URLs.

chess.com slugs drop apostrophes ("Kings-Pawn-Opening-1...e5"), so we restore them and
split the name into a family ("King's Pawn Opening") and a variation ("1...e5").
"""

POSSESSIVES = {
    "Kings": "King's",
    "Queens": "Queen's",
    "Bishops": "Bishop's",
    "Birds": "Bird's",
    "Petrovs": "Petrov's",
    "Alekhines": "Alekhine's",
    "Owens": "Owen's",
    "Larsens": "Larsen's",
}
FAMILY_ENDINGS = {"Opening", "Game", "Defense", "Gambit", "Attack", "System"}
UNKNOWN = "Unclassified opening"


def parse(eco_url: str | None) -> tuple[str, str]:
    """Return (full name, family) for a chess.com ECO URL."""
    slug = (eco_url or "").rstrip("/").rsplit("/", 1)[-1]
    if not slug or slug == "Undefined":
        return UNKNOWN, UNKNOWN

    words = [POSSESSIVES.get(w, w) for w in slug.split("-")]
    # "Van-t-Kruijs" is one name
    text = " ".join(words).replace("Van t ", "Van't ")
    words = text.split(" ")

    cut = next((i + 1 for i, w in enumerate(words) if w in FAMILY_ENDINGS), min(2, len(words)))
    family = " ".join(words[:cut])
    variation = " ".join(words[cut:])
    return (f"{family}: {variation}" if variation else family), family
