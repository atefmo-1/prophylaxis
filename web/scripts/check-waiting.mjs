// Checks that the worker, not the game tab, waits for chess.com to list a game that just ended: the panel shows the
// waiting view, then the live analysis, then the review, with no chess.com page open at all.
// Usage: node scripts/check-waiting.mjs <username> <gameId> [outDir]
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const [username, gameId] = process.argv.slice(2);
if (!username || !gameId) {
  console.error("Give a chess.com username and the id of a finished game they played.");
  process.exit(1);
}
const out = process.argv[4] ?? ".";
const ext = resolve(import.meta.dirname, "../dist-extension");
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  pipe: true,
  enableExtensions: [ext],
  defaultViewport: { width: 400, height: 900 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const worker = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const extId = new URL(worker.url()).host;
const panel = await browser.newPage();
panel.on("pageerror", (e) => errors.push(`panel: ${e.message}`));
panel.on("console", (m) => m.type() === "error" && errors.push(`panel console: ${m.text()}`));
await panel.goto(`chrome-extension://${extId}/panel.html`);
// The panel asks for a username on first open; set it directly for the check.
await panel.evaluate((u) => chrome.storage.sync.set({ username: u }), username);
await panel.reload();
await wait(500);

// What the content script sends when chess.com shows its game-over card (the tab is then closed or navigated away).
await panel.evaluate((id) => chrome.runtime.sendMessage({ type: "game-over", id, open: false }), gameId);

const seen = [];
const started = Date.now();
while (Date.now() - started < 120000) {
  const view = await panel.evaluate(() =>
    document.querySelector(".summary") ? "review" : document.querySelector(".xp-live-board") ? "analysing" : document.querySelector(".xp-live h1")?.textContent === "Your game just ended" ? "waiting" : document.body.innerText.slice(0, 80),
  );
  if (seen.at(-1) !== view) {
    seen.push(view);
    console.log(`${Math.round((Date.now() - started) / 1000)}s: ${view}`);
    if (view === "waiting") await panel.screenshot({ path: `${out}/ext-waiting.png` });
  }
  if (view === "review") break;
  await wait(300);
}

// A game chess.com hasn't listed: the panel must keep showing the waiting view with a running clock, not a review.
await panel.evaluate(() => chrome.runtime.sendMessage({ type: "game-over", id: "100000000001", open: false }));
await wait(7000);
console.log("UNLISTED:", (await panel.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 220));

console.log("FLOW:", seen.join(" → "));
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
