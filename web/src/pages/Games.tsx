// Every game: a sortable-by-date table with the result, accuracy and the habit that cost the most.
import { useState } from "react";
import { useGames, useOverview } from "../data";
import { RESULT_META, accuracy, day, plural, timeControl, timeLeft } from "../lib/format";
import { useLibrary, useLibraryStatus } from "../library/Library";
import { href } from "../router";
import type { Color, Result } from "../types";
import "./pages.css";

const RESULTS: { label: string; value: Result | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Wins", value: "win" },
  { label: "Losses", value: "loss" },
  { label: "Draws", value: "draw" },
];
const COLORS: { label: string; value: Color | "all" }[] = [
  { label: "Both colours", value: "all" },
  { label: "White", value: "white" },
  { label: "Black", value: "black" },
];

/** Games and the opening tree are two views of the same games. */
export function Games() {
  const games = useGames();
  const overview = useOverview();
  const { more, reviewMore } = useLibrary();
  const status = useLibraryStatus();
  const [result, setResult] = useState<Result | "all">("all");
  const [color, setColor] = useState<Color | "all">("all");

  if (games.status === "error") return <p className="pstate">Couldn't load your games ({games.error}).</p>;
  if (games.status === "loading") return <div className="page" aria-busy="true" />;

  const rows = games.data.filter((g) => (result === "all" || g.result === result) && (color === "all" || g.color === color));
  const unplayed = overview.status === "ready" && !overview.data.empty ? overview.data.player.unplayed : 0;

  return (
    <div className="page">
      <header className="page-top">
        <h1>Games</h1>
        <p>
          {games.data.length} games, newest first.
          {unplayed > 0 && ` ${plural(unplayed, "more game")} ended before the first move.`}
        </p>
        {more && status.kind === "idle" && (
          <p className="games-more">
            Older games aren't reviewed yet.{" "}
            <button type="button" className="pbtn" onClick={reviewMore}>
              Review {plural(more.games, "more game")} · {timeLeft(more.eta)}
            </button>
          </p>
        )}
      </header>

      <div className="filters">
        <div className="seg" role="group" aria-label="Result">
          {RESULTS.map((f) => (
            <button key={f.value} type="button" aria-pressed={result === f.value} onClick={() => setResult(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Colour">
          {COLORS.map((f) => (
            <button key={f.value} type="button" aria-pressed={color === f.value} onClick={() => setColor(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="filters-count num">{plural(rows.length, "game")}</span>
      </div>

      <div className="table-scroll">
        <table className="ptable ptable--grid games">
          <thead>
            <tr>
              <th scope="col">Opponent</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">Accuracy</th>
              <th scope="col" className="num hide-sm">Mistakes</th>
              <th scope="col" className="num hide-sm">Blunders</th>
              <th scope="col" className="hide-sm">Costliest habit</th>
              <th scope="col" className="hide-md">Opening</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                <td>
                  <a className="row-link" href={href({ name: "game", id: g.id, ply: null })}>
                    <span className={`piece-dot piece-dot--${g.color}`} aria-label={`you played ${g.color}`} />
                    {g.opponent} <span className="muted num">{g.opp_rating}</span>
                  </a>
                  <small>
                    {day(g.t)} · {timeControl(g.time_control)} · {g.moves} moves
                  </small>
                </td>
                <td>
                  <span className={`result result--${g.result}`}>{RESULT_META[g.result].label}</span>
                  <small>{g.ending}</small>
                </td>
                <td className="num">{accuracy(g.accuracy)}</td>
                <td className="num hide-sm">{g.mistakes}</td>
                <td className="num hide-sm">{g.blunders}</td>
                <td className="hide-sm">
                  {g.habit ? <a href={href({ name: "practice", tag: g.habit.tag })}>{g.habit.title}</a> : <span className="muted">none</span>}
                </td>
                <td className="hide-md">{g.family}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="pstate">No games match these filters.</p>}
      </div>
    </div>
  );
}
