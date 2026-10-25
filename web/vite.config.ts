import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" lets the built site run from any sub-path (a portfolio sub-folder, GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
  // The tactic classifier's worker loads onnxruntime-web, which needs an ES module worker.
  worker: { format: "es" },
});
