// The extension and the site together: the panel asks for a username on first open, reviews a finished game, and the
// site (dev server) then offers to continue as that player and shows the game without analysing it again; the site's
// habits reach the extension. Needs the dev server running and a fresh build of the extension.
// Usage: node scripts/check-bridge.mjs <chess.com username> [siteUrl] [outDir]
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const [username, site = "http://localhost:5173", out = "."] = process.argv.slice(2);
if (!username) {
  console.error("Give a chess.com username.");
  process.exit(1);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

// The player's latest finished standard game, to review in the extension.
const UA = { headers: { "User-Agent": "prophylaxis/0.1 (check-bridge)" } };
const archives = (await (await fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`, UA)).json()).archives;
const month = (await (await fetch(archives.at(-1), UA)).json()).games.filter((g) => g.rules === "chess");
const latest = month.sort((a, b) => b.end_time - a.end_time)[0];
const gameId = latest.url.split("/").pop();

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  pipe: true,
  enableExtensions: [resolve(import.meta.dirname, "../dist-extension")],
});
const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"));
const sw = await swTarget.worker();
const extId = new URL(swTarget.url()).host;

// 1. First open: the panel asks who you are
const panel = await browser.newPage();
panel.on("pageerror", (e) => errors.push(`panel: ${e.message}`));
await panel.setViewport({ width: 360, height: 800 });
await panel.goto(`chrome-extension://${extId}/panel.html`);
await panel.waitForSelector(".xp-welcome", { timeout: 10000 });
console.log("FIRST OPEN:", await panel.$eval(".xp-welcome h1", (el) => el.textContent), "| settings button:", !!(await panel.$(".xp-top .xp-link")));
await panel.type(".xp-welcome input", "no-such-player-xq9z7");
await panel.click(".xp-welcome button[type=submit]");
await panel.waitForSelector(".xp-error", { timeout: 15000 });
console.log("UNKNOWN NAME:", await panel.$eval(".xp-error", (el) => el.textContent));
await panel.$eval(".xp-welcome input", (el) => (el.value = ""));
await panel.click(".xp-welcome input", { clickCount: 3 });
await panel.keyboard.press("Backspace");
await panel.type(".xp-welcome input", username);
await panel.click(".xp-welcome button[type=submit]");
await panel.waitForSelector(".xp-empty", { timeout: 15000 });
console.log("SAVED:", await sw.evaluate(() => chrome.storage.sync.get("username").then((d) => d.username)));

// 2. The extension reviews the latest game
await panel.evaluate((id) => chrome.runtime.sendMessage({ type: "game-over", id, open: false, gesture: false }), gameId);
await panel.waitForSelector(".summary", { timeout: 180000 });
console.log("EXTENSION REVIEWED:", gameId, "|", await panel.$eval(".summary h1", (el) => el.textContent));
await panel.evaluate(() => [...document.querySelectorAll(".xp-top button")].find((b) => b.textContent === "Settings").click());
await wait(300);
console.log("SETTINGS:", (await panel.$eval(".xp-settings", (el) => el.innerText)).replace(/\n+/g, " | "));

// 3. The site offers the extension's player and shows that game without analysing it
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`site: ${e.message}`));
await page.setViewport({ width: 1280, height: 800 });
await page.goto(site, { waitUntil: "networkidle0" });
await page.waitForSelector(".start-known", { timeout: 5000 });
console.log("START OFFERS:", await page.$eval(".start-known", (el) => el.innerText.replace(/\n+/g, " | ")));
const t0 = Date.now();
await page.click(".start-known button");
await page.waitForSelector(".rv-grid", { timeout: 20000 });
const shown = await page.evaluate(() => location.hash || "(latest)");
const pill = await page.$eval(".pill", (el) => el.textContent).catch(() => "(none)");
console.log(`SITE REVIEW after ${Date.now() - t0} ms:`, await page.$eval(".summary h1", (el) => el.textContent), "| route:", shown, "| pill:", pill);
const imported = await page.evaluate(
  (id) =>
    new Promise((res) => {
      const req = indexedDB.open("prophylaxis");
      req.onsuccess = () => {
        const g = req.result.transaction("games").objectStore("games").getAllKeys();
        g.onsuccess = () => res(g.result.some((k) => String(k).endsWith(`/${id}`)));
      };
    }),
  gameId,
);
console.log("GAME IN SITE STORE:", imported);

// 4. The site's habits reach the extension
let habits = null;
for (let i = 0; i < 90 && !habits; i++) {
  habits = await sw.evaluate((u) => chrome.storage.local.get(`habits:${u}`).then((d) => d[`habits:${u}`] ?? null), username.toLowerCase());
  if (!habits) await wait(2000);
}
console.log("HABITS IN EXTENSION:", habits ? habits.map((h) => h.tag).slice(0, 4).join(", ") : "none");
console.log("SITE PLAYER SEEN BY EXTENSION:", await sw.evaluate(() => chrome.storage.local.get("sitePlayer").then((d) => d.sitePlayer)));
await panel.screenshot({ path: `${out}/bridge-panel.png` });
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
