import { nameOf, profileUrl, siteName } from "./lib/player";
import { useEffect, useRef, useState } from "react";
import { HoldButton } from "./components/HoldButton";
import { Mark } from "./components/Mark";
import { ComparePill, pausedLabel, ProgressPill } from "./components/Progress";
import { useOverview } from "./data";
import { canChooseCounting, countPage, counting, setCounting } from "./lib/analytics";
import { REPO, timeLeft } from "./lib/format";
import { usePill } from "./lib/motion";
import { useTheme, type ThemeChoice } from "./lib/theme";
import { ComparisonProvider, useCurrentComparison } from "./library/Comparison";
import { LibraryProvider, useLibrary, useLibraryStatus } from "./library/Library";
import { Compare } from "./pages/Compare";
import { Games } from "./pages/Games";
import { Habits } from "./pages/Habits";
import { Openings } from "./pages/Openings";
import { Practice } from "./pages/Practice";
import { Puzzles } from "./pages/Puzzles";
import { Start } from "./pages/Start";
import { Review } from "./review/Review";
import { href, useRoute, type Route } from "./router";

const NAV: { label: string; route: Route; match: Route["name"][] }[] = [
  { label: "Review", route: { name: "latest" }, match: ["latest", "game"] },
  { label: "Habits", route: { name: "patterns" }, match: ["patterns"] },
  { label: "Practice", route: { name: "practice", tag: null }, match: ["practice", "puzzles"] },
  { label: "Games", route: { name: "games" }, match: ["games"] },
  { label: "Openings", route: { name: "openings" }, match: ["openings"] },
  { label: "Compare", route: { name: "compare", player: null }, match: ["compare"] },
];

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeSwitch() {
  const [choice, setChoice] = useTheme();
  const pill = usePill<HTMLDivElement>();
  return (
    <div className="theme" ref={pill} role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button key={t.value} type="button" aria-pressed={choice === t.value} onClick={() => setChoice(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Anonymous usage counts on or off for this browser (lib/analytics.ts). */
function CountingSwitch() {
  const [on, setOn] = useState(counting);
  return (
    <button
      type="button"
      onClick={() => {
        setCounting(!on);
        setOn(!on);
      }}
    >
      {on ? "Stop counting my visits" : "Count my visits again"}
      <span className="me-note">
        {on ? "Pages opened and a few actions are counted anonymously: never your username or games." : "Nothing is counted from this browser."}
      </span>
    </button>
  );
}

/** The player this browser follows, with switching and deleting their data. */
function PlayerMenu({ player }: { player: string }) {
  const { leave, forgetPlayer, isSample, pause, resume } = useLibrary();
  const status = useLibraryStatus();
  const overview = useOverview();
  const player_ = overview.status === "ready" && !overview.data.empty ? overview.data.player : null;
  const rating = player_?.rating ?? null;
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  return (
    <details
      className="me"
      ref={menu}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !menu.current?.open) return;
        close();
        menu.current.querySelector("summary")?.focus();
      }}
    >
      <summary>
        {isSample ? "Sample player" : nameOf(player)} {rating !== null && (
          <span className="num" title={`${player_!.rating_time_class} rating`}>
            {rating}
          </span>
        )}
      </summary>
      <div className="me-menu">
        <div className="me-theme">
          Theme <ThemeSwitch />
        </div>
        {status.kind === "analysing" && (
          <button type="button" onClick={status.paused ? resume : pause}>
            {status.paused ? "Resume reviewing" : "Pause reviewing"}
            <span className="me-note">
              Game {status.done + 1} of {status.total} · {status.paused ? pausedLabel(status.paused) : `${timeLeft(status.eta)} left`}
            </span>
          </button>
        )}
        {!isSample && (
          <a href={profileUrl(player)} target="_blank" rel="noreferrer" onClick={close}>
            Profile on {siteName(player)}
          </a>
        )}
        <a href={`${REPO}/issues/new`} target="_blank" rel="noreferrer" onClick={close}>
          Send feedback
          <span className="me-note">An idea, a wrong explanation, a bug: on GitHub.</span>
        </a>
        {canChooseCounting() && <CountingSwitch />}
        <a href={`${REPO}#licence`} target="_blank" rel="noreferrer" onClick={close}>
          Source code and licences
          <span className="me-note">Free software: GPL-3.0, with Maia-3 (CSSLab) under AGPL-3.0.</span>
        </a>
        <button
          type="button"
          onClick={() => {
            close();
            leave();
          }}
        >
          {isSample ? "Leave the sample" : "Switch player"}
        </button>
        {!isSample && (
          <HoldButton
            className="me-danger"
            onDone={() => {
              close();
              forgetPlayer();
            }}
          >
            Hold to delete {nameOf(player)}'s reviews
            <span className="me-note">From this browser only. You can review the games again later.</span>
          </HoldButton>
        )}
      </div>
    </details>
  );
}

function TopBar({ route }: { route: Route }) {
  const { player, isSample, leave } = useLibrary();
  const { target } = useCurrentComparison();
  // When the sections scroll sideways (narrow screens), keep the current one in view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [route.name]);
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: "latest" })}>
        <Mark />
        Prophylaxis
      </a>
      {player && (
        <nav className="topnav" aria-label="Sections" ref={nav}>
          {NAV.map((item) => (
            <a key={item.label} href={href(item.route.name === "compare" ? { name: "compare", player: target } : item.route)} aria-current={item.match.includes(route.name) ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      )}
      <div className="topbar-end">
        {isSample && (
          <button type="button" className="sample-cta" onClick={leave} title="These are made-up beginner games, played by a weak engine.">
            Review your own games
          </button>
        )}
        {player && <ProgressPill />}
        {player && route.name !== "compare" && <ComparePill />}
        <ThemeSwitch />
        {player && <PlayerMenu player={player} />}
      </div>
    </header>
  );
}

export function App() {
  return (
    <LibraryProvider>
      <ComparisonProvider>
        <Shell />
      </ComparisonProvider>
    </LibraryProvider>
  );
}

// The page names counted (lib/analytics.ts): which page, never which game or player.
const PAGE_NAMES: Record<Route["name"], string> = {
  latest: "review", game: "review", patterns: "habits", games: "games", practice: "practice", puzzles: "puzzles",
  openings: "openings", compare: "compare",
};

function Shell() {
  const route = useRoute();
  const { player, isSample } = useLibrary();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === "game" ? route.id : null]);

  const page = !player ? "/start" : `${isSample ? "/sample" : ""}/${PAGE_NAMES[route.name]}`;
  useEffect(() => countPage(page), [page]);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <TopBar route={route} />
      <main id="main">
        {!player ? (
          <Start />
        ) : route.name === "patterns" ? (
          <Habits />
        ) : route.name === "practice" ? (
          <Practice tag={route.tag} />
        ) : route.name === "puzzles" ? (
          <Puzzles tag={route.tag} />
        ) : route.name === "games" ? (
          <Games />
        ) : route.name === "openings" ? (
          <Openings />
        ) : route.name === "compare" ? (
          <Compare player={route.player} />
        ) : (
          <Review id={route.name === "game" ? route.id : null} ply={route.name === "game" ? route.ply : null} />
        )}
      </main>
    </div>
  );
}
