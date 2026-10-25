import { useEffect, useRef } from "react";
import { pausedLabel, ProgressPill } from "./components/Progress";
import { useOverview } from "./data";
import { timeLeft } from "./lib/format";
import { useTheme, type ThemeChoice } from "./lib/theme";
import { LibraryProvider, useLibrary, useLibraryStatus } from "./library/Library";
import { Games } from "./pages/Games";
import { Habits } from "./pages/Habits";
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
];

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeSwitch() {
  const [choice, setChoice] = useTheme();
  return (
    <div className="theme" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button key={t.value} type="button" aria-pressed={choice === t.value} onClick={() => setChoice(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** The player this browser follows, with switching and deleting their data. */
function PlayerMenu({ player }: { player: string }) {
  const { leave, forgetPlayer, isSample, pause, resume } = useLibrary();
  const status = useLibraryStatus();
  const overview = useOverview();
  const rating = overview.status === "ready" && !overview.data.empty ? overview.data.player.rating : null;
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  return (
    <details className="me" ref={menu}>
      <summary>
        {isSample ? "Sample player" : player} {rating !== null && <span className="num">{rating}</span>}
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
          <a href={`https://www.chess.com/member/${player}`} target="_blank" rel="noreferrer" onClick={close}>
            Profile on chess.com
          </a>
        )}
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
          <button
            type="button"
            className="me-danger"
            onClick={() => {
              close();
              if (window.confirm(`Delete ${player}'s reviews from this browser? You can review the games again later.`))
                forgetPlayer();
            }}
          >
            Delete my data from this browser
          </button>
        )}
      </div>
    </details>
  );
}

function TopBar({ route }: { route: Route }) {
  const { player } = useLibrary();
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: "latest" })}>
        Prophylaxis
      </a>
      {player && (
        <nav className="topnav" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.label} href={href(item.route)} aria-current={item.match.includes(route.name) ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      )}
      <div className="topbar-end">
        {player && <ProgressPill />}
        <ThemeSwitch />
        {player && <PlayerMenu player={player} />}
      </div>
    </header>
  );
}

export function App() {
  return (
    <LibraryProvider>
      <Shell />
    </LibraryProvider>
  );
}

/** Under the top bar while the sample player is open, so nobody mistakes it for a real person's games. */
function SampleNote() {
  const { leave } = useLibrary();
  return (
    <p className="sample-note">
      You're looking at a sample player: made-up beginner games, played by a weak engine.{" "}
      <button type="button" onClick={leave}>
        Review your own games
      </button>
    </p>
  );
}

function Shell() {
  const route = useRoute();
  const { player, isSample } = useLibrary();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === "game" ? route.id : null]);

  return (
    <div className={isSample ? "shell shell--sample" : "shell"}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <TopBar route={route} />
      {isSample && <SampleNote />}
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
        ) : (
          <Review id={route.name === "game" ? route.id : null} ply={route.name === "game" ? route.ply : null} />
        )}
      </main>
    </div>
  );
}
