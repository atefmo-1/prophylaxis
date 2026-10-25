// The tactic classifier (ml/, exported as public/models/tactics.onnx) running in onnxruntime-web, off the main
// thread. Receives a batch of encoded planes, answers with one probability per theme per position.
import * as ort from "onnxruntime-web/wasm";

// Pages are served without cross-origin isolation, so there are no threads to use.
ort.env.wasm.numThreads = 1;

let session: Promise<ort.InferenceSession> | null = null;

self.onmessage = async (e: MessageEvent<{ id: number; url?: string; planes?: Float32Array; n?: number }>) => {
  const { id, url, planes, n } = e.data;
  try {
    if (url) {
      session = ort.InferenceSession.create(url, { executionProviders: ["wasm"] });
      await session;
      self.postMessage({ id });
      return;
    }
    const s = await session!;
    const out = await s.run({ planes: new ort.Tensor("float32", planes!, [n!, 32, 8, 8]) });
    const probs = out.probabilities.data as Float32Array;
    self.postMessage({ id, probs }, { transfer: [probs.buffer] });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
