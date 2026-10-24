// Checks that the side panel opens by itself when chess.com shows its game-over card.
// Runs a visible Chrome (side panels don't exist in headless). The card is simulated on a real finished game page
// without any DevTools user gesture, so the result reflects what a player gets.
// Usage: node scripts/check-autoopen.mjs <gameId>
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const gameId = process.argv[2];
if (!gameId) {
  console.error("Give the id of a finished chess.com game played by the extension's username.");
  process.exit(1);
}
const ext = resolve(import.meta.dirname, "../dist-extension");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function trial(label, { clickFirst, addRematch, clickAfter = false }) {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
    pipe: true,
    enableExtensions: [ext],
    defaultViewport: null,
    args: ["--window-size=1300,850", `https://www.chess.com/game/live/${gameId}`],
  });
  const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"));
  const sw = await swTarget.worker();
  const page = await (await browser.waitForTarget((t) => t.type() === "page" && t.url().includes("chess.com"))).page();
  const cdp = await page.createCDPSession();
  // Wait for chess.com's card without puppeteer's evaluate helpers, which would count as a user gesture.
  for (let i = 0; i < 60; i++) {
    const { result } = await cdp.send("Runtime.evaluate", {
      userGesture: false,
      returnByValue: true,
      expression: `[...document.querySelectorAll("a")].some((a) => a.textContent.trim() === "Game Review" && a.getClientRects().length)`,
    });
    if (result.value) break;
    await wait(500);
  }
  await wait(1500);
  if (clickFirst) await page.mouse.click(60, 600); // a plain click on the page, like making a move
  await wait(1500);
  if (addRematch) {
    // chess.com's real game-over card is on the page (as a spectator sees it). Add the two buttons players get,
    // next to the real "Game Review" link, with no user gesture attached.
    const { result } = await cdp.send("Runtime.evaluate", {
      userGesture: false,
      returnByValue: true,
      expression: `(() => {
        const review = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Game Review" && a.getClientRects().length);
        if (!review) return "no real Game Review link found";
        const row = document.createElement("div");
        row.innerHTML = '<button class="cc-button-component"><span>New 10 min</span></button><button class="cc-button-component"><span>Rematch</span></button>';
        review.parentElement.appendChild(row);
        return "added";
      })()`,
    });
    console.log("   injected:", result.value);
  }
  let contexts = [];
  for (let i = 0; i < 16; i++) {
    await wait(500);
    contexts = await sw.evaluate(async () => (await chrome.runtime.getContexts({})).map((c) => c.contextType));
    if (contexts.includes("SIDE_PANEL") || contexts.includes("POPUP")) break;
  }
  if (clickAfter && !contexts.includes("SIDE_PANEL")) {
    // Too late for Chrome to open the panel by itself: the next ordinary click on the page should open it.
    console.log("   before the click:", contexts.join(","));
    await wait(2000);
    await page.bringToFront();
    await page.mouse.click(700, 120);
    for (let i = 0; i < 8 && !contexts.includes("SIDE_PANEL"); i++) {
      await wait(500);
      contexts = await sw.evaluate(async () => (await chrome.runtime.getContexts({})).map((c) => c.contextType));
    }
  }
  const opened = contexts.includes("SIDE_PANEL") ? "SIDE PANEL opened" : contexts.includes("POPUP") ? "fallback POPUP opened" : "nothing opened";
  console.log(label.padEnd(44), "->", opened);
  await wait(1000);
  await browser.close();
}

await trial("old game page (real card, spectator view)", { clickFirst: true, addRematch: false });
await trial("game just ended (real card + Rematch)", { clickFirst: true, addRematch: true });
await trial("game just ended, no click (fallback)", { clickFirst: false, addRematch: true });
await trial("game just ended, no click, then a click", { clickFirst: false, addRematch: true, clickAfter: true });
