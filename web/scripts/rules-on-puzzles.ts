// Runs the site's motif rules (src/analysis/motifs.ts) over puzzles, for the ML baseline (ml/tactics/rules.py
// explains the framing). Reads JSONL from ml/tactics, writes one {"id", "tags"} line per puzzle.
//   node scripts/rules-on-puzzles.ts ../ml/data/puzzles/test.jsonl > ../ml/data/rules-ts-test.jsonl
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { detect, toMove } from "../src/analysis/motifs.ts";

for await (const text of createInterface({ input: createReadStream(process.argv[2]) })) {
  const ex = JSON.parse(text) as { id: string; fen_before: string; blunder: string; line: string[] };
  const before = Chess.fromSetup(parseFen(ex.fen_before).unwrap()).unwrap();
  const move = toMove(before, ex.blunder)!;
  const after = before.clone();
  after.play(move);
  // Mate-in-N for the solver if the solution ends in mate (white POV), as the engine would report it.
  const end = after.clone();
  for (const uci of ex.line) end.play(toMove(end, uci)!);
  const n = Math.ceil(ex.line.length / 2);
  const mate = end.isCheckmate() ? (after.turn === "white" ? n : -n) : null;
  const sign = after.turn === "white" ? 1 : -1;
  const tags = detect(before, move, [], [{ cp: mate === null ? sign * 1000 : null, mate, pv: ex.line }], 100, null, null);
  process.stdout.write(JSON.stringify({ id: ex.id, tags }) + "\n");
}
