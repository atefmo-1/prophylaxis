// You against another chess.com player: their latest games in your time control, reviewed in this browser like
// yours, side by side with your own, with tips for playing them drawn from their numbers.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { OpeningTree } from "../components/OpeningTree";
import { NotEnough } from "../components/Progress";
import { COMPARE_GAMES, COMPARE_MIN, latest, ownOverview, SAMPLE_RIVAL } from "../library/compare";
import { useCurrentComparison } from "../library/Comparison";
import { useLibrary } from "../library/Library";
import { plural, share, timeLeft } from "../lib/format";
import { tipsAgainst } from "../lib/tips";
import { href } from "../router";
import type { Interval, Overview, Skill } from "../types";
import "./compare.css";
import "./pages.css";

const MIN_OWN = 5;

// When a gap in a skill area is big enough to call: accuracy points, percentage points, missed tactics per game.
const EDGE: Record<string, number> = { opening: 5, endgame: 5, safety: 15, converting: 15, time: 10, tactics: 0.5 };

const formatSkill = (s: Skill, v: number | null) =>
  v === null ? "–" : s.key === "tactics" ? `${v.toFixed(1)} a game` : s.unit === "accuracy" ? v.toFixed(0) : `${Math.round(v)}%`;

type Edge = "you" | "them" | "even";

function skillEdge(s: Skill, mine: number | null, theirs: number | null): Edge {
  if (mine === null || theirs === null) return "even";
  const gap = mine - theirs;
  if (Math.abs(gap) < (EDGE[s.key] ?? 5)) return "even";
  return (gap > 0) === (s.better === "higher") ? "you" : "them";
}

// Mistake rates: a side has the edge only when the two ranges don't overlap.
function rateEdge(mine: Interval | null, theirs: Interval | null): Edge {
  if (!mine || !theirs) return "even";
  if (mine.hi < theirs.lo) return "you";
  if (theirs.hi < mine.lo) return "them";
  return "even";
}

function EdgeCell({ edge, name }: { edge: Edge; name: string }) {
  return <td className={`cmp-edge cmp-edge--${edge}`}>{edge === "you" ? "You" : edge === "them" ? name : "Too close to call"}</td>;
}

