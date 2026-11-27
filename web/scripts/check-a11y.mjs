// Runs axe-core (WCAG 2.1 A and AA rules) on every page of the site with the sample player, in light and dark,
// at desktop and phone size, and lists what it finds. axe can't judge text drawn over the board, so the board's
// coordinates are measured here against the square each one sits on. Exits non-zero on any problem. Dev server:
//   node scripts/check-a11y.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PAGES = [
  ["start", "/", null],
  ["review summary", "/?demo", "#/"],
  ["review moves", "/?demo", "#/game/s06/76"],
  ["habits", "/?demo", "#/patterns"],
  ["practice", "/?demo", "#/practice"],
  ["puzzles", "/?demo", "#/puzzles/hangingPiece"],
  ["games", "/?demo", "#/games"],
  ["openings", "/?demo", "#/openings"],
  ["compare", "/?demo", "#/compare/sample-rival"],
];
const SIZES = [["desktop", 1280, 900], ["phone", 390, 844]];

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const found = new Map(); // rule -> { impact, help, where: Set, sample }
for (const scheme of ["light", "dark"]) {
  for (const [size, width, height] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    for (const [name, path, hash] of PAGES) {
      await page.goto(`${base}${path}`, { waitUntil: "networkidle0" });
      if (hash) {
        await page.evaluate((h) => (location.hash = h), hash);
        await new Promise((r) => setTimeout(r, 1500));
      }
      await page.evaluate(axe);
      const result = await page.evaluate(() =>
        // eslint-disable-next-line no-undef
        axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }),
      );
      const coords = await page.evaluate(() => {
        const lum = (c) => {
          const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const css = getComputedStyle(document.documentElement);
        const square = { light: css.getPropertyValue("--sq-light").trim(), dark: css.getPropertyValue("--sq-dark").trim() };
        const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")})`;
        let worst = Infinity;
        for (const wrap of document.querySelectorAll(".cg-wrap")) {
          const board = wrap.querySelector("cg-board")?.getBoundingClientRect();
          if (!board?.width) continue;
          const size = board.width / 8;
          for (const c of wrap.querySelectorAll("coords coord")) {
            const r = c.getBoundingClientRect();
            const light = (Math.floor((r.left + r.width / 2 - board.left) / size) + Math.floor((r.top + r.height / 2 - board.top) / size)) % 2 === 0;
            const [x, y] = [lum(getComputedStyle(c).color), lum(rgb(light ? square.light : square.dark))].sort((a, b) => b - a);
            worst = Math.min(worst, (x + 0.05) / (y + 0.05));
          }
        }
        return worst;
      });
      if (coords < 4.5) {
        const entry = found.get("board-coordinates") ?? { impact: "serious", help: "Board coordinates need 4.5:1 contrast with their square", where: new Set(), sample: `worst ${coords.toFixed(2)}:1` };
        entry.where.add(`${name} (${scheme}, ${size})`);
        found.set("board-coordinates", entry);
      }
      for (const v of result.violations) {
        const entry = found.get(v.id) ?? { impact: v.impact, help: v.help, where: new Set(), sample: v.nodes[0]?.target.join(" ") };
        entry.where.add(`${name} (${scheme}, ${size})`);
        found.set(v.id, entry);
      }
    }
    await page.close();
  }
}
await browser.close();
for (const [id, e] of found) {
  console.log(`${e.impact}: ${id}: ${e.help}\n  e.g. ${e.sample}\n  on ${[...e.where].slice(0, 6).join(", ")}${e.where.size > 6 ? ` and ${e.where.size - 6} more` : ""}`);
}
console.log(found.size ? `${found.size} kinds of problem` : `No problems on ${PAGES.length} pages, light and dark, desktop and phone`);
process.exit(found.size ? 1 : 0);
