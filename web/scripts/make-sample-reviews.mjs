// Reviews the sample player's games (public/sample/games.json) in Chrome, with the same in-browser Stockfish every
// visitor uses, and saves them as public/sample/reviews.json, which the site then shows at once. With --rival, does
// the same for the sample rival the sample player compares with (rival-games.json -> rival-reviews.json), through
// the Compare page.
// Run with the dev server up and without an existing output file:
//   node scripts/make-sample-reviews.mjs [baseUrl] [--rival]
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const rival = args.includes("--rival");
const base = args.find((a) => !a.startsWith("--")) ?? "http://localhost:5173";
const who = rival ? "sample-rival" : "sample-player";
const file = rival ? "rival-reviews.json" : "reviews.json";
const out = resolve(import.meta.dirname, `../public/sample/${file}`);
if (existsSync(out)) {
  console.error(`public/sample/${file} exists; move it away first so it's reviewed from scratch.`);
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
if (rival) await page.goto(`${base}/#/compare/sample-rival`, { waitUntil: "networkidle0" });
await page.reload({ waitUntil: "networkidle0" });

const started = Date.now();
let last = "";
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const progress = rival
    ? await page.$eval(".cmp-status", (el) => el.textContent.trim()).catch(() => null)
    : await page.$eval(".pill", (el) => el.textContent).catch(() => null);
  if (progress !== last && progress) console.log(`${Math.round((Date.now() - started) / 1000)}s ${progress}`);
  last = progress ?? last;
  // Done: the queue is empty and the result is showing.
  if (rival ? (await page.$(".cmp-tips, .cmp-head")) && !/Reviewing/.test(progress ?? "") : progress === null && (await page.$(".rv-grid"))) break;
}

const stored = await page.evaluate(
  (who) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open("prophylaxis");
      req.onsuccess = () => {
        const get = req.result.transaction("games").objectStore("games").index("player").getAll(who);
        get.onsuccess = () => resolve(get.result.map((r) => r.stored));
        get.onerror = () => reject(get.error);
      };
      req.onerror = () => reject(req.error);
    }),
  who,
);
stored.sort((a, b) => a.review.game.t - b.review.game.t);
writeFileSync(out, JSON.stringify(stored));
console.log(`${stored.length} reviews -> ${out}`);
await browser.close();
