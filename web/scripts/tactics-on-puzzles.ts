// Runs the shipped tactic classifier the way the site does (planes from src/analysis/planes.ts, onnxruntime-web on
// WebAssembly) over puzzles, so ml/ can score exactly what ships. Writes one {"id", "themes"} line per puzzle.
//   node scripts/tactics-on-puzzles.ts ../ml/data/puzzles/test.jsonl > ../ml/data/results/web-test.jsonl
import { createReadStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import * as ort from "onnxruntime-web";
import { encode, PLANES } from "../src/analysis/planes.ts";

const BATCH = 2048;
const meta = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/models/tactics.json"), "utf8")) as { themes: string[]; thresholds: number[] };
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(readFileSync(resolve(import.meta.dirname, "../public/models/tactics.onnx")), { executionProviders: ["wasm"] });
let ids: string[] = [];
let planes = new Float32Array(BATCH * PLANES * 64);

async function flush() {
  if (!ids.length) return;
  const out = await session.run({ planes: new ort.Tensor("float32", planes.subarray(0, ids.length * PLANES * 64), [ids.length, PLANES, 8, 8]) });
  const probs = out.probabilities.data as Float32Array;
  const k = meta.themes.length;
  const lines = ids.map((id, i) => JSON.stringify({ id, themes: meta.themes.filter((_, j) => probs[i * k + j] >= meta.thresholds[j]) }));
  process.stdout.write(lines.join("\n") + "\n");
  ids = [];
  planes = new Float32Array(BATCH * PLANES * 64);
}

for await (const text of createInterface({ input: createReadStream(process.argv[2]) })) {
  const ex = JSON.parse(text) as { id: string; fen: string; line: string[] };
  encode(Chess.fromSetup(parseFen(ex.fen).unwrap()).unwrap(), ex.line[0], planes, ids.length * PLANES * 64);
  ids.push(ex.id);
  if (ids.length === BATCH) await flush();
}
await flush();
