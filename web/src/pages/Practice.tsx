// Practice: five positions from your own games, due ones first, then your top habits. Same retry as the review.
import { useMemo, useState } from "react";
import { Board, type Movable } from "../components/Board";
import { ClassIcon } from "../components/ClassIcon";
import { IconNext } from "../components/Icons";
import { NotEnough } from "../components/Progress";
import { useOverview, usePractice } from "../data";
import { tagSentence } from "../lib/explain";
import { CLASS_META, day, moveLabel } from "../lib/format";
import { loadPractice, recordAttempt } from "../lib/practice";
import { hasPuzzles } from "../lib/puzzles";
import { tacticArrows } from "../lib/shapes";
import { dragToUci, legalDests, pieceAt, sanOf } from "../lib/rules";
import { href } from "../router";
import { EvalBar } from "../review/parts";
import type { Move, PracticePosition, TagInfo } from "../types";
import "../review/review.css";
import "./pages.css";

const SESSION = 5;

function buildSession(pool: PracticePosition[], tag: string | null, rank: Map<string, number>): PracticePosition[] {
  const now = Date.now();
  const stored = loadPractice();
  const seen = new Set(stored.map((i) => `${i.game}-${i.ply}`));
  const matches = (p: PracticePosition) => !tag || p.tags.some((t) => t.tag === tag);
  const due = stored
    .filter((i) => i.due <= now)
    .map((i) => pool.find((p) => p.game === i.game && p.ply === i.ply))
    .filter((p): p is PracticePosition => !!p && matches(p));
  const best = (p: PracticePosition) => Math.min(...p.tags.map((t) => rank.get(t.tag) ?? 99), 99);
  const fresh = pool.filter((p) => !seen.has(p.id) && matches(p)).sort((a, b) => best(a) - best(b));
  return [...due, ...fresh].slice(0, SESSION);
}

type Attempt = { status: "trying" | "found" | "shown"; tries: string[]; hint: boolean; found: string | null };
const fresh: Attempt = { status: "trying", tries: [], hint: false, found: null };

export function Practice({ tag }: { tag: string | null }) {
  const pool = usePractice();
  const overview = useOverview();
  const [round, setRound] = useState(0);

  const ready = pool.status === "ready" && overview.status === "ready";
  // Positions arrive while games are reviewed: build the first session once there are some, then keep it steady.
  const none = pool.status === "ready" && pool.data.length === 0;
  const info = new Map<string, TagInfo>(ready && !overview.data.empty ? overview.data.weaknesses.map((w) => [w.tag, w]) : []);
  const session = useMemo(() => {
    if (pool.status !== "ready" || overview.status !== "ready" || overview.data.empty) return [];
    const rank = new Map(overview.data.weaknesses.map((w, i) => [w.tag, i]));
    return buildSession(pool.data, tag, rank);
    // A new round rebuilds the session from what is due now.
  }, [pool.status, overview.status, tag, round, none]);

  if (pool.status === "error") return <p className="pstate">Couldn't load practice positions ({pool.error}).</p>;
  if (!ready) return <div className="page" aria-busy="true" />;
  if (none) return <NotEnough title="Practice needs a few games" when="Positions appear here as soon as a reviewed game has a mistake to try again." />;
  return <Session key={`${tag}-${round}`} session={session} tag={tag} info={info} onAgain={() => setRound((r) => r + 1)} />;
}

