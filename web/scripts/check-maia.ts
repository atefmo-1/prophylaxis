// SPDX-License-Identifier: AGPL-3.0
// Checks that src/analysis/maia.ts encodes positions and numbers moves exactly as the Maia-3 authors' code does, and
// that the shipped model gives the same chances here as in Python, on fixtures the Python side writes
// (cd ml && python -m maia.export fixtures). Exits non-zero on any mismatch.
//   node scripts/check-maia.ts ../tests/fixtures/maia.json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ort from "onnxruntime-web/wasm";
import { encode, legalChances, legalUcis, moveIndex, MOVES, WIDTH } from "../src/analysis/maia.ts";

interface Fixture {
  fens: string[];
  self: number;
  oppo: number;
  nonzero: number[];
  legal: { [uci: string]: number };
  probs: { [uci: string]: number };
}

const fixtures = JSON.parse(readFileSync(process.argv[2], "utf8")) as Fixture[];
let bad = 0;
const fail = (f: Fixture, why: string) => {
  bad++;
  console.error(`${f.fens[f.fens.length - 1]}: ${why}`);
};

const tokens = new Float32Array(fixtures.length * 64 * WIDTH);
fixtures.forEach((f, i) => {
  const mine = encode(f.fens);
  const expected = new Float32Array(64 * WIDTH);
  for (const k of f.nonzero) expected[k] = 1;
  const diff = expected.findIndex((v, k) => v !== mine[k]);
  if (diff >= 0) fail(f, `square ${Math.floor(diff / WIDTH)} column ${diff % WIDTH}: ${mine[diff]} != ${expected[diff]}`);
  tokens.set(mine, i * 64 * WIDTH);
  const fen = f.fens[f.fens.length - 1];
  const legal = legalUcis(fen).sort();
  const want = Object.keys(f.legal).sort();
  if (legal.join() !== want.join()) fail(f, `legal moves ${legal.join(" ")} != ${want.join(" ")}`);
  const black = fen.split(" ")[1] === "b";
  for (const [uci, index] of Object.entries(f.legal)) if (moveIndex(uci, black) !== index) fail(f, `${uci} is ${moveIndex(uci, black)}, not ${index}`);
});
console.log(`${fixtures.length - bad} / ${fixtures.length} positions encode and number their moves identically`);

ort.env.wasm.numThreads = 1;
const model = readFileSync(resolve(import.meta.dirname, "../public/models/maia3.onnx"));
const n = fixtures.length;
// The fixtures hold the authors' model's own chances (PyTorch). The shipped file stores its weights as int8, so
// small differences are expected. Basic graph optimization, as in src/analysis/maia.worker.ts: the full level may fuse
// the int8 weights into int8 arithmetic, as Python's runtime does, which moves chances further.
const MAX = 0.03;
const MEAN = 0.001;
const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "basic" });
const out = await session.run({
  tokens: new ort.Tensor("float32", tokens, [n, 64, WIDTH]),
  elo_self: new ort.Tensor("float32", Float32Array.from(fixtures, (f) => f.self), [n]),
  elo_oppo: new ort.Tensor("float32", Float32Array.from(fixtures, (f) => f.oppo), [n]),
});
const logits = out.logits_move.data as Float32Array;
let worst = 0;
let sum = 0;
let count = 0;
let agree = 0;
fixtures.forEach((f, i) => {
  const got = legalChances(logits, i * MOVES, f.fens[f.fens.length - 1]);
  const top = (get: (u: string) => number) => Object.keys(f.probs).reduce((a, b) => (get(b) > get(a) ? b : a));
  if (top((u) => got.get(u)!) === top((u) => f.probs[u])) agree++;
  for (const [uci, p] of Object.entries(f.probs)) {
    const d = Math.abs((got.get(uci) ?? -1) - p);
    worst = Math.max(worst, d);
    sum += d;
    count++;
  }
});
const close = worst <= MAX && sum / count <= MEAN;
if (!close) bad++;
console.log(`Chances in the browser runtime: largest difference from PyTorch ${worst.toFixed(4)}, mean ${(sum / count).toFixed(5)}, ` +
  `same top move in ${agree} / ${n}${close ? "" : " (too far)"}`);
process.exit(bad ? 1 : 0);
