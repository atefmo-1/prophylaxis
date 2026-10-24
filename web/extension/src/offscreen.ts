// Offscreen page: hosts Stockfish (WebAssembly, in a worker) and turns a finished game into a review.
import { parsePgn } from "chessops/pgn";
import { Engine, workerTransport } from "../../src/analysis/engine";
import { buildReview } from "../../src/analysis/review";
import type { Overview } from "../../src/types";
import { findGame, type Message } from "./shared";

const engine = new Engine(workerTransport(new Worker(chrome.runtime.getURL("engine/stockfish-19-lite-single.js"))));
let queue: Promise<void> = Promise.resolve();

async function loadOverview(siteUrl: string): Promise<Overview | null> {
  try {
    const res = await fetch(new URL("data/overview.json", siteUrl), { cache: "no-store" });
    return res.ok ? ((await res.json()) as Overview) : null;
  } catch {
    return null; // the site isn't running or reachable: habits are simply left out
  }
}

async function run(id: string, username: string, siteUrl: string) {
  try {
    const game = await findGame(username, id);
    if (!game) throw new Error("chess.com hasn't published this game yet.");
    const color = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
    const opponent = game[color === "white" ? "black" : "white"].username;
    const plies = [...(parsePgn(game.pgn)[0]?.moves.mainline() ?? [])].length;
    chrome.runtime.sendMessage({ type: "progress", id, percent: 0, meta: { color, opponent, plies } } satisfies Message);
    const overview = await loadOverview(siteUrl);
    const review = await buildReview(game, username, engine, overview, (done, total, stage, frame) => {
      const percent = Math.round(stage === "positions" ? (done / total) * 85 : 85 + (done / total) * 15);
      chrome.runtime.sendMessage({ type: "progress", id, percent, frame } satisfies Message);
    });
    await chrome.runtime.sendMessage({ type: "done", id, review } satisfies Message);
  } catch (e) {
    await chrome.runtime.sendMessage({ type: "failed", id, message: (e as Error).message } satisfies Message);
  }
}

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (!("target" in msg) || msg.target !== "offscreen") return;
  queue = queue.then(() => run(msg.id, msg.username, msg.siteUrl));
});
