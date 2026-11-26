// Re-tags the saved sample reviews (public/sample/reviews.json and rival-reviews.json) with the current tactic
// model, from the engine lines they kept, the way the site re-tags a visitor's older reviews. Engine values and
// grades don't change. Run it whenever tactics.json changes, with the dev server up:
//   node scripts/retag-samples.mjs [baseUrl]
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
    const { loadTacticModel, retagReview } = await import("/src/analysis/tactics.ts");
    const model = await loadTacticModel("/");
    if (!model) throw new Error("no tactic model");
    const next = [];
    for (const s of stored) next.push({ ...s, review: await retagReview(model, s.review), tagged: model.version });
    if (model.failed) throw new Error("the tactic runtime failed to start");
    return next;
  }, stored);
  const tags = (list) => list.flatMap((s) => s.review.moves.flatMap((m) => m.tags.map((t) => t.tag)));
  const before = tags(stored), after = tags(out);
  const changed = stored.reduce((n, s, i) => n + s.review.moves.filter((m, j) => JSON.stringify(m.tags) !== JSON.stringify(out[i].review.moves[j].tags)).length, 0);
  writeFileSync(path, JSON.stringify(out));
  console.log(`${file}: ${out.length} games, ${changed} moves re-tagged, ${before.length} -> ${after.length} tags, version ${out[0].tagged}`);
}
await browser.close();
