// End-to-end check of the review screen in a real browser, on the sample player's latest game:
// summary → key moment → wrong try → right try → what the mistake allowed → the end of the key moments.
// Usage: node scripts/check-review.mjs [baseUrl] [outDir] [wrongFrom wrongTo rightFrom rightTo]
// Without moves, it takes the right answer from the sample's review and the worst-scoring other move as the wrong one.
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? ".";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => localStorage.setItem("prophylaxis.player", "sample-player"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const coach = () => page.$eval(".coach", (el) => el.innerText).catch(() => "(no coach card)");
async function square(sq) {
  return page.$eval(
    ".rv cg-board",
    (board, sq) => {
      const r = board.getBoundingClientRect();
      const s = r.width / 8;
      const flipped = board.closest(".cg-wrap").classList.contains("orientation-black");
      const f = sq.charCodeAt(0) - 97;
      const rank = Number(sq[1]) - 1;
      const col = flipped ? 7 - f : f;
      const row = flipped ? rank : 7 - rank;
      return { x: r.left + (col + 0.5) * s, y: r.top + (row + 0.5) * s };
    },
    sq,
  );
}
async function play(from, to) {
  const a = await square(from);
  const b = await square(to);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await new Promise((r) => setTimeout(r, 500));
}

await page.goto(`${base}/#/`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${out}/1-summary.png` });
const [start] = await page.$$("xpath/.//button[contains(., 'key moment')]");
await start.click();
await new Promise((r) => setTimeout(r, 500));
console.log("MOMENT:", (await coach()).replace(/\n+/g, " | "));
await page.screenshot({ path: `${out}/2-moment.png` });

let [wrongFrom, wrongTo, rightFrom, rightTo] = process.argv.slice(4);
if (!wrongFrom) {
  const moment = await page.evaluate(async () => {
    const reviews = await (await fetch("sample/reviews.json")).json();
    const review = reviews.sort((a, b) => b.review.game.t - a.review.game.t)[0].review;
    const m = review.moves[review.key_moments[0] - 1];
    const wins = m.retry?.wins ?? {};
    const wrong = Object.keys(wins).filter((u) => !m.retry.accept.includes(u)).sort((a, b) => wins[a] - wins[b])[0];
    return { right: m.retry?.accept[0] ?? m.best_uci, wrong };
  });
  if (moment.wrong && moment.right) [wrongFrom, wrongTo, rightFrom, rightTo] = [moment.wrong.slice(0, 2), moment.wrong.slice(2, 4), moment.right.slice(0, 2), moment.right.slice(2, 4)];
}
if (wrongFrom) {
  await play(wrongFrom, wrongTo);
  console.log("WRONG:", (await coach()).replace(/\n+/g, " | "));
  await page.screenshot({ path: `${out}/3-wrong.png` });
  await play(rightFrom, rightTo);
  console.log("RIGHT:", (await coach()).replace(/\n+/g, " | "));
  await page.screenshot({ path: `${out}/4-right.png` });
}
if (wrongFrom) {
  const [threatBtn] = await page.$$("xpath/.//button[contains(., 'allowed')]");
  if (threatBtn) {
    await threatBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${out}/5-threat.png` });
  }
  for (let i = 0; i < 4; i++) {
    const [next] = await page.$$("xpath/.//button[contains(., 'Next key moment') or contains(., 'Finish')]");
    const [skip] = await page.$$("xpath/.//button[normalize-space(.)='Skip']");
    if (next) await next.click();
    else if (skip) await skip.click();
    else break;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log("END:", (await coach()).replace(/\n+/g, " | "));
}

// Phone
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`${base}/#/`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${out}/6-phone-summary.png`, fullPage: true });
// A phone widens its layout to fit content that overflows, so compare with the screen width, not innerWidth.
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 390);
console.log("PHONE OVERFLOW:", overflow);
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
