// Loads the built extension into Chrome, opens a finished chess.com game, and checks the card and side panel.
// Usage: node scripts/check-extension.mjs <gameId> [outDir]
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const gameId = process.argv[2] ?? "185845432402";
const out = process.argv[3] ?? ".";
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
console.log("extension id:", extId);

const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
await page.goto(`https://www.chess.com/game/live/${gameId}`, { waitUntil: "domcontentloaded" });

const started = Date.now();
let text = "";
while (Date.now() - started < 120000) {
  text = await page.evaluate(() => document.querySelector("chess-coach-card")?.shadowRoot?.querySelector(".card")?.innerText ?? "");
  if (text.includes("Biggest moment") || text.includes("No mistakes") || text.includes("Couldn't")) break;
  await wait(1000);
}
console.log(`CARD after ${Math.round((Date.now() - started) / 1000)}s:`, text.replace(/\n+/g, " | "));
await page.screenshot({ path: `${out}/ext-card.png` });

// The side panel itself: open its page in a tab with the same storage the card's button sets.
const panel = await browser.newPage();
panel.on("pageerror", (e) => errors.push(`panel: ${e.message}`));
panel.on("console", (m) => m.type() === "error" && errors.push(`panel console: ${m.text()}`));
await panel.setViewport({ width: 400, height: 900 });
await panel.goto(`chrome-extension://${extId}/panel.html`);
await panel.evaluate((id) => chrome.storage.session.set({ panelRequest: { id, mode: "moments", at: Date.now() } }), gameId);
await wait(1500);
console.log("PANEL:", (await panel.evaluate(() => document.querySelector(".coach")?.innerText ?? document.body.innerText.slice(0, 200))).replace(/\n+/g, " | "));
await panel.screenshot({ path: `${out}/ext-panel.png`, fullPage: true });
// Fair-play guard: a game that isn't in the player's public archive must never show a card.
const other = await browser.newPage();
await other.goto("https://www.chess.com/game/live/100000000001", { waitUntil: "domcontentloaded" });
await wait(15000);
const shown = await other.evaluate(() => !!document.querySelector("chess-coach-card"));
console.log("UNPUBLISHED GAME SHOWS CARD:", shown);
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
