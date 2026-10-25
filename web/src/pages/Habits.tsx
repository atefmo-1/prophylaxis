// Habits: the one thing to work on first, then skill areas, every habit, and the analysis behind them.
import type { ReactNode } from "react";
import { Board, type Arrow } from "../components/Board";
import { BarRows, GameChart, Legend, PairedBars, RateRows, Scatter } from "../components/charts";
import { ClassIcon } from "../components/ClassIcon";
import { useOverview } from "../data";
import { CLASS_META, RESULT_META, day, plural, share } from "../lib/format";
import { hasPuzzles } from "../lib/puzzles";
import { href } from "../router";
import type { MoveClass, Overview, Skill, Weakness } from "../types";
import "./pages.css";
import { NotEnough } from "../components/Progress";

const MIN_GAMES = 5;

function windowLine(w: Weakness) {
  const { last, prev, size } = w.windows;
  return `${last} of your last ${size} games${prev !== null ? ` (${prev} of the ${size} before)` : ""}`;
}

function Direction({ now, was, better }: { now: number; was: number | null; better: "higher" | "lower" }) {
  if (was === null) return null;
  const diff = now - was;
  if (Math.abs(diff) < Math.max(0.05 * Math.abs(was), 0.1)) return <span className="trend trend--flat">about the same</span>;
  const improving = better === "higher" ? diff > 0 : diff < 0;
  return (
    <span className={`trend ${improving ? "trend--good" : "trend--bad"}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d={diff > 0 ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {improving ? "better" : "worse"}
    </span>
  );
}

const SKILL_UNIT: Record<string, string> = {
  opening: "accuracy",
  safety: "of games",
  tactics: "missed per game",
  endgame: "accuracy",
  converting: "converted",
  time: "of games lost on time",
};

const formatSkill = (s: Skill, v: number | null) =>
  v === null ? "–" : s.key === "tactics" ? v.toFixed(1) : s.unit === "accuracy" ? v.toFixed(0) : `${Math.round(v)}%`;

function Focus({ w }: { w: Weakness }) {
  const ex = w.latest ?? w.examples[0];
  const arrows: Arrow[] = ex ? [{ uci: ex.played_uci, brush: "played" }] : [];
  if (ex?.best_uci && ex.best_uci !== ex.played_uci) arrows.push({ uci: ex.best_uci, brush: "best" });
  return (
    <section className="focus" aria-labelledby="focus-title">
      {ex && (
        <a className="focus-board" href={href({ name: "game", id: ex.game_id, ply: ex.ply })} aria-label="Open this position in the game review">
          <Board fen={ex.fen} orientation={ex.color} arrows={arrows} coordinates={false} label={`You played ${ex.played}; ${ex.best} was better`} />
        </a>
      )}
      <div className="focus-text">
        <h2 id="focus-title">Your #1 habit: {w.title.toLowerCase()}</h2>
        <p className="focus-rate">
          It showed up in <b>{windowLine(w)}</b>.
        </p>
        <p>{w.what}</p>
        <p className="focus-fix">{w.fix}</p>
        <div className="focus-actions">
          <a className="pbtn pbtn--primary" href={href({ name: "practice", tag: w.tag })}>
            Practise 5 of these
          </a>
          {hasPuzzles(w.tag) && (
            <a className="pbtn" href={href({ name: "puzzles", tag: w.tag })}>
              Puzzles like these
            </a>
          )}
        </div>
        {ex && (
          <p className="focus-caption">
            Your most recent one: move {ex.move_number} against {ex.opponent}, {day(ex.date)}. You played <b>{ex.played}</b> (blue
            arrow); <b>{ex.best}</b> (green) was better. <a href={href({ name: "game", id: ex.game_id, ply: ex.ply })}>Open in review</a>
          </p>
        )}
      </div>
    </section>
  );
}

function Skills({ skills, played }: { skills: Skill[]; played: number }) {
  const games = skills[0]?.games ?? 0;
  return (
    <section className="block" aria-labelledby="skills-title">
      <h2 id="skills-title">Skill areas</h2>
      <p className="block-lede">
        {played > games
          ? `Your last ${games} games, compared with the ${played - games} before them.`
          : `Your ${games} games so far. Once you have more than ${games}, each area compares your recent games with the ones before.`}
      </p>
      <ul className="skills">
        {skills.map((s) => (
          <li key={s.key} className="skill">
            <h3>{s.title}</h3>
            <p className="skill-q">{s.question}</p>
            <p className="skill-value">
              <b className="num">{formatSkill(s, s.recent)}</b> <span>{SKILL_UNIT[s.key] ?? s.unit}</span>
            </p>
            <p className="skill-was">
              {s.recent !== null && <Direction now={s.recent} was={s.before} better={s.better} />}
              {s.before !== null && <span className="num">was {formatSkill(s, s.before)}</span>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AllHabits({ list }: { list: Weakness[] }) {
  return (
    <section className="block" aria-labelledby="habits-title">
      <h2 id="habits-title">All habits</h2>
      <p className="block-lede">Ranked by how much winning chance they cost you per game.</p>
      <ol className="habit-list">
        {list.map((w, i) => (
          <li key={w.tag}>
            <span className="habit-rank num">{i + 1}</span>
            <div className="habit-main">
              <b>{w.title}</b>
              <span>{w.what}</span>
            </div>
            <div className="habit-rate">
              <b className="num">
                {w.windows.last} of {w.windows.size}
              </b>
              <span>recent games{w.windows.prev !== null ? `, was ${w.windows.prev}` : ""}</span>
            </div>
            <div className="habit-cost">
              <b className="num">−{Math.round(w.avg_loss)}%</b>
              <span>chances each time</span>
            </div>
            <a className="pbtn" href={href({ name: hasPuzzles(w.tag) ? "puzzles" : "practice", tag: w.tag })}>
              {hasPuzzles(w.tag) ? "Puzzles" : "Practise"}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Card({ title, takeaway, children, wide }: { title: string; takeaway?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`card${wide ? " card--wide" : ""}`}>
      <figcaption>
        <h3>{title}</h3>
        {takeaway && <p>{takeaway}</p>}
      </figcaption>
      {children}
    </figure>
  );
}

const pct0 = (v: number) => `${Math.round(v)}`;

function Trends({ data }: { data: Overview }) {
  const p = data.player;
  const ratings = data.series.map((s) => s.rating);
  const lo = Math.max(0, Math.floor((Math.min(...ratings) - 10) / 100) * 100);
  const hi = Math.ceil((Math.max(...ratings) + 10) / 100) * 100;
  const mid = Math.round((lo + hi) / 2 / 50) * 50;
  const recent = data.series.slice(-10).map((s) => s.accuracy).filter((a): a is number => a !== null);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
  return (
    <section className="block" aria-labelledby="trends-title">
      <h2 id="trends-title">Trends</h2>
      <p className="block-lede">Every game since you started, oldest on the left. Hover for the game.</p>
      <div className="cards">
        <Card title="Rapid rating" takeaway={`From ${p.start_rating} to ${p.rating}, with a peak of ${p.peak}.`}>
          <GameChart
            label="Rapid rating after each game"
            series={[{ key: "rating", kind: "line", values: ratings }]}
            domain={[lo, hi]}
            ticks={[lo, mid, hi]}
            format={(v) => String(v)}
            tip={(i) => {
              const s = data.series[i];
              return (
                <>
                  <b className="num">{s.rating}</b> {RESULT_META[s.result].label.toLowerCase()} vs {s.opp_rating}, {day(s.t)}
                </>
              );
            }}
          />
        </Card>
        <Card
          title="Accuracy"
          takeaway={`${recentAvg.toFixed(1)} over your last 10 games, against ${p.accuracy?.toFixed(1)} overall. Your opponents average ${p.opp_accuracy?.toFixed(1)}.`}
        >
          <Legend
            items={[
              { key: "game", label: "Each game", kind: "dot" },
              { key: "avg", label: "Average of the last 10", kind: "line" },
            ]}
          />
          <GameChart
            label="Accuracy per game with a 10-game average"
            series={[
              { key: "game", kind: "dots", values: data.series.map((s) => s.accuracy) },
              { key: "avg", kind: "line", values: data.series.map((s) => s.accuracy_avg10) },
            ]}
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            format={pct0}
            tip={(i) => {
              const s = data.series[i];
              return (
                <>
                  <b className="num">{s.accuracy?.toFixed(1) ?? "–"}</b> this game · <span className="num">{s.accuracy_avg10?.toFixed(1)}</span> avg
                </>
              );
            }}
          />
        </Card>
      </div>
    </section>
  );
}

function Mistakes({ data }: { data: Overview }) {
  const speed = data.clock.speed.filter((b) => b.mistake_rate);
  const slowWorse = speed.length > 1 && speed[speed.length - 1].mistake_rate!.rate > speed[0].mistake_rate!.rate;
  const worstPhase = [...data.phases].sort((a, b) => (b.mistake_rate?.rate ?? 0) - (a.mistake_rate?.rate ?? 0))[0];
  return (
    <section className="block" aria-labelledby="where-title">
      <h2 id="where-title">Where and when mistakes happen</h2>
      <p className="block-lede">
        Share of your moves that were a mistake, miss or blunder. The band shows where the true rate likely is with this many games.
      </p>
      <div className="cards cards--3">
        <Card
          title="By game phase"
          takeaway={
            <>
              {worstPhase && <>The {worstPhase.phase} is your weakest phase. </>}
              {data.first_mistake_move !== null && <>Your first mistake usually comes by move {data.first_mistake_move}.</>}
            </>
          }
        >
          <RateRows rows={data.phases.map((ph) => ({ label: ph.phase[0].toUpperCase() + ph.phase.slice(1), sub: `${ph.moves} moves`, ci: ph.mistake_rate }))} />
        </Card>
        <Card title="By time left" takeaway={`You lost ${plural(data.clock.lost_on_time, "game")} on time.`}>
          <RateRows rows={data.clock.buckets.map((b) => ({ label: b.label, sub: `${b.moves} moves`, ci: b.mistake_rate }))} />
        </Card>
        <Card
          title="By time spent on the move"
          takeaway={
            slowWorse
              ? "Your slowest moves go wrong most: hard positions take longer, so long thinks mark the hard positions."
              : "Your fastest moves go wrong most."
          }
        >
          <RateRows rows={data.clock.speed.map((b) => ({ label: b.label, sub: `${b.moves} moves`, ci: b.mistake_rate }))} />
        </Card>
      </div>
    </section>
  );
}

const QUALITY: MoveClass[] = ["brilliant", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"];

function VersusAndResults({ data }: { data: Overview }) {
  const p = data.player;
  const q = new Map(data.move_quality.map((m) => [m.class, m]));
  const blunders = q.get("blunder");
  const wins = data.terminations.filter((t) => t.result === "win");
  const losses = data.terminations.filter((t) => t.result === "loss");
  const conv = data.conversion.winning;
  const after = data.sessions;
  return (
    <section className="block" aria-labelledby="vs-title">
      <h2 id="vs-title">You and your opponents</h2>
      <p className="block-lede">How your moves compare with the moves played against you, and how your games end.</p>
      <div className="cards">
        <Card
          title="Moves per game, by grade"
          takeaway={blunders && `You blunder ${blunders.mine_per_game.toFixed(1)} times a game; your opponents ${blunders.theirs_per_game.toFixed(1)}.`}
        >
          <Legend
            items={[
              { key: "a", label: "You", kind: "dot" },
              { key: "b", label: "Your opponents", kind: "dot" },
            ]}
          />
          <PairedBars
            format={(v) => v.toFixed(1)}
            rows={QUALITY.filter((c) => q.has(c)).map((c) => ({
              label: CLASS_META[c].label,
              icon: <ClassIcon cls={c} size={15} />,
              a: q.get(c)!.mine_per_game,
              b: q.get(c)!.theirs_per_game,
            }))}
          />
        </Card>
        <Card
          title="How games end"
          takeaway={
            <>
              {conv && <>You won {conv.k} of the {conv.n} games where you reached a winning position. </>}
              After a loss in the same session you scored {share(after.loss.score ?? 0)}; after a win, {share(after.win.score ?? 0)}.
            </>
          }
        >
          <p className="bars-title">Wins ({p.win})</p>
          <BarRows tone="win" rows={wins.map((t) => ({ label: t.label, value: t.count }))} />
          <p className="bars-title">Losses ({p.loss})</p>
          <BarRows tone="loss" rows={losses.map((t) => ({ label: t.label, value: t.count }))} />
          <p className="bars-note">
            {p.draw} draws. All {p.games} games, including {plural(p.unplayed, "game")} that ended before the first move.
          </p>
        </Card>
      </div>
    </section>
  );
}

function Openings({ data }: { data: Overview }) {
  const colors = data.colors;
  return (
    <section className="block" aria-labelledby="openings-title">
      <h2 id="openings-title">Openings and colours</h2>
      <p className="block-lede">
        {colors.map((c, i) => (
          <span key={c.color}>
            {i > 0 && " "}
            As {c.color}: {c.win}–{c.loss}–{c.draw} ({share(c.score ?? 0)} score, accuracy {c.accuracy?.toFixed(1)}).
          </span>
        ))}
      </p>
      <div className="table-scroll">
        <table className="ptable ptable--grid">
          <thead>
            <tr>
              <th scope="col">Opening family</th>
              <th scope="col">You played</th>
              <th scope="col" className="num">Games</th>
              <th scope="col" className="num">W–L–D</th>
              <th scope="col" className="num">Score</th>
              <th scope="col" className="num hide-sm">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {data.openings
              .filter((o) => o.games >= 2)
              .slice(0, 12)
              .map((o) => (
                <tr key={`${o.family}-${o.color}`}>
                  <td>{o.family}</td>
                  <td>{o.color}</td>
                  <td className="num">{o.games}</td>
                  <td className="num">
                    {o.win}–{o.loss}–{o.draw}
                  </td>
                  <td className="num">{share(o.score ?? 0)}</td>
                  <td className="num hide-sm">{o.accuracy?.toFixed(1) ?? "–"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Method({ data }: { data: Overview }) {
  const v = data.validation;
  return (
    <section className="block" aria-labelledby="method-title">
      <h2 id="method-title">How this is graded</h2>
      <div className="method">
        <ul className="method-list">
          <li>
            Games come from the chess.com public API. Every position was searched by {data.method.engine} at{" "}
            {data.method.nodes.toLocaleString()} nodes, the same budget each time, so results are reproducible.
          </li>
          <li>
            Engine scores become winning chances and accuracy with Lichess's published formulas. Grades use chess.com's scale: a mistake
            costs 10–20% winning chances, a blunder 20% or more.
          </li>
          <li>
            Habits are named by rules checked against the engine's own lines. A hung piece only counts when the best reply really takes it
            and the material is really lost. Rates carry 90% Jeffreys intervals.
          </li>
          <li>Retry puzzles accept any move within 3% of the best, scored by a full MultiPV search of every legal move.</li>
        </ul>
        {v.pairs.length > 0 && (
          <Card
            title="Checked against chess.com"
            takeaway={`${v.pairs.length} games have chess.com's own accuracy. Ours correlates at r = ${v.pearson?.toFixed(2)}, typical gap ${v.mean_abs_diff?.toFixed(1)} points.`}
          >
            <Scatter pairs={v.pairs} />
          </Card>
        )}
      </div>
    </section>
  );
}

export function Habits() {
  const overview = useOverview();
  if (overview.status === "error") return <p className="pstate">Couldn't load your stats ({overview.error}).</p>;
  if (overview.status === "loading") return <div className="page" aria-busy="true" />;
  const data = overview.data;
  if (data.empty || data.player.played < MIN_GAMES) return <NotEnough title="Habits need a few games" when={`This page fills in once ${MIN_GAMES} are done.`} />;
  if (data.weaknesses.length === 0) return <p className="pstate">No habits yet: none of your reviewed games has a mistake the coach recognises.</p>;
  return (
    <div className="page">
      <header className="page-top">
        <h1>Habits</h1>
        <p>
          From your {data.player.played} played games, updated {day(data.generated_at)}.
        </p>
      </header>
      <Focus w={data.weaknesses[0]} />
      <Skills skills={data.skills} played={data.player.played} />
      <AllHabits list={data.weaknesses.slice(0, 10)} />
      <Trends data={data} />
      <Mistakes data={data} />
      <VersusAndResults data={data} />
      <Openings data={data} />
      <Method data={data} />
    </div>
  );
}