function Session({ session, tag, info, onAgain }: { session: PracticePosition[]; tag: string | null; info: Map<string, TagInfo>; onAgain: () => void }) {
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>(fresh);
  const [results, setResults] = useState<boolean[]>([]);
  const title = tag ? (info.get(tag)?.title ?? "Practice") : "Practice";

  if (session.length === 0) {
    return (
      <div className="page">
        <header className="page-top">
          <h1>{title}</h1>
          <p>Nothing to practice right now: every position here is scheduled for later. Come back tomorrow.</p>
        </header>
        <div className="focus-actions">
          {tag && (
            <a className="pbtn" href={href({ name: "practice", tag: null })}>
              Practice any habit
            </a>
          )}
          <a className="pbtn" href={href({ name: "patterns" })}>
            Back to habits
          </a>
        </div>
      </div>
    );
  }

  if (step >= session.length) {
    const found = results.filter(Boolean).length;
    return (
      <div className="page">
        <header className="page-top">
          <h1>
            Session done: {found} of {session.length} found
          </h1>
          <p>Positions you found come back in a few days; the ones you missed come back tomorrow.</p>
        </header>
        <div className="focus-actions">
          <button type="button" className="pbtn pbtn--primary" onClick={onAgain}>
            Another {SESSION}
          </button>
          {hasPuzzles(tag) && (
            <a className="pbtn" href={href({ name: "puzzles", tag })}>
              {SESSION} puzzles like these
            </a>
          )}
          <a className="pbtn" href={href({ name: "patterns" })}>
            Back to habits
          </a>
        </div>
      </div>
    );
  }

  const p = session[step];
  const finish = (status: "found" | "shown", uci: string | null) => {
    setAttempt((a) => ({ ...a, status, found: uci }));
    setResults((r) => [...r, status === "found"]);
    recordAttempt(p.game, p.ply, status === "found");
  };
  const onMove = (orig: string, dest: string) => {
    const uci = dragToUci(p.fen, orig, dest);
    if (p.accept.includes(uci)) finish("found", uci);
    else setAttempt((a) => ({ ...a, tries: [...a.tries, uci] }));
  };
  const next = () => {
    setStep((s) => s + 1);
    setAttempt(fresh);
  };

  const trying = attempt.status === "trying";
  const movable: Movable | null = trying ? { color: p.color, dests: legalDests(p.fen), onMove } : null;
  const shown = attempt.status === "found" ? attempt.found : p.best_uci;
  const lastTry = attempt.tries[attempt.tries.length - 1];
  const asMove = { best: p.best } as Move;
  const why = p.tags.map((t) => tagSentence(t, asMove)).find(Boolean);
  const habit = p.tags.map((t) => info.get(t.tag)).find(Boolean);
  const whiteWin = p.color === "white" ? p.before : 100 - p.before;

  return (
    <div className="rv">
      <h1 className="visually-hidden">Practice: position {step + 1} of {session.length}</h1>
      <div className="rv-grid">
        <div className="rv-top strip">
          <span className="strip-name">
            From your game vs {p.opponent}
          </span>
          <span className="strip-acc">{day(p.t)}</span>
        </div>
        <div className="rv-eval">
          <EvalBar whiteWin={whiteWin} orientation={p.color} />
        </div>
        <div className="rv-board">
          <Board
            fen={p.fen}
            orientation={p.color}
            movable={movable}
            arrows={!trying && shown ? tacticArrows(p.fen, shown, "best") : []}
            label={trying ? `Find a better move for ${p.color}` : "Solution"}
          />
        </div>
        <div className="rv-bottom strip">
          <span className="strip-name">You played {p.color}</span>
        </div>

        <section className="rv-panel" aria-label="Practice">
          <header className="panel-head">
            <div className="panel-title">
              <span>{title}</span>
              <small className="num">
                {step + 1} of {session.length}
              </small>
            </div>
          </header>
          <div className="panel-body">
            <div className="coach" aria-live="polite">
              <p className="coach-step">
                Position {step + 1}
                <span className="coach-dots" aria-hidden="true">
                  {session.map((s, i) => (
                    <i key={s.id} data-on={i <= step || undefined} />
                  ))}
                </span>
              </p>
              {trying ? (
                <>
                  <h2>
                    In the game you played {moveLabel(p.ply, p.san)}. Find a better move for {p.color}.
                  </h2>
                  {lastTry && (
                    <p className="coach-feedback coach-feedback--no" key={attempt.tries.length}>
                      Not quite: {sanOf(p.fen, lastTry)} leaves your chances at {Math.round(p.wins[lastTry] ?? 0)}%. Try another move.
                    </p>
                  )}
                  {attempt.hint && p.best_uci && (
                    <p className="coach-feedback">
                      Hint: look at your {pieceAt(p.fen, p.best_uci.slice(0, 2))} on {p.best_uci.slice(0, 2)}.
                    </p>
                  )}
                  <div className="coach-actions">
                    <button type="button" className="btn" onClick={() => setAttempt((a) => ({ ...a, hint: true }))}>
                      Hint
                    </button>
                    <button type="button" className="btn" onClick={() => finish("shown", p.best_uci)}>
                      Show the answer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={`coach-feedback ${attempt.status === "found" ? "coach-feedback--yes" : ""}`}>
                    {attempt.status === "found" && attempt.found
                      ? attempt.found === p.best_uci
                        ? `Good move. ${sanOf(p.fen, attempt.found)} is the engine's choice too.`
                        : `Good move. ${sanOf(p.fen, attempt.found)} works; the engine's choice was ${p.best}.`
                      : `The answer was ${p.best}.`}
                  </p>
                  <h2 className="coach-verdict">
                    <ClassIcon cls={p.class} size={20} />
                    In the game, {p.san} was a {CLASS_META[p.class].label.toLowerCase()}: your chances went from {Math.round(p.before)}% to{" "}
                    {Math.round(p.after)}%.
                  </h2>
                  {why ? <p>{why}</p> : p.reply && <p>It allowed {p.reply}.</p>}
                  {habit && <p className="coach-habit">{habit.fix}</p>}
                  <div className="coach-actions">
                    <a className="btn" href={href({ name: "game", id: p.game, ply: p.ply })}>
                      See it in the game
                    </a>
                    <button type="button" className="btn btn--primary" onClick={next}>
                      {step + 1 === session.length ? "Finish" : "Next position"} <IconNext />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
