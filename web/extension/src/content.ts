// Content script on chess.com. Inert until a finished game of yours is open: it never reads the board, and it
// shows nothing until chess.com's public archive lists the game (which only happens once the game is over).
import type { GameReview, MoveTag } from "../../src/types";
import { gameIdFromPath, getSettings, reviewKey, stateKey, type CheckReply, type GameState, type Message } from "./shared";

// A finished game you open is usually listed already, so check quickly at first. A game you are still playing gets
// picked up by chess.com's game-over card below; the slow check is only a fallback in case that card isn't recognised.
const POLL_MS = 5000;
const SLOW_POLL_MS = 30000;
const FAST_FOR_MS = 60 * 1000;

// After the extension is reloaded or updated, this copy of the script keeps running in tabs that were already open
// but can no longer talk to the extension ("Extension context invalidated"). Notice that and stop quietly.
let stopped = false;
const alive = () => {
  try {
    return !stopped && !!chrome.runtime?.id;
  } catch {
    return false;
  }
};

async function send<T = unknown>(message: Message): Promise<T | undefined> {
  if (!alive()) return shutdown();
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch {
    return alive() ? undefined : shutdown();
  }
}

const GRADE: Record<string, { label: string; color: string }> = {
  inaccuracy: { label: "Inaccuracy", color: "#f0b93a" },
  mistake: { label: "Mistake", color: "#e5872b" },
  miss: { label: "Miss", color: "#e8613a" },
  blunder: { label: "Blunder", color: "#ca3431" },
};

function reason(tags: MoveTag[], cls: string, reply: string | undefined): string {
  const t = tags[0];
  const d = (t?.detail ?? {}) as Record<string, unknown>;
  switch (t?.tag) {
    case "hanging_piece": return `hung your ${d.piece}`;
    case "allowed_fork": return d.by ? `walked into a ${d.by} fork` : "walked into a fork";
    case "allowed_mate": return `allowed mate in ${d.in}`;
    case "lost_material": return "lost material to a threat";
    case "allowed_discovered_attack": return "walked into a discovered attack";
    case "allowed_pin": return "walked into a pin";
    case "allowed_skewer": return "walked into a skewer";
    case "trapped_piece": return "got a piece trapped";
    case "allowed_stalemate": return "stalemated a won game";
    case "missed_free_piece": return `missed a free ${d.piece}`;
    case "missed_fork": return d.by ? `missed a ${d.by} fork` : "missed a fork";
    case "missed_mate": return `missed mate in ${d.in}`;
    case "missed_tactic": return "missed a winning tactic";
    case "missed_discovered_attack": return "missed a discovered attack";
    case "missed_pin": return "missed a pin";
    case "missed_skewer": return "missed a skewer";
    case "missed_trapped_piece": return "missed a trapped piece";
    case "time_pressure": return "went wrong in time trouble";
    case "rushed": return "moved too fast";
    default: return reply ? `it allowed ${reply}` : `a ${GRADE[cls]?.label.toLowerCase() ?? "mistake"}`;
  }
}

const CSS = `
:host { all: initial; }
.card {
  --bg: #1f2022; --ink: #ecebe8; --ink2: #b9b8b3; --ink3: #8f8e89; --line: #34363a; --raised: #28292c; --accent: #3d7cc9;
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; width: 320px; box-sizing: border-box;
  padding: 14px 16px 16px; border-radius: 10px; background: var(--bg); color: var(--ink);
  font: 14px/1.45 "Hanken Grotesk", system-ui, -apple-system, sans-serif;
  box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.6), 0 0 0 1px var(--line);
}
@media (prefers-color-scheme: light) {
  .card { --bg: #ffffff; --ink: #18191b; --ink2: #45474b; --ink3: #66686c; --line: #dededa; --raised: #ececea; --accent: #2f6db5;
    box-shadow: 0 12px 32px -14px rgb(0 0 0 / 0.35), 0 0 0 1px var(--line); }
}
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.brand { font-weight: 700; font-size: 13px; }
.close { border: 0; background: none; color: var(--ink3); font: inherit; font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
.close:hover { color: var(--ink); background: var(--raised); }
p { margin: 0 0 8px; color: var(--ink2); }
.moment { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; color: var(--ink); }
.dot { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; }
.moment b { font-weight: 650; }
.moment small { display: block; color: var(--ink3); font-size: 12px; }
.habit { padding-top: 8px; border-top: 1px solid var(--line); }
.habit b { color: var(--ink); font-weight: 650; }
.bar { height: 4px; border-radius: 2px; background: var(--raised); overflow: hidden; margin: 6px 0 8px; }
.bar span { display: block; height: 100%; background: var(--accent); transform-origin: left; transition: transform 300ms ease-out; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
button.btn { flex: 1; min-height: 34px; border: 0; border-radius: 6px; background: var(--raised); color: var(--ink); font: inherit; font-weight: 600; font-size: 13px; cursor: pointer; }
button.btn:hover { filter: brightness(1.08); }
button.primary { background: var(--accent); color: #fff; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.note { font-size: 12px; color: var(--ink3); margin: 0; }
`;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let current: string | null = null;
const dismissed = new Set<string>();

