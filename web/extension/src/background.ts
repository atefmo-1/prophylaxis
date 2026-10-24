// Service worker: confirms a game is finished, runs analysis in the offscreen page, stores results, opens the panel.
import { findGame, getSettings, isPlayer, reviewKey, stateKey, type CheckResult, type GameState, type Message } from "./shared";

const KEEP = 15; // reviews kept in storage

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

async function setState(id: string, state: GameState) {
  await chrome.storage.local.set({ [stateKey(id)]: state });
}

async function check(id: string): Promise<CheckResult> {
  const { username } = await getSettings();
  const game = await findGame(username, id);
  if (!game) return "not-found";
  return isPlayer(game, username) ? "finished" : "not-mine";
}

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

async function analyse(id: string) {
  const stored = await chrome.storage.local.get([reviewKey(id), stateKey(id)]);
  if (stored[reviewKey(id)] || running.has(id)) return;
  running.add(id);
  await setState(id, { status: "analysing", percent: 0 });
  const { username, siteUrl } = await getSettings();
  await ensureOffscreen();
  const message: Message = { target: "offscreen", type: "analyse", id, username, siteUrl };
  await chrome.runtime.sendMessage(message);
}

async function remember(id: string, review: unknown) {
  const { recent = [] } = (await chrome.storage.local.get("recent")) as { recent?: string[] };
  const next = [id, ...recent.filter((r) => r !== id)];
  const drop = next.slice(KEEP);
  await chrome.storage.local.set({ [reviewKey(id)]: review, recent: next.slice(0, KEEP), last: id });
  if (drop.length) await chrome.storage.local.remove(drop.flatMap((d) => [reviewKey(d), stateKey(d)]));
}

chrome.runtime.onMessage.addListener((msg: Message, sender, reply) => {
  if ("target" in msg) return; // meant for the offscreen page
  switch (msg.type) {
    case "check":
      check(msg.id).then(reply, (e: Error) => reply({ error: e.message }));
      return true;
    case "analyse":
      analyse(msg.id);
      break;
    case "open-panel":
      // sidePanel.open needs the user's click, so call it before any await.
      if (sender.tab?.id !== undefined) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
      chrome.storage.session.set({ panelRequest: { id: msg.id, mode: msg.mode, at: Date.now() } });
      break;
    case "progress":
      setState(msg.id, { status: "analysing", percent: msg.percent });
      break;
    case "done":
      running.delete(msg.id);
      remember(msg.id, msg.review).then(() => setState(msg.id, { status: "ready" }));
      break;
    case "failed":
      running.delete(msg.id);
      setState(msg.id, { status: "error", message: msg.message });
      break;
  }
  reply();
});
