// Chrome Web Store images for the Prophylaxis extension, all from the sample player (no real account):
// the extension's real side panel, loaded with the sample player's latest game, and the real website pages.
// Output: docs/web-store/screenshot-1..4.png (1280x800) and promo-small.png (440x280).
// Usage: npm run build:extension && node scripts/make-store-images.mjs
import puppeteer from "puppeteer-core";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const WEB = path.resolve(import.meta.dirname, "..");
const OUT = path.resolve(WEB, "../docs/web-store");
const RAW = fs.mkdtempSync(path.join(os.tmpdir(), "store-"));
const SITE = "https://atefmo-1.github.io/prophylaxis/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const reviews = require(`${WEB}/public/sample/reviews.json`);
const latest = reviews[reviews.length - 1].review; // s36, the sample player's latest game
const id = latest.game.id;

const b = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, pipe: true, enableExtensions: [`${WEB}/dist-extension`],
  args: ["--hide-scrollbars", "--force-color-profile=srgb"],
});
const sw = await b.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"), { timeout: 15000 });
const ext = new URL(sw.url()).host;
const noMotion = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

// The side panel, as Chrome shows it: about 400px wide.
const panel = await b.newPage();
await panel.setViewport({ width: 420, height: 1010, deviceScaleFactor: 2 });
await panel.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await panel.goto(`chrome-extension://${ext}/panel.html`);
await panel.evaluate(async (id, review) => {
  await chrome.storage.sync.set({ username: "sample-player", autoOpen: true });
  await chrome.storage.local.set({ [`review:${id}`]: review, [`state:${id}`]: { status: "ready" }, last: id, recent: [id] });
}, id, latest);
async function shootPanel(mode, file, act) {
  await panel.evaluate((id, mode) => chrome.storage.session.set({ panelRequest: { id, mode, at: Date.now() } }), id, mode);
  await panel.reload({ waitUntil: "networkidle0" });
  await panel.addStyleTag({ content: noMotion });
  await wait(1200);
  if (act) await act(panel);
  await panel.screenshot({ path: `${RAW}/${file}.png` });
  console.log(file, (await panel.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 150));
}
await shootPanel("summary", "panel-summary");
await shootPanel("summary", "panel-moment", async (p) => {
  const click = async (re) => {
    const h = await p.evaluateHandle((src) => { const re = new RegExp(src); return [...document.querySelectorAll("button, [role=tab]")].find((e) => re.test(e.innerText.trim())) ?? null; }, re.source);
    if (!h.asElement()) throw new Error("no button " + re);
    await h.asElement().click();
  };
  await click(/^Review the key moment$/); await wait(1000);
  await click(/^Show the answer$/); await wait(1500);
});

// The website with the sample player.
const site = await b.newPage();
await site.evaluateOnNewDocument(() => localStorage.setItem("coach.theme", "dark"));
await site.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
async function shootSite(hash, file, act) {
  await site.goto(`${SITE}?demo#/${hash}`, { waitUntil: "networkidle0" });
  await site.addStyleTag({ content: noMotion });
  await wait(1500);
  if (act) await act(site);
  await site.screenshot({ path: `${RAW}/${file}.png` });
}
await shootSite("patterns", "site-habits");
await shootSite("patterns", "site-practice", async (p) => {
  await p.evaluate(() => [...document.querySelectorAll("button, a")].find((e) => /^Practice \d+ of these/.test(e.innerText.trim()))?.click());
  await wait(1800);
});

// Compose the store images: text on the left, the real screen on the right.
const font = fs.readFileSync(`${WEB}/node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2`).toString("base64");
const mark = fs.readFileSync(`${WEB}/public/favicon.svg`, "utf8").replace(/<style>.*<\/style>/, "<style>.t{fill:#f2ede3}.p{fill:#121821}</style>");
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${RAW}/${f}.png`).toString("base64")}`;
const css = `@font-face{font-family:H;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}body{background:#121821;color:#c4c0b7;font-family:H,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
h1{color:#f2ede3;font-weight:650;letter-spacing:-0.015em;line-height:1.12;text-wrap:balance}
.brand{display:flex;align-items:center;gap:12px;color:#f2ede3;font-weight:600;font-size:22px}.brand svg{width:36px;height:36px}`;

async function compose(file, html, w = 1280, h = 800) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><style>${css}</style>${html}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${file}.png` });
  await p.close();
}
const withPanel = (title, lines, shot) => `
<div style="display:grid;grid-template-columns:1fr 316px;gap:72px;align-items:center;height:800px;padding:0 96px 0 88px">
  <div style="display:grid;gap:28px">
    <div class="brand">${mark}Prophylaxis</div>
    <h1 style="font-size:46px">${title}</h1>
    <div style="display:grid;gap:12px;font-size:21px;line-height:1.45;max-width:31ch">${lines.map((l) => `<p>${l}</p>`).join("")}</div>
  </div>
  <img src="${img(shot)}" style="width:316px;border-radius:12px;box-shadow:0 0 0 1px #2a3240,0 30px 60px -24px #000">
</div>`;
const withSite = (title, shot) => `
<div style="height:800px;display:grid;grid-template-rows:auto 1fr;gap:28px;padding:44px 64px 0">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px"><h1 style="font-size:38px">${title}</h1><div class="brand">${mark}Prophylaxis</div></div>
  <div style="overflow:hidden;border-radius:14px 14px 0 0;box-shadow:0 0 0 1px #2a3240"><img src="${img(shot)}" style="width:100%;display:block"></div>
</div>`;

await compose("screenshot-1", withPanel("Your game, reviewed the moment it ends", [
  "Finish a game on chess.com and the review opens beside the board.",
  "The move the game turned on, accuracy and grades for both players.",
  "It runs on your computer. Nothing is uploaded.",
], "panel-summary"));
await compose("screenshot-2", withPanel("Find the better move yourself", [
  "Each key moment asks you to retry before it shows the answer.",
  "Then it shows what your move allowed, and how many players at your rating find the better one.",
], "panel-moment"));
await compose("screenshot-3", withSite("The habit behind your losses, across all your games", "site-habits"));
await compose("screenshot-4", withSite("Practise the positions you got wrong", "site-practice"));
await compose("promo-small", `
<div style="width:440px;height:280px;display:grid;align-content:center;gap:16px;padding:0 36px">
  <div class="brand" style="font-size:30px;gap:14px">${mark.replace("<svg", '<svg style="width:46px;height:46px"')}Prophylaxis</div>
  <p style="font-size:19px;line-height:1.35;color:#c4c0b7;max-width:24ch">A free chess coach that reviews each chess.com game when it ends.</p>
</div>`, 440, 280);
await b.close();
fs.rmSync(RAW, { recursive: true, force: true });
console.log(fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).join(" "));
