// Side panel: the full review of the game you just finished, the same screen as the site.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/hanken-grotesk";
import "../../src/app.css";
import { Board } from "../../src/components/Board";
import { ReviewView } from "../../src/review/Review";
import { href, setLinkBase } from "../../src/router";
import type { GameReview } from "../../src/types";
import { DEFAULTS, getSettings, reviewKey, stateKey, type GameState, type Live, type Message, type Settings } from "./shared";
import "./panel.css";

type Request = { id: string; mode: "summary" | "moments"; at: number };

const send = (message: Message) => chrome.runtime.sendMessage(message).catch(() => undefined);

function useGame() {
  const [request, setRequest] = useState<Request | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);

  useEffect(() => {
    const load = async () => {
      const { panelRequest } = (await chrome.storage.session.get("panelRequest")) as { panelRequest?: Request };
      const { last } = (await chrome.storage.local.get("last")) as { last?: string };
      setRequest(panelRequest ?? (last ? { id: last, mode: "summary", at: 0 } : null));
    };
    load();
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && changes.panelRequest) setRequest(changes.panelRequest.newValue as Request);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!request) return;
    const id = request.id;
    const read = async () => {
      const data = await chrome.storage.local.get([stateKey(id), reviewKey(id)]);
      setState((data[stateKey(id)] as GameState) ?? null);
      setReview((data[reviewKey(id)] as GameReview) ?? null);
    };
    read();
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && (changes[stateKey(id)] || changes[reviewKey(id)])) read();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [request]);

  // The worker does the waiting, but Chrome may stop an idle worker. While the panel shows a game that isn't
  // reviewed yet, nudge it now and then; it ignores the nudge when it's already on it.
  const pending = !!request && !review && (!state || state.status === "waiting");
  useEffect(() => {
    if (!pending || !request) return;
    send({ type: "await", id: request.id });
    const timer = setInterval(() => send({ type: "await", id: request.id }), 15000);
    return () => clearInterval(timer);
  }, [pending, request]);

  return { request, state, review };
}

const LINES = [
  "Stockfish is reading every position of your game.",
  "Looking for the moment the game turned.",
  "Checking each mistake against your habits.",
  "Comparing your moves with your opponent's.",
  "Lining up retry puzzles from your own moves.",
];

/** While the engine works: your game replays on the board as each position is read, and the graph draws in. */
function Analysing({ percent, live }: { percent: number; live?: Live }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTip((t) => (t + 1) % LINES.length), 3200);
    return () => clearInterval(timer);
  }, []);
  const color = live?.color ?? "white";
  const wins = (live?.wins ?? []).map((w) => (color === "white" ? w : 100 - w));
  const plies = Math.max(live?.plies ?? 0, wins.length, 1);
  const now = wins[wins.length - 1] ?? 50;
  const points = wins.map((w, i) => `${(i / plies) * 100},${100 - w}`).join(" ");
  const line = percent >= 85 ? "Scoring every move you could have played instead." : LINES[tip];

  return (
    <div className="xp-live" aria-live="polite">
      <h1>{live?.opponent ? `Reviewing your game vs ${live.opponent}` : "Reviewing your game"}</h1>
      <p className="xp-live-line" key={line}>
        {line}
      </p>
      <div className="xp-live-board">
        <Board fen={live?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} orientation={color} coordinates={false} label="The engine is reading this position" />
      </div>
      <div className="xp-live-meter" aria-label={`Your winning chances ${Math.round(now)} percent`}>
        <span style={{ transform: `scaleX(${now / 100})` }} />
      </div>
      <svg className="xp-live-graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="100" y1="50" y2="50" className="mid" />
        {wins.length > 1 && <polyline points={`0,100 ${points} ${((wins.length - 1) / plies) * 100},100`} className="area" />}
        {wins.length > 1 && <polyline points={points} className="line" />}
      </svg>
      <div className="xp-live-foot">
        <span className="num">
          {percent < 85 ? `Position ${wins.length} of ${plies + 1}` : "Almost done"}
        </span>
        <span className="num">{percent}%</span>
      </div>
    </div>
  );
}

/** The game is over but chess.com hasn't listed it yet. Shows how long it has been, so it never looks stuck. */
function Waiting({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - since) / 1000));
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="xp-live" aria-live="polite">
      <h1>Your game just ended</h1>
      <p className="xp-live-line">
        Waiting for chess.com to add it to your public game archive. This usually takes a few seconds, sometimes a couple of minutes. You can leave the game page.
      </p>
      <div className="xp-live-foot">
        <span>Checking every 5 seconds</span>
        <span className="num">{elapsed}</span>
      </div>
    </div>
  );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);
  return (
    <form
      className="xp-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        await chrome.storage.sync.set({ ...settings });
        setSaved(true);
        setTimeout(onDone, 600);
      }}
    >
      <label>
        Your chess.com username
        <input value={settings.username} required onChange={(e) => setSettings({ ...settings, username: e.target.value.trim() })} />
      </label>
      <label className="xp-check">
        <input type="checkbox" checked={settings.autoOpen} onChange={(e) => setSettings({ ...settings, autoOpen: e.target.checked })} />
        Open this panel when a game ends
      </label>
      <label>
        Your Chess Coach site
        <input value={settings.siteUrl} type="url" required onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value.trim() })} />
        <small>Used for your habit history and the "see the pattern" links.</small>
      </label>
      <button type="submit" className="xp-btn xp-btn--primary">
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}

function App() {
  const { request, state, review } = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Links to the site need its address first, so nothing renders until the settings are read.
  const [siteBase, setSiteBase] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      const base = s.siteUrl.replace(/\/?$/, "/");
      setLinkBase(base);
      setSiteBase(base);
    });
  }, [settingsOpen]);

  let body: React.ReactNode;
  if (!siteBase) body = null;
  else if (settingsOpen) body = <SettingsForm onDone={() => setSettingsOpen(false)} />;
  else if (!request)
    body = (
      <p className="xp-empty">
        Finish a game on chess.com and its review appears here. Keep this panel open: it follows each game you finish.
      </p>
    );
  else if (review) body = <ReviewView key={`${request.id}-${request.at}`} review={review} startMode={request.mode} />;
  else if (state?.status === "analysing") body = <Analysing percent={state.percent} live={state.live} />;
  else if (state?.status === "waiting") body = <Waiting since={state.since} />;
  else if (state?.status === "error" || state?.status === "unlisted")
    body = (
      <div className="xp-empty">
        <p>
          {state.status === "error"
            ? `Couldn't review this game: ${state.message}`
            : "chess.com still hasn't listed this game in your public archive. It sometimes runs late."}
        </p>
        <button type="button" className="xp-btn xp-btn--primary" onClick={() => send({ type: "await", id: request.id })}>
          Check again
        </button>
      </div>
    );
  else body = <Waiting since={request.at || Date.now()} />;

  return (
    <div className="xp">
      <header className="xp-top">
        {siteBase && (
          <nav className="xp-nav" aria-label="Your Chess Coach site (opens in a new tab)" key={siteBase}>
            <a href={href({ name: "patterns" })}>Habits</a>
            <a href={href({ name: "practice", tag: null })}>Practice</a>
            <a href={href({ name: "games" })}>
              All games
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4.5 2.5h5v5M9.5 2.5 3 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </nav>
        )}
        <button type="button" className="xp-link" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}>
          {settingsOpen ? "Close settings" : "Settings"}
        </button>
      </header>
      {body}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
