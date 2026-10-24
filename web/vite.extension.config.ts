import react from "@vitejs/plugin-react";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// The extension's pages and service worker. The content script is a classic script, built separately
// (vite.content.config.ts) because content scripts can't load ES module chunks.
export default defineConfig({
  root: resolve(import.meta.dirname, "extension"),
  base: "./",
  publicDir: resolve(import.meta.dirname, "extension/public"),
  plugins: [
    react(),
    // Stockfish lives once, in the site's public folder; the extension ships a copy.
    {
      name: "copy-engine",
      closeBundle() {
        cpSync(resolve(import.meta.dirname, "public/engine"), resolve(import.meta.dirname, "dist-extension/engine"), { recursive: true });
      },
    },
  ],
  build: {
    outDir: resolve(import.meta.dirname, "dist-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(import.meta.dirname, "extension/panel.html"),
        offscreen: resolve(import.meta.dirname, "extension/offscreen.html"),
        popup: resolve(import.meta.dirname, "extension/popup.html"),
        background: resolve(import.meta.dirname, "extension/src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
