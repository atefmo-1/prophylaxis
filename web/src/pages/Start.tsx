// The first screen: one question, your chess.com username. Everything after it runs in this browser.
import { useEffect, useState, type FormEvent } from "react";
import { Board, type Arrow } from "../components/Board";
import { ClassIcon } from "../components/ClassIcon";
import { CLASS_META, moveLabel, REPO } from "../lib/format";
import { sanOf, uciOfSan } from "../lib/rules";
import type { MoveClass } from "../types";
import { helloExtension } from "../library/bridge";
import { PlayerNotFound } from "../library/chesscom";
import { useLibrary } from "../library/Library";
import { DEMO } from "./startDemo";
import "./start.css";

const T = DEMO.turn;
const cls = (i: number) => DEMO.moves[i].cls as MoveClass;

export function Start() {
  const { start, startSample } = useLibrary();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Chrome extension, when installed, already knows the player: offer to continue as them.
  const [known, setKnown] = useState<string | null>(null);

  useEffect(() => {
    helloExtension(null).then((hello) => setKnown(hello?.username ?? null));
  }, []);

  const go = async (username: string) => {
    setBusy(true);
    setError(null);
    try {
      await start(username);
    } catch (err) {
      setError(err instanceof PlayerNotFound ? err.message : `Couldn't reach chess.com: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) go(name);
  };

  return (
    <div className="start">
      <section className="start-hero">
        <div className="start-copy">
          <h1>Find the move that lost the game. Then the habit behind it.</h1>
          <p className="start-lede">
            Prophylaxis reviews your chess.com games with Stockfish, right here in your browser. Free, with no account,
            and your games never leave your browser.
          </p>
          {known && (
            <div className="start-known">
              <p>Your Prophylaxis extension knows you as {known}.</p>
              <button type="button" className="start-go" disabled={busy} onClick={() => go(known)}>
                Continue as {known}
              </button>
            </div>
          )}
          <form className="start-form" onSubmit={submit}>
            <label htmlFor="username">Your chess.com username</label>
            <div className="start-row">
              <input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. magnuscarlsen"
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
        <h2 id="pattern-title">One hanging piece is bad luck. Five games in ten is a habit.</h2>
        <div className="start-pattern-grid">
          <div className="frag frag-habit">
            <p className="frag-label">Across your games</p>
            <p className="frag-title">Left a piece hanging</p>
            <ol className="habit-row" aria-label={`In ${DEMO.habit.filter(Boolean).length} of the last 10 games`}>
              {DEMO.habit.map((hit, i) => (
                <li key={i} data-hit={hit || undefined} style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </ol>
            <p className="frag-foot">
              <span>Last 10 games, oldest first</span>
              <b className="num">{DEMO.habit.filter(Boolean).length} of 10</b>
            </p>
          </div>
          <div className="frag frag-practice">
            <div className="frag-board" aria-hidden="true">
              <Board fen={DEMO.moves[T.index - 1].fen} orientation={DEMO.color as "white" | "black"} label="" coordinates={false} />
            </div>
            <div>
              <p className="frag-label">Before your next game</p>
              <p className="frag-title">Find a better move for {DEMO.color}.</p>
              <p className="frag-text">
                Practice comes from your own mistakes. Here, {T.accept.map((u) => sanOf(DEMO.moves[T.index - 1].fen, u)).join(", ").replace(/, ([^,]*)$/, " or $1")} keep the
                queen safe.
              </p>
            </div>
          </div>
        </div>
      </section>

      <p className="start-note">
        Your games are already public on chess.com. Your analysis stays in this browser, and you can delete it at any time.
        It reviews finished games only, never one in progress. The optional{" "}
        <a href={`${REPO}#the-chrome-extension-optional`}>Chrome extension</a> opens each review beside the board when a
        game ends. <a href={REPO}>Open source</a>.
      </p>
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
          <span>You vs {DEMO.opponent}</span>
          <span className="replay-tag">Sample game</span>
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
                      {DEMO.moves[j].san}
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
                <b><span className="mv">{moveLabel(T.index + 1, m.san)}</span> left your {T.piece} hanging.</b> Your chances went from{" "}
                {T.before}% to {T.after}%.{" "} {T.best && (
                  <>
                    <span className="mv">{moveLabel(T.index + 1, T.best)}</span> kept it safe.
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <ClassIcon cls={cls(k)} size={20} />
              <p>
                <b>{moveLabel(k + 1, m.san)}</b> {CLASS_META[cls(k)].label.toLowerCase()}
                <span className="replay-pct num">your chances {m.win}%</span>
              </p>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}
