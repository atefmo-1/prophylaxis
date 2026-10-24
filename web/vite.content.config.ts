import { resolve } from "node:path";
import { defineConfig } from "vite";

// The chess.com content script as one self-contained classic script.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, "dist-extension"),
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "extension/src/content.ts"),
      formats: ["iife"],
      name: "chessCoachContent",
      fileName: () => "content.js",
    },
  },
});
