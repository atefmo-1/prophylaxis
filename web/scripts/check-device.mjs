// The device-aware review on a fast laptop or a slow phone: the speed check, how many engines and games it picks, how
// long the first review takes, whether the time left is honest, and pausing (by hand and on a low battery).
// "phone" has a phone's screen, user agent, 8 cores and 4 GB (so it gets 2 engines), and runs Chrome on the Mac's
// efficiency cores (taskpolicy -c utility; set SLOW="-b" for a much slower, very old device). Chrome's own CPU throttling
// doesn't reach the engine workers, so it's only used for the page.
// Usage: node scripts/check-device.mjs <chess.com username> [laptop|phone] [baseUrl] [outDir] [games to wait for]
import puppeteer from "puppeteer-core";

const [username, kind = "laptop", base = "http://localhost:5173", out = ".", wantArg] = process.argv.slice(2);
if (!username) {
  console.error("Give a chess.com username.");
  process.exit(1);
}
const phone = kind === "phone";
const want = Number(wantArg ?? (phone ? 3 : 8));
const THROTTLE = 4;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let executablePath = CHROME;
if (phone) {
  const { mkdtempSync, writeFileSync, chmodSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  executablePath = `${mkdtempSync(`${tmpdir()}/slow-chrome-`)}/chrome`;
  writeFileSync(executablePath, `#!/bin/sh\nexec /usr/sbin/taskpolicy ${process.env.SLOW ?? "-c utility"} "${CHROME}" "$@"\n`);
  chmodSync(executablePath, 0o755);
}
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  protocolTimeout: 1_800_000,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const secs = () => Math.round((Date.now() - t0) / 1000);
const text = (sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => "");

// A battery the test controls; it starts full and charging.
await page.evaluateOnNewDocument(() => {
  const battery = new EventTarget();
  battery.charging = true;
  battery.level = 0.9;
  navigator.getBattery = () => Promise.resolve(battery);
  window.__battery = battery;
});

if (phone) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    { mobile: true, platform: "Android", platformVersion: "14", architecture: "", model: "Pixel 7", brands: [{ brand: "Chromium", version: "130" }], fullVersion: "130.0.0.0" },
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 4 });
  });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
} else {
  await page.setViewport({ width: 1280, height: 800 });
}

// A fresh visitor: no saved speed, budget or reviews.
await page.goto(base, { waitUntil: "networkidle0" });
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise((r) => {
    const req = indexedDB.deleteDatabase("prophylaxis");
    req.onsuccess = req.onerror = req.onblocked = r;
  });
});
await page.goto(base, { waitUntil: "networkidle0" });
await page.type("#username", username);
const started = Date.now();
await page.click(".start-go");
await page.waitForSelector(".first, .rv-grid", { timeout: 60000 });

const profile = async () => page.evaluate(() => JSON.parse(localStorage.getItem("prophylaxis.device") ?? "null"));
const target = async () => page.evaluate((u) => localStorage.getItem(`prophylaxis.target.${u.toLowerCase()}`), username);
for (let i = 0; i < 120 && !(await profile()); i++) await wait(500);
console.log(`SPEED CHECK after ${secs()}s:`, JSON.stringify(await profile()), "| games to review:", await target());

let firstEta = null;
while (!(await page.$(".rv-grid"))) {
  const foot = await text(".first-foot");
  if (!firstEta && /left/.test(foot)) {
    firstEta = foot;
    console.log(`FIRST GAME at ${secs()}s:`, foot);
    await page.screenshot({ path: `${out}/device-${kind}-first.png` });
  }
  if (Date.now() - started > 900000) throw new Error("no review after 15 minutes");
  await wait(500);
}
console.log(`FIRST REVIEW after ${Math.round((Date.now() - started) / 1000)}s | pill: ${await text(".pill")}`);
await page.screenshot({ path: `${out}/device-${kind}-review.png` });

// Is the time left honest? Note it now, and again a few games later.
const state = () =>
  page.evaluate(() => {
    const t = document.querySelector(".pill")?.textContent ?? "";
    const m = t.match(/game (\d+) of (\d+)/);
    const eta = t.match(/about (\d+) (s|min|h)/);
    const ms = eta ? Number(eta[1]) * { s: 1000, min: 60000, h: 3600000 }[eta[2]] : null;
    return { text: t, game: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, eta: ms };
  });
let a = await state();
while (a.game === null && (await page.$(".pill"))) {
  await wait(1000);
  a = await state();
}
const aAt = Date.now();
console.log(`QUEUE at ${secs()}s:`, a.text);
let b = a;
while (b.game !== null && b.game < a.game + want) {
  if (Date.now() - aAt > 1_500_000) throw new Error("queue too slow");
  await wait(2000);
  b = await state();
}
const took = Date.now() - aAt;
const games = (b.game ?? a.total + 1) - a.game;
console.log(
  `${games} GAMES in ${Math.round(took / 1000)}s (${(took / 1000 / games).toFixed(1)} s/game); time left went from ${a.eta / 1000}s to ${b.eta === null ? "done" : b.eta / 1000 + "s"} (should drop by about ${Math.round(took / 1000)}s)`,
);

// Pausing by hand: nothing moves while paused, and it picks up again.
const percent = () => page.evaluate(() => document.querySelector(".pill-bar span")?.style.transform ?? "");
if (await page.$(".pill")) {
  const menu = async (label) => {
    await page.click(".me summary");
    await wait(300);
    const clicked = await page.evaluate((label) => {
      const b = [...document.querySelectorAll(".me-menu button")].find((x) => x.textContent.startsWith(label));
      b?.click();
      return b?.textContent ?? null;
    }, label);
    return clicked;
  };
  // A laptop pauses from the button in the top bar; a phone from the player menu.
  const toggle = async (label) => (phone ? menu(label) : page.$eval(".pill-btn", (b) => (b.click(), b.getAttribute("aria-label"))).catch(() => null));
  console.log("PAUSE:", await toggle("Pause reviewing"));
  await wait(3000); // the search already running finishes
  const p1 = await percent();
  await wait(10000);
  const p2 = await percent();
  console.log(`PAUSED: ${p1 === p2 ? "held" : "MOVED"} (${p1} -> ${p2}) | pill: ${await text(".pill")}`);
  await page.screenshot({ path: `${out}/device-${kind}-paused.png` });
  console.log("RESUME:", await toggle("Resume reviewing"));
  await wait(8000);
  console.log(`RESUMED: ${(await percent()) !== p2 ? "moving" : "STUCK"} | pill: ${await text(".pill")}`);

  // A low battery, not charging, pauses; plugging in resumes.
  await page.evaluate(() => {
    Object.assign(window.__battery, { charging: false, level: 0.15 });
    window.__battery.dispatchEvent(new Event("levelchange"));
  });
  await wait(1000);
  console.log("LOW BATTERY:", await text(".pill"));
  await page.evaluate(() => {
    window.__battery.charging = true;
    window.__battery.dispatchEvent(new Event("chargingchange"));
  });
  await wait(1000);
  console.log("CHARGING:", await text(".pill"));
}

await page.goto(`${base}/#/games`, { waitUntil: "networkidle0" });
await wait(1000);
console.log("GAMES PAGE:", await text(".page-top"));
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
