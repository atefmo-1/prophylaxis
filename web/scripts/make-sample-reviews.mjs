// Reviews the sample player's games (public/sample/games.json) in Chrome, with the same in-browser Stockfish every
// visitor uses, and saves them as public/sample/reviews.json, which the site then shows at once.
// Run with the dev server up and without an existing reviews.json:
//   node scripts/make-sample-reviews.mjs [baseUrl]
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const out = resolve(import.meta.dirname, "../public/sample/reviews.json");
if (existsSync(out)) {
  console.error("public/sample/reviews.json exists; move it away first so the sample is reviewed from scratch.");
  process.exit(1);
}
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  protocolTimeout: 0,
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(base, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.setItem("prophylaxis.player", "sample-player"));
await page.reload({ waitUntil: "networkidle0" });

const started = Date.now();
let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const pill = await page.$eval(".pill", (el) => el.textContent).catch(() => null);
  if (pill !== last && pill) console.log(`${Math.round((Date.now() - started) / 1000)}s ${pill}`);
  last = pill ?? last;
  if (pill === null && (await page.$(".rv-grid"))) break; // the queue is done and a review is showing
}

const stored = await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open("prophylaxis");
      req.onsuccess = () => {
        const get = req.result.transaction("games").objectStore("games").index("player").getAll("sample-player");
        get.onsuccess = () => resolve(get.result.map((r) => r.stored));
        get.onerror = () => reject(get.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
stored.sort((a, b) => a.review.game.t - b.review.game.t);
writeFileSync(out, JSON.stringify(stored));
console.log(`${stored.length} reviews -> ${out}`);
await browser.close();
