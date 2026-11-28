// The first screen: one question, your username on chess.com or Lichess. Everything after it runs in this browser.
import { Segmented } from "../components/Segmented";
import { Move as Figurine, Notation } from "../components/Notation";
import { useEffect, useState, type FormEvent } from "react";
import { Board, type Arrow } from "../components/Board";
import { ClassIcon } from "../components/ClassIcon";
import { CLASS_META, moveLabel, REPO } from "../lib/format";
import { uciOfSan } from "../lib/rules";
import type { MoveClass } from "../types";
import { helloExtension } from "../library/bridge";
import { PlayerNotFound } from "../library/games";
import { SITE_NAMES, type Site } from "../lib/player";
import { useLibrary } from "../library/Library";
import { TAG_INFO } from "../analysis/catalog";
import { AGAINST } from "../lib/tips";
import { DEMO } from "./startDemo";
import "./start.css";

const T = DEMO.turn;
const OPENING_COLOR = "white";
const wonOf = (r: string[]) => {
  const w = r.filter((x) => x === "w").length;
  return w === r.length ? `all ${w}` : `${w} of ${r.length}`;
};
const RIVAL_HITS = DEMO.rival.games.filter(Boolean).length;
const RIVAL_HABIT = TAG_INFO[DEMO.rival.tag].title;
const RIVAL_TIP = AGAINST[DEMO.rival.tag];
const cls = (i: number) => DEMO.moves[i].cls as MoveClass;

