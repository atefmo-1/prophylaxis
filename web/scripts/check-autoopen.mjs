// Checks that the side panel opens by itself when chess.com shows its game-over card.
// Runs a visible Chrome (side panels don't exist in headless). The card is simulated on a real finished game page
// without any DevTools user gesture, so the result reflects what a player gets.
// Usage: node scripts/check-autoopen.mjs <gameId>
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const gameId = process.argv[2] ?? "185851852898";
const ext = resolve(import.meta.dirname, "../dist-extension");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function trial(label, { clickFirst, addRematch }) {
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
  await wait(6000);
  const page = (await browser.pages()).find((p) => p.url().includes("chess.com"));
  if (clickFirst) await page.mouse.click(60, 600); // a plain click on the page, like making a move
  await wait(1500);
  if (addRematch) {
    // chess.com's real game-over card is on the page (as a spectator sees it). Add the two buttons players get,
    // next to the real "Game Review" link, with no user gesture attached.
    const cdp = await page.createCDPSession();
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
  const opened = contexts.includes("SIDE_PANEL") ? "SIDE PANEL opened" : contexts.includes("POPUP") ? "fallback POPUP opened" : "nothing opened";
  console.log(label.padEnd(44), "->", opened);
  await wait(1000);
  await browser.close();
}

await trial("old game page (real card, spectator view)", { clickFirst: true, addRematch: false });
await trial("game just ended (real card + Rematch)", { clickFirst: true, addRematch: true });
await trial("game just ended, no click (fallback)", { clickFirst: false, addRematch: true });
