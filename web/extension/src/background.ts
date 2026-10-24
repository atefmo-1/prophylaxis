// Service worker: confirms a game is finished, runs analysis in the offscreen page, stores results, opens the panel,
// and shares reviews with the Prophylaxis site through the bridge script on its page.
import { ANALYSIS_VERSION, type StoredGame } from "../../src/analysis/stats";
import type { GameReview } from "../../src/types";
import {
  factsKey,
  findGame,
  getSettings,
  habitsKey,
  isPlayer,
  reviewKey,
  SITE_PLAYER,
  stateKey,
  type CheckReply,
  type CheckResult,
  type GameState,
  type Live,
  type Message,
  type ReviewFacts,
  type SiteHabits,
} from "./shared";

const KEEP = 15; // reviews kept in storage

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

async function setState(id: string, state: GameState) {
  await chrome.storage.local.set({ [stateKey(id)]: state });
}

async function panelOpen(windowId?: number): Promise<boolean> {
  const panels = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.SIDE_PANEL] });
  return panels.some((p) => windowId === undefined || p.windowId === windowId);
}

async function check(id: string): Promise<CheckReply> {
  const { username } = await getSettings();
  // Nothing to look up until the player has told the panel who they are.
  if (!username) return { result: "no-player", panelOpen: await panelOpen() };
  const game = await findGame(username, id);
  const result: CheckResult = !game ? "not-found" : isPlayer(game, username) ? "finished" : "not-mine";
  return { result, panelOpen: await panelOpen() };
}

// What the analysis has read so far, so an open panel can replay it live.
const live = new Map<string, Live>();

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: "Run Stockfish in a worker to analyse a finished chess.com game.",
  });
}

const running = new Set<string>();

async function openPopupFallback(windowId: number) {
  await chrome.action.setPopup({ popup: "popup.html" });
  try {
    await chrome.action.openPopup({ windowId });
  } finally {
    // Clicking the toolbar icon should keep opening the side panel, not this popup.
    await chrome.action.setPopup({ popup: "" });
  }
}

async function analyse(id: string) {
  const stored = await chrome.storage.local.get([reviewKey(id), stateKey(id)]);
  // An open side panel follows the game you just finished.
  await chrome.storage.session.set({ panelRequest: { id, mode: "summary", at: Date.now() } });
  if (stored[reviewKey(id)] || running.has(id)) return;
  running.add(id);
  await setState(id, { status: "analysing", percent: 0 });
  const { username } = await getSettings();
  const habits = ((await chrome.storage.local.get(habitsKey(username)))[habitsKey(username)] as SiteHabits | undefined) ?? null;
  await ensureOffscreen();
  const message: Message = { target: "offscreen", type: "analyse", id, username, habits };
  await chrome.runtime.sendMessage(message);
}

// A game that just ended takes chess.com anywhere from seconds to a couple of minutes to list in the public archive.
// The worker waits for it here, so the review starts even if the player leaves the game page in the meantime.
const WAIT_MS = 10 * 60 * 1000;
const WAIT_POLL_MS = 5000;
const waiting = new Set<string>();

async function awaitGame(id: string) {
  if (waiting.has(id) || running.has(id)) return;
  const stored = await chrome.storage.local.get([reviewKey(id), stateKey(id)]);
  if (stored[reviewKey(id)]) return analyse(id);
  const prev = stored[stateKey(id)] as GameState | undefined;
  // Keep the original start if the worker was restarted mid-wait; "Check again" after giving up starts over.
  const since = prev?.status === "waiting" ? prev.since : Date.now();
  waiting.add(id);
  try {
    await setState(id, { status: "waiting", since });
    while (Date.now() - since < WAIT_MS) {
      const { result } = await check(id).catch(() => ({ result: "not-found" as const }));
      if (result === "finished") return await analyse(id);
      if (result === "not-mine") return await setState(id, { status: "error", message: "it isn't one of your games. Check your username in Settings." });
      if (result === "no-player") return await setState(id, { status: "error", message: "the panel doesn't know your chess.com username yet." });
      await new Promise((r) => setTimeout(r, WAIT_POLL_MS));
    }
    await setState(id, { status: "unlisted" });
  } finally {
    waiting.delete(id);
  }
}