export function Start() {
  const { start, startSample } = useLibrary();
  const [name, setName] = useState("");
  const [site, setSite] = useState<Site>("chesscom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Chrome extension, when installed, already knows the player: offer to continue as them.
  const [known, setKnown] = useState<string | null>(null);

  useEffect(() => {
    helloExtension(null).then((hello) => setKnown(hello?.username ?? null));
  }, []);

  const go = async (username: string, on: Site) => {
    setBusy(true);
    setError(null);
    try {
      await start(username, on);
    } catch (err) {
      setError(err instanceof PlayerNotFound ? err.message : `Couldn't reach ${SITE_NAMES[on]}: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) go(name, site);
  };

  return (
    <div className="start">
      <section className="start-hero">
        <div className="start-copy">
          <h1>Find the move that lost the game. Then the habit behind it.</h1>
          <p className="start-lede">
            Prophylaxis reviews your chess.com or Lichess games with Stockfish, right here in your browser. Free, with no
            account, and your games never leave your browser.
          </p>
          {known && (
            <div className="start-known">
              <p>Your Prophylaxis extension knows you as {known}.</p>
              <button type="button" className="start-go" disabled={busy} onClick={() => go(known, "chesscom")}>
                Continue as {known}
              </button>
            </div>
          )}
          <form className="start-form" onSubmit={submit}>
            <div className="start-label-row">
              <label htmlFor="username">Your {SITE_NAMES[site]} username</label>
              <Segmented
                className="site-switch"
                label="Where you play"
                value={site}
                onChange={(s) => {
                  setSite(s);
                  setError(null);
                }}
                choices={(["chesscom", "lichess"] as const).map((s) => ({ value: s, label: SITE_NAMES[s] }))}
              />
            </div>
            <div className="start-row">
              <input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={site === "lichess" ? "e.g. DrNykterstein" : "e.g. magnuscarlsen"}
                aria-invalid={!!error}
                aria-describedby={error ? "username-error" : undefined}
              />
              <button type="submit" className="start-go" disabled={busy || !name.trim()}>
                {busy ? "Finding your games…" : "Review my games"}
              </button>
            </div>
            {error && (
              <p className="start-error" id="username-error" role="alert">
                {error}
              </p>
            )}
          </form>
          <p className="start-sample">
            <button type="button" onClick={startSample}>
              Try it with a sample player
            </button>
          </p>
        </div>
        <Replay />
      </section>

      <section className="start-pattern" aria-labelledby="pattern-title">
        <h2 id="pattern-title">It reads every game, not just the last one.</h2>
        <p className="start-pattern-sub">What it finds, shown with a sample player's games.</p>
        <div className="start-pattern-grid">
          <div className="frag frag-habit">
            <p className="frag-label">Across your games</p>
            <p className="frag-say">
              You left a piece hanging in <b>{DEMO.habit.filter(Boolean).length} of your last 10 games</b>.
            </p>
            <ol className="habit-row" aria-label={`In ${DEMO.habit.filter(Boolean).length} of the last 10 games`}>
              {DEMO.habit.map((hit, i) => (
                <li key={i} data-hit={hit || undefined} style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </ol>
            <p className="frag-foot">Last 10 games, oldest first. Filled: a piece left hanging.</p>
          </div>
          <div className="frag frag-practice">
            <div className="frag-board" aria-hidden="true">
              <Board fen={DEMO.moves[T.index - 1].fen} orientation={DEMO.color as "white" | "black"} label="" coordinates={false} />
            </div>
            <div>
              <p className="frag-label">Before your next game</p>
              <p className="frag-title">Find a better move for {DEMO.color}.</p>
              <p className="frag-text">
                The position before <span className="mv"><Notation>{moveLabel(T.index + 1, DEMO.moves[T.index].san)}</Notation></span> in the game above. Positions
                you got wrong come back over the next days until you find the move.
              </p>
            </div>
          </div>
          <div className="frag frag-openings">
            <p className="frag-label">In your openings</p>
            <p className="frag-say">
              As {OPENING_COLOR} you won{" "}
              {DEMO.openings.map((o, i) => (
                <span key={o.name}>
                  {i > 0 && ", but "}
                  <b>{wonOf(o.results)}</b> against the {o.name.replace(/ Defense$/, "")}
                </span>
              ))}
              .
            </p>
            <ul className="open-rows">
              {DEMO.openings.map((o) => (
                <li key={o.name}>
                  <span className="open-name">{o.name}</span>
                  <ol className="game-row" aria-label={`${o.results.filter((r) => r === "w").length} wins in ${o.results.length} games`}>
                    {o.results.map((r, i) => (
                      <li key={i} data-res={r} />
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
            <p className="frag-foot">Filled: a win</p>
          </div>
          <div className="frag frag-rival">
            <p className="frag-label">Against anyone</p>
            <p className="frag-say">
              Look up anyone before you play them. This player was {RIVAL_HABIT.toLowerCase()} in{" "}
              <b>{RIVAL_HITS} of their last {DEMO.rival.games.length} games</b>.
            </p>
            <ol className="habit-row rival-row" aria-label={`In ${RIVAL_HITS} of their last ${DEMO.rival.games.length} games`}>
              {DEMO.rival.games.map((hit, i) => (
                <li key={i} data-hit={hit || undefined} />
              ))}
            </ol>
            <p className="frag-foot">Their last {DEMO.rival.games.length} games. Filled: {RIVAL_HABIT.toLowerCase()}.</p>
            <p className="frag-text">
              <b>{RIVAL_TIP.title}.</b> {RIVAL_TIP.how.split(";")[0]}.
            </p>
          </div>
        </div>
      </section>

      <ul className="start-facts">
        <li>
          <b>No account</b>
          Just the username you play under. Your games are already public on chess.com and Lichess.
        </li>
        <li>
          <b>Nothing leaves your browser</b>
          Stockfish runs on your computer, and your reviews are saved here until you delete them.{" "}
          <a href={REPO}>The code is on GitHub</a>.
        </li>
        <li>
          <b>Finished games only</b>
          It never looks at a game in progress.
        </li>
      </ul>
    </div>
  );
}

const START = 19; // the replay picks the game up at move 10
const STEP_MS = 700;
const HOLD_MS = 5500;

/** The landing page's picture: a sample game replaying, graded move by move, until the move it turned on. */
function Replay() {
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [k, setK] = useState(still ? T.index : START);
  useEffect(() => {
    if (still) return;
    const t = window.setTimeout(() => setK((n) => (n >= T.index ? START : n + 1)), k >= T.index ? HOLD_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [k, still]);

  const m = DEMO.moves[k];
  const atTurn = k === T.index;
  const reply = T.reply ? uciOfSan(m.fen, T.reply) : null;
  const arrows: Arrow[] = atTurn && reply ? [{ uci: reply, brush: "threat" }] : [];
  const n = DEMO.moves.length;
  const pts = [DEMO.startWin, ...DEMO.moves.map((x) => x.win)];
  const line = (upTo: number) => pts.slice(0, upTo + 2).map((w, i) => `${(i / n) * 100},${100 - w}`).join(" ");
  const x = ((k + 1) / n) * 100;
  const y = 100 - m.win;
  const first = Math.max(0, k - 25); // as many moves as fit beside the board
  const rows: number[] = [];
  for (let i = first - (first % 2); i <= k; i += 2) rows.push(i);

  return (
    <figure className="replay">
      <p className="visually-hidden">
        A sample game replaying with each move graded. At {moveLabel(T.index + 1, m.san)} the {T.piece} is left hanging and the
        winning chances fall from {T.before}% to {T.after}%.
      </p>
      <div className="replay-stage" aria-hidden="true">
        <header className="replay-head">
          <span>A sample game</span>
        </header>
        <div className="replay-main">
          <div className="replay-board">
            <Board
              fen={m.fen}
              orientation={DEMO.color as "white" | "black"}
              lastMove={m.uci}
              arrows={arrows}
              badge={{ square: m.uci.slice(2, 4), cls: cls(k) }}
              label=""
              coordinates={false}
            />
          </div>
          <ol className="replay-sheet">
            {rows.map((i) => (
              <li key={i}>
                <span className="replay-no num">{i / 2 + 1}.</span>
                {[i, i + 1].map((j) =>
                  j <= k && j < n ? (
                    <span key={j} className="replay-mv" data-now={j === k || undefined}>
                      <Figurine san={DEMO.moves[j].san} />
                      {!["book", "good", "best", "excellent"].includes(cls(j)) && <ClassIcon cls={cls(j)} size={14} />}
                    </span>
                  ) : (
                    <span key={j} />
                  ),
                )}
              </li>
            ))}
          </ol>
        </div>
        <div className="replay-graph">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" x2="100" y1="50" y2="50" className="mid" />
          <polyline points={`0,100 ${line(k)} ${x},100`} className="area" />
          <polyline points={line(k)} className="line" />
          </svg>
          <span className="replay-dot" style={{ left: `${x}%`, top: `${y}%` }} data-bad={atTurn || undefined} />
        </div>
        <div className="replay-coach" key={atTurn ? "turn" : "move"}>
          {atTurn ? (
            <>
              <ClassIcon cls="blunder" size={20} />
              <p>
                <b><span className="mv">
                    <Notation>{moveLabel(T.index + 1, m.san)}</Notation>
                  </span> left your {T.piece} hanging.</b> Your chances went from{" "}
                {T.before}% to {T.after}%.{" "} {T.best && (
                  <>
                    <span className="mv">
                      <Notation>{moveLabel(T.index + 1, T.best)}</Notation>
                    </span> kept it safe.
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <ClassIcon cls={cls(k)} size={20} />
              <p>
                <b>
                  <Notation>{moveLabel(k + 1, m.san)}</Notation>
                </b> {CLASS_META[cls(k)].label.toLowerCase()}
                <span className="replay-pct num">your chances {m.win}%</span>
              </p>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}
