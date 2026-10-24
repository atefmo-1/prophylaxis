// End-to-end check of the site for any chess.com player: the start page, the first review analysed in the browser,
// the background queue, Habits / Practice / Games once a few games are done, and that reviews survive a reload.
// Usage: node scripts/check-start.mjs <chess.com username> [baseUrl] [outDir] [games to wait for]
import puppeteer from "puppeteer-core";

const [username, base = "http://localhost:5173", out = ".", target = "5"] = process.argv.slice(2);
if (!username) {
  console.error("Give a chess.com username.");
  process.exit(1);
}
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  // The made-up player below is expected to 404; anything else failing is a real error.
  // chess.com also lists a few past months it doesn't serve (404); the app records those as empty.
  const expected = r.url().includes("no-such-player") || (r.status() === 404 && /\/games\/\d{4}\/\d{2}$/.test(r.url()));
  if (r.status() >= 400 && !expected) errors.push(`${r.status()} ${r.url()}`);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (sel) => page.$eval(sel, (el) => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const t0 = Date.now();
const secs = () => `${Math.round((Date.now() - t0) / 1000)}s`;

await page.goto(base, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${out}/1-start.png` });
console.log("START:", (await text("h1")) || "(no heading)");

// A name chess.com doesn't know
await page.type("#username", "no-such-player-xq9z7");
await page.click(".start-go");
await page.waitForSelector(".start-error", { timeout: 20000 });
console.log("UNKNOWN:", await text(".start-error"));

await page.$eval("#username", (el) => (el.value = ""));
await page.type("#username", username);
await page.click(".start-go");
await page.waitForSelector(".first, .rv-grid", { timeout: 30000 });
let shotLive = false;
while (!(await page.$(".rv-grid"))) {
  if (!shotLive && (await text(".first-foot")).match(/Position (\d+)/)?.[1] > 10) {
    shotLive = true;
    console.log(`LIVE (${secs()}):`, await text(".first h1"), "|", await text(".first-foot"));
    await page.screenshot({ path: `${out}/2-first-review.png` });
  }
  if (Date.now() - t0 > 240000) throw new Error("no review after 4 minutes");
  await wait(500);
}
console.log(`FIRST REVIEW after ${secs()}:`, await text(".summary h1"), "| pill:", await text(".pill"));
await page.screenshot({ path: `${out}/3-review.png` });

// Wait for a few more games in the background
const done = () => page.evaluate(() => {
  const m = document.querySelector(".pill")?.textContent?.match(/game (\d+) of (\d+)/);
  return m ? Number(m[1]) - 1 : null;
});
while (((await done()) ?? 999) < Number(target)) {
  if (Date.now() - t0 > 900000) throw new Error("background queue too slow");
  await wait(2000);
}
console.log(`${target} GAMES after ${secs()}, pill:`, await text(".pill"));

for (const [hash, name] of [["#/patterns", "4-habits"], ["#/practice", "5-practice"], ["#/games", "6-games"]]) {
  await page.goto(`${base}/${hash}`, { waitUntil: "networkidle0" });
  await wait(1200);
  console.log(name.toUpperCase(), ":", (await text("main")).slice(0, 160));
  await page.screenshot({ path: `${out}/${name}.png` });
}

// Reviews stay after a reload, and the player is remembered
await page.goto(base, { waitUntil: "networkidle0" });
await page.waitForSelector(".rv-grid", { timeout: 15000 });
console.log("AFTER RELOAD:", await text(".me summary"), "| review:", await text(".summary h1"));

// Phone
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(base, { waitUntil: "networkidle0" });
await wait(800);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await page.screenshot({ path: `${out}/7-phone.png` });
console.log("PHONE overflow:", overflow);
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
