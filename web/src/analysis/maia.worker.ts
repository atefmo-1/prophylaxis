// SPDX-License-Identifier: AGPL-3.0
// Maia-3 (CSSLab, AGPL-3.0; public/models/maia3.onnx) running in onnxruntime-web, off the main thread. Receives a
// batch of encoded positions with both players' ratings, answers with the model's move logits.
import * as ort from "onnxruntime-web/wasm";

ort.env.wasm.numThreads = 1;

let session: Promise<ort.InferenceSession> | null = null;

type Msg = { id: number; url?: string; tokens?: Float32Array; self?: Float32Array; oppo?: Float32Array; n?: number };

self.onmessage = async (e: MessageEvent<Msg>) => {
  const { id, url, tokens, self: mine, oppo, n } = e.data;
  try {
    if (url) {
      // Basic optimization only: the full level may fuse the int8 weights into int8 arithmetic (Python's runtime
      // does), which moves the chances away from the authors' model. scripts/check-maia.ts runs it the same way.
      session = ort.InferenceSession.create(url, { executionProviders: ["wasm"], graphOptimizationLevel: "basic" });
      await session;
      self.postMessage({ id });
      return;
    }
    const s = await session!;
    const out = await s.run({
      tokens: new ort.Tensor("float32", tokens!, [n!, 64, 96]),
      elo_self: new ort.Tensor("float32", mine!, [n!]),
      elo_oppo: new ort.Tensor("float32", oppo!, [n!]),
    });
    const logits = out.logits_move.data as Float32Array;
    self.postMessage({ id, logits }, { transfer: [logits.buffer] });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
