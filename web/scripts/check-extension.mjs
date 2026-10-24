// Loads the built extension into Chrome and checks the post-game flow on a real finished chess.com game:
// the open panel follows the game and replays the analysis live, the card appears, and an unpublished game shows nothing.
// Usage: node scripts/check-extension.mjs <username> <gameId> [outDir]
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
  defaultViewport: { width: 1440, height: 900 },
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const worker = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const extId = new URL(worker.url()).host;

// The panel page, opened first: it should follow the game that finishes next.
const panel = await browser.newPage();
panel.on("pageerror", (e) => errors.push(`panel: ${e.message}`));
panel.on("console", (m) => m.type() === "error" && errors.push(`panel console: ${m.text()}`));
await panel.setViewport({ width: 400, height: 900 });
await panel.goto(`chrome-extension://${extId}/panel.html`);
// The panel asks for a username on first open; set it directly for the check.
await panel.evaluate((u) => chrome.storage.sync.set({ username: u }), username);
await panel.reload();
await wait(500);
console.log("PANEL BEFORE:", (await panel.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 140));

const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
await page.goto(`https://www.chess.com/game/live/${gameId}`, { waitUntil: "domcontentloaded" });

const started = Date.now();
let midShot = false;
let text = "";
while (Date.now() - started < 120000) {
  const live = await panel.evaluate(() => document.querySelector(".xp-live")?.innerText ?? "");
  if (live && !midShot && /Position (\d+)/.test(live) && Number(live.match(/Position (\d+)/)[1]) > 8) {
    midShot = true;
    console.log("PANEL LIVE:", live.replace(/\n+/g, " | "));
    await panel.screenshot({ path: `${out}/ext-live.png` });
  }
  text = await page.evaluate(() => document.querySelector("chess-coach-card")?.shadowRoot?.querySelector(".card")?.innerText ?? "");
  if (text.includes("Biggest moment") || text.includes("No mistakes") || text.includes("Couldn't")) break;
  await wait(400);
}
console.log(`CARD after ${Math.round((Date.now() - started) / 1000)}s:`, text.replace(/\n+/g, " | "));
await wait(800);
console.log("PANEL AFTER:", (await panel.evaluate(() => document.querySelector(".summary")?.innerText ?? document.body.innerText)).replace(/\n+/g, " | ").slice(0, 160));
await panel.screenshot({ path: `${out}/ext-panel.png` });
await page.screenshot({ path: `${out}/ext-card.png` });

// Fair-play guard: a game that isn't in the player's public archive must never show a card.
const other = await browser.newPage();
await other.goto("https://www.chess.com/game/live/100000000001", { waitUntil: "domcontentloaded" });
await wait(12000);
console.log("UNPUBLISHED GAME SHOWS CARD:", await other.evaluate(() => !!document.querySelector("chess-coach-card")));
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
