// The link-preview image (public/og.png, 1200x630): the sample player's Habits page. Sample data only.
// Run with the dev server up:  node scripts/make-og-image.mjs [baseUrl]
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:5173";
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.goto(`${base}/?demo`, { waitUntil: "networkidle0" });
await page.evaluate(() => (location.hash = "#/patterns"));
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: resolve(import.meta.dirname, "../public/og.png") });
await browser.close();
console.log("wrote public/og.png");