function mount(): ShadowRoot {
  if (root && host?.isConnected) return root;
  host = document.createElement("chess-coach-card");
  root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  return root;
}

function unmount() {
  host?.remove();
  host = null;
  root = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function render(id: string, state: GameState | null, review: GameReview | null) {
  if (dismissed.has(id) || !state) return unmount();
  const r = mount();
  r.replaceChildren();
  const style = el("style");
  style.textContent = CSS;
  const card = el("section", { className: "card" });
  card.setAttribute("aria-label", "Prophylaxis game review");
  const close = el("button", { className: "close", title: "Hide" }, "×");
  close.setAttribute("aria-label", "Hide");
  close.onclick = () => {
    dismissed.add(id);
    unmount();
  };
  card.append(el("div", { className: "head" }, el("span", { className: "brand" }, "Prophylaxis"), close));

  if (state.status === "analysing") {
    const fill = el("span");
    fill.style.transform = `scaleX(${state.percent / 100})`;
    card.append(
      el("p", {}, `Reviewing your game… ${state.percent}%`),
      el("div", { className: "bar" }, fill),
      el("p", { className: "note" }, "Analysed in your browser. Only finished games, never during play."),
    );
  } else if (state.status === "error") {
    const again = el("button", { className: "btn" }, "Try again");
    again.onclick = () => send({ type: "analyse", id });
    card.append(el("p", {}, `Couldn't review this game: ${state.message}`), el("div", { className: "actions" }, again));
  } else if (review) {
    const moments = review.key_moments.map((p) => review.moves[p - 1]).filter((m) => m && !m.decided);
    const biggest = [...moments].sort((a, b) => b.win_loss - a.win_loss)[0];
    if (!biggest) {
      card.append(el("p", {}, `${review.game.ending}. No mistakes or blunders from you. Accuracy ${review.game.accuracy?.toFixed(1)}.`));
    } else {
      const label = `${Math.ceil(biggest.ply / 2)}${biggest.color === "white" ? "." : "…"} ${biggest.san}`;
      const dot = el("span", { className: "dot" });
      dot.style.background = GRADE[biggest.class]?.color ?? "#8f8e89";
      card.append(
        el(
          "div",
          { className: "moment" },
          dot,
          el("span", {}, "Biggest moment: ", el("b", {}, label), `: ${reason(biggest.tags, biggest.class, biggest.reply_line[0])}.`, el("small", {}, `${GRADE[biggest.class]?.label ?? "Mistake"} · cost ${Math.round(biggest.win_loss)}% winning chances`)),
        ),
      );
      const tag = biggest.tags.find((t) => review.habits[t.tag]?.rank);
      const habit = tag && review.habits[tag.tag];
      const title = tag && review.tag_info[tag.tag]?.title;
      if (habit && title) {
        card.append(el("p", { className: "habit" }, "That's your ", el("b", {}, `#${habit.rank} habit`), ` (${title.toLowerCase()}): ${habit.recent_games} of your last ${habit.window} games.`));
      }
    }
    const retry = el("button", { className: "btn primary" }, biggest ? "Retry it" : "Open review");
    retry.onclick = () => send({ type: "open-panel", id, mode: biggest ? "moments" : "summary" });
    const full = el("button", { className: "btn" }, "Full review");
    full.onclick = () => send({ type: "open-panel", id, mode: "summary" });
    card.append(el("div", { className: "actions" }, retry, ...(biggest ? [full] : [])));
  } else {
    return unmount();
  }
  r.append(style, card);
}

async function refresh(id: string) {
  if (!alive()) return shutdown();
  let data: Record<string, unknown>;
  try {
    data = await chrome.storage.local.get([stateKey(id), reviewKey(id)]);
  } catch {
    return shutdown();
  }
  if (current !== id) return;
  render(id, (data[stateKey(id)] as GameState) ?? null, (data[reviewKey(id)] as GameReview) ?? null);
}

async function watch(id: string) {
  const started = Date.now();
  while (current === id) {
    const reply = await send<CheckReply | { error: string }>({ type: "check", id });
    if (!reply) return;
    if (current !== id) return;
    if ("result" in reply && reply.result === "finished") {
      await send({ type: "analyse", id });
      // The side panel already shows this game when it's open, so the card would only repeat it.
      if (reply.panelOpen) dismissed.add(id);
      return refresh(id);
    }
    if ("result" in reply && (reply.result === "not-mine" || reply.result === "no-player")) return;
    await new Promise((r) => setTimeout(r, Date.now() - started < FAST_FOR_MS ? POLL_MS : SLOW_POLL_MS));
  }
}

// chess.com's game-over card is the moment to open the review. It is recognised by its own controls: "Game Review"
// (a link) together with "Rematch" or "New 10 min", which only appear to the players right after a game ends;
// someone opening an old game page only gets "Game Review".
const announced = new Set<string>();

const NEW_GAME = /^(Rematch|Accept Rematch|New \d+ min|New Game)$/;

const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

function gameOverCardShown(root: ParentNode = document): boolean {
  let review = false;
  let again = false;
  for (const el of root.querySelectorAll("button, a, [role='button']")) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length > 40 || !visible(el)) continue;
    if (text === "Game Review") review = true;
    else if (NEW_GAME.test(text)) again = true;
    if (review && again) return true;
  }
  return false;
}

