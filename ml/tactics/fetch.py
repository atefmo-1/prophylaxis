"""Download the Lichess puzzle database (CC0) into ml/data/raw. The raw file is never committed."""

from pathlib import Path

import httpx

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "raw" / "lichess_db_puzzle.csv.zst"


def fetch(url: str = URL, out: Path = RAW) -> Path:
    """Download once; a partial download resumes, a complete one is left alone."""
    out.parent.mkdir(parents=True, exist_ok=True)
    part = out.with_suffix(out.suffix + ".part")
    with httpx.Client(follow_redirects=True, timeout=60) as client:
        size = int(client.head(url).headers["content-length"])
        if out.exists() and out.stat().st_size == size:
            return out
        have = part.stat().st_size if part.exists() else 0
        headers = {"Range": f"bytes={have}-"} if have else {}
        with client.stream("GET", url, headers=headers) as response, part.open("ab" if have else "wb") as f:
            response.raise_for_status()
            done = have
            for chunk in response.iter_bytes(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if done // (50 << 20) != (done - len(chunk)) // (50 << 20):
                    print(f"  {done >> 20} / {size >> 20} MB")
    if part.stat().st_size != size:
        raise RuntimeError(f"download incomplete: {part.stat().st_size} of {size} bytes")
    part.rename(out)
    return out