async function remember(id: string, review: unknown, facts: ReviewFacts) {
  const { recent = [] } = (await chrome.storage.local.get("recent")) as { recent?: string[] };
  const next = [id, ...recent.filter((r) => r !== id)];
  const drop = next.slice(KEEP);
  await chrome.storage.local.set({ [reviewKey(id)]: review, [factsKey(id)]: facts, recent: next.slice(0, KEEP), last: id });
  if (drop.length) await chrome.storage.local.remove(drop.flatMap((d) => [reviewKey(d), stateKey(d), factsKey(d)]));
}

/** This player's reviews, in the site's own format, so the site can show them without analysing the games again. */
async function reviewsFor(player: string): Promise<StoredGame[]> {
  const { recent = [] } = (await chrome.storage.local.get("recent")) as { recent?: string[] };
  const data = await chrome.storage.local.get(recent.flatMap((id) => [reviewKey(id), factsKey(id)]));
  return recent.flatMap((id) => {
    const review = data[reviewKey(id)] as GameReview | undefined;
    const facts = data[factsKey(id)] as ReviewFacts | undefined;
    if (!review || !facts || facts.player.toLowerCase() !== player.toLowerCase()) return [];
    // Habits depend on all of a player's games, so the site works them out again.
    return [{ review: { ...review, habits: {} }, facts: facts.facts, version: facts.version }];
  });
}

/** Messages from the Prophylaxis site's page (public/site-bridge.js). */
async function fromSite(msg: Extract<Message, { type: `site:${string}` }>): Promise<unknown> {
  switch (msg.type) {
    case "site:hello": {
      if (msg.player) await chrome.storage.local.set({ [SITE_PLAYER]: msg.player });
      const { username } = await getSettings();
      return { username: username || null, version: ANALYSIS_VERSION };
    }
    case "site:reviews":
      return reviewsFor(msg.player);
    case "site:habits":
      await chrome.storage.local.set({ [habitsKey(msg.player)]: msg.habits });
      return { ok: true };
  }
}

chrome.runtime.onMessage.addListener((msg: Message, sender, reply) => {
  if ("target" in msg) return; // meant for the offscreen page
  if (msg.type.startsWith("site:")) {
    fromSite(msg as Extract<Message, { type: `site:${string}` }>).then(reply, () => reply(null));
    return true;
  }
  switch (msg.type) {
    case "check":
      check(msg.id).then(reply, (e: Error) => reply({ error: e.message }));
      return true;
    case "analyse":
      analyse(msg.id);
      break;
    case "game-over":
      // chess.com just showed its game-over card. Chrome only lets the panel open within about 5 seconds of a click
      // on the page, which is often the case right after your own last move. Otherwise (or if Chrome refuses), the
      // toolbar popup offers a one-click "Open review", and the content script opens the panel on the next page click.
      if (msg.open && sender.tab?.id !== undefined) {
        const windowId = sender.tab.windowId;
        const fallback = async () => {
          if (!(await panelOpen(windowId))) await openPopupFallback(windowId);
        };
        if (msg.gesture) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(fallback);
        else fallback();
      }
      chrome.storage.session.set({ panelRequest: { id: msg.id, mode: "summary", at: Date.now() } });
      awaitGame(msg.id);
      break;
    case "await":
      awaitGame(msg.id);
      break;
    case "open-panel":
      // sidePanel.open needs the user's click, so call it before any await.
      if (sender.tab?.id !== undefined) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
      chrome.storage.session.set({ panelRequest: { id: msg.id, mode: msg.mode, at: Date.now() } });
      break;
    case "progress": {
      const state = live.get(msg.id) ?? { color: "white" as const, opponent: "", fen: null, wins: [], plies: 0 };
      if (msg.meta) Object.assign(state, msg.meta);
      if (msg.frame) {
        state.fen = msg.frame.fen;
        state.wins = [...state.wins, msg.frame.win];
      }
      live.set(msg.id, state);
      setState(msg.id, { status: "analysing", percent: msg.percent, live: state });
      break;
    }
    case "done":
      running.delete(msg.id);
      live.delete(msg.id);
      remember(msg.id, msg.review, msg.facts).then(() => setState(msg.id, { status: "ready" }));
      break;
    case "failed":
      running.delete(msg.id);
      setState(msg.id, { status: "error", message: msg.message });
      break;
  }
  reply();
});
