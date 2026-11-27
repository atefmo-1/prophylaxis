"""Print unexplained mistakes with the engine facts behind each label, for checking by hand.

    python -m causes.check [n] [seed]
"""

import json
import random
import sys

import chess

from .classify import OUT, bucket, primary


def _san(fen: str, ucis: list[str], first: str | None = None) -> str:
    board = chess.Board(fen)
    out = []
    if first:
        board.push_uci(first)
    for u in ucis:
        m = chess.Move.from_uci(u)
        if m not in board.legal_moves:
            break
        out.append(board.san(m))
        board.push(m)
    return " ".join(out)


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
    rows = []
    for name in ("sample", "chesscom"):
        for line in (OUT / f"{name}.jsonl").open():
            rows += [(name, m) for m in json.loads(line)["mistakes"] if bucket(m) == "none"]
    for name, m in rng.sample(rows, min(n, len(rows))):
        threat = m["threat"]
        t = ""
        if threat:
            passed = chess.Board(m["fen"])
            passed.push(chess.Move.null())
            t = f"{threat['kind']} {threat.get('amount', threat.get('in'))} via {passed.san(chess.Move.from_uci(threat['move']))}"
        print(f"[{name}] {m['game']} ply {m['ply']} {m['phase']}  {m['san']}  -{m['loss']}% (from {m['win_before']}%)")
        print(f"   fen   {m['fen']}")
        print(f"   best  {_san(m['fen'], m['best'])}")
        print(f"   reply {_san(m['fen'], m['reply'], m['move'])}")
        print(f"   threat {t or '-'}  ignored={m['ignored_threat']}  tags={m['tags']}")
        print(f"   causes {m['causes']}  ->  {primary(m)}")
        print()


if __name__ == "__main__":
    main()