function Picker({ suggestions, initial }: { suggestions: string[]; initial: string }) {
  const [value, setValue] = useState(initial);
  const go = (name: string) => {
    if (name.trim()) window.location.hash = href({ name: "compare", player: name.trim() }).replace(/^.*#/, "#");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };
  return (
    <div className="cmp-picker">
      <form className="cmp-form" onSubmit={submit}>
        <label htmlFor="cmp-name">A chess.com username</label>
        <div className="cmp-row">
          <input id="cmp-name" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. a friend or a rival" autoComplete="off" spellCheck={false} />
          <button type="submit" className="pbtn pbtn--primary">
            Compare
          </button>
        </div>
      </form>
      {suggestions.length > 0 && (
        <p className="cmp-suggest">
          <span className="muted">{suggestions[0] === SAMPLE_RIVAL ? "Try it with a made-up rival:" : "Players you've met most:"}</span>
          {suggestions.map((s) => (
            <button key={s} type="button" className="cmp-chip" onClick={() => go(s)}>
              {s}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

function Results({ me, them, name, h2h }: { me: Overview; them: Overview; name: string; h2h: { win: number; loss: number; draw: number } }) {
  const tips = tipsAgainst(them, me, name);
  const tc = me.player.rating_time_class;
  return (
    <>
      <section className="cmp-head" aria-label="You and them">
        <div>
          <span className="muted">You</span>
          <b className="num">{me.player.rating}</b>
          <span className="muted">
            {tc}, {plural(me.player.played, "game")}
          </span>
        </div>
        <div className="cmp-vs" aria-hidden="true">
          vs
        </div>
        <div>
          <span className="muted">{name}</span>
          <b className="num">{them.player.rating}</b>
          <span className="muted">
            {tc}, {plural(them.player.played, "game")}
          </span>
        </div>
        <p className="cmp-h2h">
          {h2h.win + h2h.loss + h2h.draw > 0
            ? `Against each other, in your reviewed games: you won ${h2h.win}, lost ${h2h.loss}, drew ${h2h.draw}.`
            : "You haven't played each other in your reviewed games."}
        </p>
      </section>

      <section className="block" aria-labelledby="tips-title">
        <h2 id="tips-title">How to beat {name}</h2>
        <p className="block-lede">From their last {plural(them.player.played, "game")}. Each tip shows what it's based on.</p>
        {tips.length ? (
          <ol className="cmp-tips">
            {tips.map((t) => (
              <li key={t.title}>
                <b>{t.title}</b>
                <span>{t.why}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Nothing stands out clearly yet. More of their games would help.</p>
        )}
      </section>

      <section className="block" aria-labelledby="side-title">
        <h2 id="side-title">Side by side</h2>
        <p className="block-lede">Your last {plural(me.player.played, tc + " game")} against theirs. A side gets the edge only when the gap is bigger than the noise.</p>
        <div className="table-scroll">
          <table className="ptable ptable--grid cmp-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col" className="num">You</th>
                <th scope="col" className="num">{name}</th>
                <th scope="col">Edge</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Accuracy</th>
                <td className="num">{me.player.accuracy?.toFixed(1) ?? "–"}</td>
                <td className="num">{them.player.accuracy?.toFixed(1) ?? "–"}</td>
                <EdgeCell
                  name={name}
                  edge={me.player.accuracy === null || them.player.accuracy === null || Math.abs(me.player.accuracy - them.player.accuracy) < 5 ? "even" : me.player.accuracy > them.player.accuracy ? "you" : "them"}
                />
              </tr>
              {me.skills.map((s) => {
                const t = them.skills.find((x) => x.key === s.key);
                if (!t) return null;
                return (
                  <tr key={s.key}>
                    <th scope="row">
                      {s.title}
                      <small>{s.question}</small>
                    </th>
                    <td className="num">{formatSkill(s, s.recent)}</td>
                    <td className="num">{formatSkill(t, t.recent)}</td>
                    <EdgeCell name={name} edge={skillEdge(s, s.recent, t.recent)} />
                  </tr>
                );
              })}
              {me.phases.map((p) => {
                const t = them.phases.find((x) => x.phase === p.phase);
                return (
                  <tr key={p.phase}>
                    <th scope="row">
                      Mistakes in the {p.phase}
                      <small>Share of moves that were mistakes or worse</small>
                    </th>
                    <td className="num">{p.mistake_rate ? share(p.mistake_rate.rate) : "–"}</td>
                    <td className="num">{t?.mistake_rate ? share(t.mistake_rate.rate) : "–"}</td>
                    <EdgeCell name={name} edge={rateEdge(p.mistake_rate, t?.mistake_rate ?? null)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="block" aria-labelledby="habits-cmp-title">
        <h2 id="habits-cmp-title">Costliest habits</h2>
        <div className="cmp-habits">
          {[
            { who: "You", o: me },
            { who: name, o: them },
          ].map(({ who, o }) => (
            <div key={who}>
              <h3>{who}</h3>
              <ol>
                {o.weaknesses.slice(0, 3).map((w) => (
                  <li key={w.tag}>
                    <b>{w.title}</b>
                    <span className="muted">
                      {w.games.k} of {w.games.n} games
                    </span>
                  </li>
                ))}
                {o.weaknesses.length === 0 && <li className="muted">None recognised yet.</li>}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function Compare({ player }: { player: string | null }) {
  const lib = useLibrary();
  const tc = lib.overview.empty ? null : lib.overview.player.rating_time_class;
  // The comparison runs above the pages (library/Comparison.tsx), so it carries on while the player is elsewhere.
  const cmp = useCurrentComparison();
  const { target, setTarget } = cmp;
  const same = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  useEffect(() => {
    if (player && !same(player, target)) setTarget(player);
  }, [player, target, setTarget]);
  // Compare without a name in the address (an old link) shows the comparison under way, if there is one.
  const shown = player ?? target;
  const current = same(shown, target);
  const status = current ? cmp.status : ({ kind: "idle" } as const);
  const them = current ? cmp.player : null;
  const theirs = current ? cmp.theirs : [];
  const overview = current ? cmp.overview : null;
  const total = current ? cmp.total : 0;
  const own = useMemo(() => (tc ? ownOverview(lib.stored, lib.player ?? "you", tc) : null), [lib.stored, lib.player, tc]);
  if (!lib.loaded) return <div className="page" aria-busy="true" />;
  if (lib.overview.empty || lib.overview.player.played < MIN_OWN)
    return <NotEnough title="Compare needs a few of your own games" when={`It opens once ${MIN_OWN} are reviewed.`} />;

  const counts = new Map<string, number>();
  for (const g of lib.games) counts.set(g.opponent, (counts.get(g.opponent) ?? 0) + 1);
  // The sample player's opponents are made up; it compares with the sample rival, which ships with the site.
  const suggestions = lib.isSample ? [SAMPLE_RIVAL] : [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  const name = them ?? shown ?? "";
  const vs = lib.games.filter((g) => g.opponent.toLowerCase() === name.toLowerCase());
  const h2h = { win: vs.filter((g) => g.result === "win").length, loss: vs.filter((g) => g.result === "loss").length, draw: vs.filter((g) => g.result === "draw").length };
  const enough = theirs.length >= COMPARE_MIN && overview && own?.overview;

  return (
    <div className="page">
      <header className="page-top">
        <h1>Compare</h1>
        <p>
          You against any chess.com player: their last {COMPARE_GAMES} {tc} games, reviewed in your browser like yours, and
          how to play them.
        </p>
      </header>

      <Picker key={shown ?? ""} suggestions={suggestions} initial={shown ?? ""} />

      {shown && (
        <div className="cmp-status" role="status">
          {status.kind === "loading" && <p>{status.step}</p>}
          {status.kind === "error" && <p className="cmp-error">{status.message}</p>}
          {status.kind === "waiting" && <p>Your own games are being reviewed first; {name}'s start right after.</p>}
          {status.kind === "reviewing" && (
            <>
              {lib.paused && (
                <p className="cmp-paused">
                  Paused {lib.paused === "battery" ? "while the battery is low" : "by you"}.{" "}
                  <button type="button" className="pbtn" onClick={lib.resume}>
                    Resume
                  </button>
                </p>
              )}
              <p>
                Reviewing {name}'s games: {status.done} of {status.total} done{status.eta === null ? "; timing the first one" : `, ${timeLeft(status.eta)} left`}.
                {theirs.length < COMPARE_MIN ? ` The comparison appears after ${COMPARE_MIN}.` : " The numbers firm up as the rest finish."}
              </p>
              <span className="cmp-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${status.done / Math.max(1, status.total)})` }} />
              </span>
            </>
          )}
          {status.kind === "ready" && total > 0 && theirs.length < COMPARE_MIN && (
            <p>
              {name} has only {plural(theirs.length, `${tc} game`)} to compare; that's too few to say much.
            </p>
          )}
        </div>
      )}

      {shown && enough && <Results me={own!.overview!} them={overview!} name={name} h2h={h2h} />}

      {shown && enough && (
        <section className="block" aria-labelledby="their-openings-title">
          <h2 id="their-openings-title">{name}'s openings</h2>
          <p className="block-lede">What they play and how it goes for them, from their side. Games open on chess.com.</p>
          <OpeningTree stored={latest(theirs, tc!)} who={name} gameLink={(g) => (g.url.startsWith("https://www.chess.com/") ? g.url : null)} />
        </section>
      )}
    </div>
  );
}
