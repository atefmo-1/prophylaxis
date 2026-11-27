// SPDX-License-Identifier: AGPL-3.0
// Adds Maia-3's view of each mistake (src/analysis/maia.ts) to the saved sample reviews (public/sample/reviews.json
// and rival-reviews.json), the way the site annotates a visitor's older reviews. Nothing else changes. Run it
// whenever maia3.onnx or its rating map changes, with the dev server up:
//   node scripts/annotate-samples.mjs [baseUrl]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, protocolTimeout: 0 });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}/?demo`, { waitUntil: "networkidle0" });
for (const file of ["reviews.json", "rival-reviews.json"]) {
  const path = resolve(import.meta.dirname, `../public/sample/${file}`);
  const stored = JSON.parse(readFileSync(path, "utf8"));
  const out = await page.evaluate(async (stored) => {
    const { loadHumanModel, annotateReview } = await import("/src/analysis/maia.ts");
    const model = await loadHumanModel("/");
    if (!model) throw new Error("no Maia model");
    const next = [];
    for (const s of stored) next.push({ ...s, review: await annotateReview(model, s.review), human: model.version });
    if (model.failed) throw new Error("the Maia runtime failed to start");
    return next;
  }, stored);
  const moves = out.flatMap((s) => s.review.moves.filter((m) => m.human));
  const common = moves.filter((m) => m.human.top === m.uci).length;
  const hard = moves.filter((m) => m.human.best < 0.15).length;
  writeFileSync(path, JSON.stringify(out));
  console.log(`${file}: ${out.length} games, ${moves.length} mistakes annotated (${common} the most common move at that rating, ` +
    `${hard} with a best move under 15% of players find), version ${out[0].human}`);
}
await browser.close();
