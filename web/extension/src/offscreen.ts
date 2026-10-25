// Offscreen page: hosts Stockfish and the tactic classifier (WebAssembly, each in a worker) and turns a finished
// game into a review.
import { parsePgn } from "chessops/pgn";
import { Engine, workerTransport } from "../../src/analysis/engine";
import { EnginePool } from "../../src/analysis/pool";
import { buildReview, gameFacts } from "../../src/analysis/review";
import { ANALYSIS_VERSION } from "../../src/analysis/stats";
import { loadTacticModel } from "../../src/analysis/tactics";
import type { Overview } from "../../src/types";
import { findGame, type Message, type SiteHabits } from "./shared";

// The game just ended and the next may already be starting on chess.com, so the review takes half the cores (at
// most 4) and leaves the rest for the page.
const engines = Math.min(Math.max(Math.floor((navigator.hardwareConcurrency || 2) / 2), 1), 4);
const engine = new EnginePool(
  Array.from({ length: engines }, () => new Engine(workerTransport(new Worker(chrome.runtime.getURL("engine/stockfish-19-lite-single.js"))))),
);
const tactics = loadTacticModel(chrome.runtime.getURL(""));
let queue: Promise<void> = Promise.resolve();

async function run(id: string, username: string, habits: SiteHabits | null) {
  try {
    const game = await findGame(username, id);
    if (!game) throw new Error("chess.com hasn't published this game yet.");
    const color = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
    const opponent = game[color === "white" ? "black" : "white"].username;
    const plies = [...(parsePgn(game.pgn)[0]?.moves.mainline() ?? [])].length;
    chrome.runtime.sendMessage({ type: "progress", id, percent: 0, meta: { color, opponent, plies } } satisfies Message);
    // The habits the site last sent for this player; without them, a review simply leaves habits out.
    const overview = habits?.length ? ({ weaknesses: habits } as unknown as Overview) : null;
    const review = await buildReview(game, username, engine, overview, (done, total, stage, frame) => {
      const percent = Math.round(stage === "positions" ? (done / total) * 85 : 85 + (done / total) * 15);
      chrome.runtime.sendMessage({ type: "progress", id, percent, frame } satisfies Message);
    }, await tactics);
    const facts = { player: username, facts: gameFacts(game, username), version: ANALYSIS_VERSION };
    await chrome.runtime.sendMessage({ type: "done", id, review, facts } satisfies Message);
  } catch (e) {
    await chrome.runtime.sendMessage({ type: "failed", id, message: (e as Error).message } satisfies Message);
  }
}

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (!("target" in msg) || msg.target !== "offscreen") return;
  queue = queue.then(() => run(msg.id, msg.username, msg.habits));
});
