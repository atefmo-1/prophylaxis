// Checks that src/analysis/planes.ts encodes exactly like ml/tactics/planes.py, on fixtures the Python side
// writes (cd ml && uv run tactics fixtures). Exits non-zero on the first mismatch.
//   node scripts/check-planes.ts ../ml/tests/fixtures/planes.json
import { readFileSync } from "node:fs";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { encode, modelLine, PLANES } from "../src/analysis/planes.ts";

const fixtures = JSON.parse(readFileSync(process.argv[2], "utf8")) as { fen: string; line: string[]; nonzero: [number, number][] }[];
let bad = 0;
for (const f of fixtures) {
  const pos = Chess.fromSetup(parseFen(f.fen).unwrap()).unwrap();
  const planes = encode(pos, modelLine(pos, f.line))!;
  const expected = new Float32Array(PLANES * 64);
  for (const [i, v] of f.nonzero) expected[i] = v;
  const diff = expected.findIndex((v, i) => v !== planes[i]);
  if (diff >= 0) {
    bad++;
    console.error(`${f.fen} ${f.line.join(" ")}: plane ${Math.floor(diff / 64)} square ${diff % 64}: ${planes[diff]} != ${expected[diff]}`);
  }
}
console.log(`${fixtures.length - bad} / ${fixtures.length} positions encode identically`);
process.exit(bad ? 1 : 0);