/** Too late to open the panel by itself: the next click anywhere on the page (closing chess.com's card, say) opens it. */
function openOnNextClick(id: string) {
  const onClick = (e: MouseEvent) => {
    document.removeEventListener("click", onClick, true);
    if (current !== id || !alive()) return;
    // Starting another game isn't the moment for a review; it stays one click away in the toolbar.
    const control = (e.target as Element | null)?.closest?.("button, a, [role='button']");
    if (control && NEW_GAME.test((control.textContent ?? "").replace(/\s+/g, " ").trim())) return;
    send({ type: "open-panel", id, mode: "summary" });
  };
  document.addEventListener("click", onClick, true);
}

let pending = 0;
const observer = new MutationObserver(() => {
  if (pending || !current || announced.has(current)) return;
  pending = window.setTimeout(async () => {
    pending = 0;
    const id = current;
    if (!id || announced.has(id) || !gameOverCardShown()) return;
    announced.add(id);
    if (!alive()) return shutdown();
    // The worker takes over from here: it waits for chess.com to list the game and starts the review.
    const open = (await getSettings().catch(() => DEFAULT_OFF)).autoOpen;
    // Chrome opens the side panel only while the page has a recent click (about 5 seconds). Check it now, after
    // the awaits above, so the worker knows whether to try.
    const gesture = navigator.userActivation?.isActive ?? false;
    if (open) {
      dismissed.add(id); // the panel shows this game, so the corner card would only repeat it
      unmount();
      if (!gesture) openOnNextClick(id);
    }
    send({ type: "game-over", id, open, gesture });
  }, 250);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

function onLocation() {
  const id = gameIdFromPath(location.pathname);
  if (id === current) return;
  current = id;
  unmount();
  if (id) watch(id);
}

const DEFAULT_OFF = { autoOpen: false };

function onStorage(changes: Record<string, chrome.storage.StorageChange>, area: string) {
  if (area !== "local" || !current) return;
  if (changes[stateKey(current)] || changes[reviewKey(current)]) refresh(current);
}

chrome.storage.onChanged.addListener(onStorage);

// chess.com is a single-page app: watch for URL changes without touching the page.
const timer = window.setInterval(() => (alive() ? onLocation() : shutdown()), 1000);
onLocation();

function shutdown(): undefined {
  if (stopped) return;
  stopped = true;
  window.clearInterval(timer);
  observer.disconnect();
  unmount();
  return undefined;
}
