// Checks the shipped tactic classifier end to end outside Python: planes from src/analysis/planes.ts, run by
// onnxruntime-web (WebAssembly, as in the site's worker), against the probabilities ml/tactics/fixtures.py
// recorded with Python's onnxruntime.
//   node scripts/check-tactics.ts ../ml/tests/fixtures/planes.json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import * as ort from "onnxruntime-web";
import { encode, PLANES } from "../src/analysis/planes.ts";

const fixtures = JSON.parse(readFileSync(process.argv[2], "utf8")) as { fen: string; uci: string; probabilities?: number[] }[];
const cases = fixtures.filter((f) => f.probabilities);
if (!cases.length) throw new Error("no probabilities in the fixtures: run `uv run tactics fixtures` after `export`");
ort.env.wasm.numThreads = 1;
const model = readFileSync(resolve(import.meta.dirname, "../public/models/tactics.onnx"));
const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
const planes = new Float32Array(cases.length * PLANES * 64);
cases.forEach((f, i) => encode(Chess.fromSetup(parseFen(f.fen).unwrap()).unwrap(), f.uci, planes, i * PLANES * 64));
const out = await session.run({ planes: new ort.Tensor("float32", planes, [cases.length, PLANES, 8, 8]) });
const probs = out.probabilities.data as Float32Array;
const k = cases[0].probabilities!.length;
const { thresholds } = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/models/tactics.json"), "utf8")) as { thresholds: number[] };
// Native and WebAssembly int8 kernels may round an intermediate value differently, so compare what the site
// acts on: the yes/no per theme at the shipped thresholds.
let worst = 0;
let flips = 0;
cases.forEach((f, i) =>
  f.probabilities!.forEach((p, j) => {
    const q = probs[i * k + j];
    worst = Math.max(worst, Math.abs(p - q));
    if (p >= thresholds[j] !== q >= thresholds[j]) flips++;
  }),
);
console.log(`${cases.length} positions: ${flips} of ${cases.length * k} theme decisions differ, largest probability difference ${worst.toFixed(4)}`);
process.exit(flips <= 0.005 * cases.length * k && worst < 0.1 ? 0 : 1);
