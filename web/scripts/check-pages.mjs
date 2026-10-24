// Screenshots of every page at desktop and phone size, plus one real practice attempt.
// Usage: node scripts/check-pages.mjs [baseUrl] [outDir]
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? ".";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
// Optional theme: node scripts/check-pages.mjs <base> <out> light|dark
const theme = process.argv[4];
if (theme) await page.evaluateOnNewDocument((t) => localStorage.setItem("coach.theme", t), theme);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, w, h, mobile] of [["desktop", 1440, 900, false], ["phone", 390, 844, true]]) {
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  for (const route of ["", "patterns", "games", "practice"]) {
    await page.goto(`${base}/#/${route}`, { waitUntil: "networkidle0" });
    await wait(400);
    await page.screenshot({ path: `${out}/${route || "review"}-${name}${theme ? `-${theme}` : ""}.png`, fullPage: route !== "practice" && route !== "" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) errors.push(`${route} ${name}: horizontal overflow ${overflow}px`);
  }
}

// Practice: try the accepted answer of the first position
await page.setViewport({ width: 1440, height: 900 });
await page.evaluate(() => localStorage.removeItem("coach.practice.v1"));
await page.goto(`${base}/#/practice`, { waitUntil: "networkidle0" });
const first = await page.evaluate(async () => {
  const pool = await (await fetch("data/practice.json")).json();
  return pool;
});
const prompt = await page.$eval(".coach h2", (el) => el.textContent);
const target = first.find((p) => prompt.includes(`played ${p.ply % 2 ? Math.ceil(p.ply / 2) + "." : Math.ceil(p.ply / 2) + "…"} ${p.san}`));
console.log("PROMPT:", prompt, "| matched:", target?.id, "accept:", target?.accept?.[0]);
if (target) {
  const uci = target.accept[0];
  const pos = async (sq) =>
    page.$eval(".rv cg-board", (b, sq) => {
      const r = b.getBoundingClientRect(); const s = r.width / 8;
      const flip = b.closest(".cg-wrap").classList.contains("orientation-black");
      const f = sq.charCodeAt(0) - 97, rk = +sq[1] - 1;
      return { x: r.left + ((flip ? 7 - f : f) + 0.5) * s, y: r.top + ((flip ? rk : 7 - rk) + 0.5) * s };
    }, sq);
  const a = await pos(uci.slice(0, 2)); const b = await pos(uci.slice(2, 4));
  await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y); await wait(500);
  console.log("AFTER:", (await page.$eval(".coach", (el) => el.innerText)).replace(/\n+/g, " | "));
  await page.screenshot({ path: `${out}/practice-solved.png` });
  const stored = await page.evaluate(() => localStorage.getItem("coach.practice.v1"));
  console.log("STORED:", stored);
}
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
