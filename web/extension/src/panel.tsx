// Side panel: the full review of the game you just finished, the same screen as the site.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/hanken-grotesk";
import "../../src/app.css";
import { ReviewView } from "../../src/review/Review";
import { setLinkBase } from "../../src/router";
import type { GameReview } from "../../src/types";
import { DEFAULTS, getSettings, reviewKey, stateKey, type GameState, type Settings } from "./shared";
import "./panel.css";

type Request = { id: string; mode: "summary" | "moments"; at: number };

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

  return { request, state, review };
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
  const [siteUrl, setSiteUrl] = useState(DEFAULTS.siteUrl);

  useEffect(() => {
    getSettings().then((s) => {
      setSiteUrl(s.siteUrl);
      setLinkBase(s.siteUrl.replace(/\/?$/, "/"));
    });
  }, [settingsOpen]);

  let body: React.ReactNode;
  if (settingsOpen) body = <SettingsForm onDone={() => setSettingsOpen(false)} />;
  else if (!request) body = <p className="xp-empty">Finish a game on chess.com and its review appears here.</p>;
  else if (review) body = <ReviewView key={`${request.id}-${request.at}`} review={review} startMode={request.mode} />;
  else if (state?.status === "analysing")
    body = (
      <div className="xp-empty">
        <p>Reviewing your game… {state.percent}%</p>
        <div className="xp-bar">
          <span style={{ transform: `scaleX(${state.percent / 100})` }} />
        </div>
      </div>
    );
  else if (state?.status === "error") body = <p className="xp-empty">Couldn't review this game: {state.message}</p>;
  else body = <p className="xp-empty">Waiting for the game…</p>;

  return (
    <div className="xp">
      <header className="xp-top">
        <a href={siteUrl} className="xp-brand">
          Chess Coach
        </a>
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
