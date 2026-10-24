import { useEffect } from "react";
import { useOverview } from "./data";
import { useTheme, type ThemeChoice } from "./lib/theme";
import { Games } from "./pages/Games";
import { Habits } from "./pages/Habits";
import { Practice } from "./pages/Practice";
import { Review } from "./review/Review";
import { href, useRoute, type Route } from "./router";

const NAV: { label: string; route: Route; match: Route["name"][] }[] = [
  { label: "Review", route: { name: "latest" }, match: ["latest", "game"] },
  { label: "Habits", route: { name: "patterns" }, match: ["patterns"] },
  { label: "Practice", route: { name: "practice", tag: null }, match: ["practice"] },
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

function TopBar({ route }: { route: Route }) {
  const overview = useOverview();
  const player = overview.status === "ready" && !overview.data.empty ? overview.data.player : null;
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: "latest" })}>
        Chess Coach
      </a>
      <nav className="topnav" aria-label="Sections">
        {NAV.map((item) => (
          <a key={item.label} href={href(item.route)} aria-current={item.match.includes(route.name) ? "page" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      <ThemeSwitch />
      {player && (
        <a className="me" href={`https://www.chess.com/member/${player.username}`} target="_blank" rel="noreferrer">
          {player.username} <span className="num">{player.rating}</span>
        </a>
      )}
    </header>
  );
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === "game" ? route.id : null]);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <TopBar route={route} />
      <main id="main">
        {route.name === "patterns" ? (
          <Habits />
        ) : route.name === "practice" ? (
          <Practice tag={route.tag} />
        ) : route.name === "games" ? (
          <Games />
        ) : (
          <Review id={route.name === "game" ? route.id : null} ply={route.name === "game" ? route.ply : null} />
        )}
      </main>
    </div>
  );
}
