// The game review: board first, coach panel beside it. Opens on a summary, then key moments as retry puzzles.
import { useCallback, useEffect, useState } from "react";
import { Board, type Arrow, type Movable } from "../components/Board";
import { ClassIcon } from "../components/ClassIcon";
import { IconFirst, IconLast, IconNext, IconPrev } from "../components/Icons";
import { FirstReview } from "../components/Progress";
import { useGame, useGames } from "../data";
import { useLibrary } from "../library/Library";
import { read } from "../lib/coach";
import { chancesAround, explain, tagSentence } from "../lib/explain";
import { CLASS_META, dayTime, moveLabel, plural, timeControl } from "../lib/format";
import { recordAttempt } from "../lib/practice";
import { dragToUci, legalDests, pieceAt, sanOf, uciOfSan } from "../lib/rules";
import { href, replacePly } from "../router";
import type { GameReview as ReviewData, MoveClass, MoveTag } from "../types";
import { EvalBar, Graph, PlayerStrip, Scoresheet } from "./parts";
import "./review.css";

const BAD: MoveClass[] = ["inaccuracy", "mistake", "miss", "blunder"];
const SUMMARY_CLASSES: MoveClass[] = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"];
const PHASE_NAME: Record<string, string> = { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" };

type Mode = { kind: "summary" } | { kind: "moments"; step: number } | { kind: "moves" } | { kind: "done" };
type Attempt = { status: "trying" | "found" | "shown" | "skipped"; tries: string[]; last: string | null };

/** The tag that best explains a move: what it allowed beats what it missed beats the clock. */
function mainTag(tags: MoveTag[]): MoveTag | undefined {
  const order = (t: MoveTag) => (t.tag.startsWith("missed_") ? 1 : t.tag === "time_pressure" || t.tag === "rushed" ? 2 : 0);
  return [...tags].sort((a, b) => order(a) - order(b))[0];
}

function HabitLine({ review, tags }: { review: ReviewData; tags: MoveTag[] }) {
  const tag = mainTag(tags);
  const habit = tag && review.habits[tag.tag];
  const info = tag && review.tag_info[tag.tag];
  if (!tag || !habit || !info) return null;
  return (
    <p className="coach-habit">
      {info.title}
      {habit.rank ? ` is your #${habit.rank} habit` : ""}: it shows up in{" "}
      <b>
        {habit.recent_games} of your last {habit.window} games
      </b>
      . <a href={href({ name: "patterns" })}>See the pattern</a>
    </p>
  );
}

function Summary({ review, onStart, onMoves }: { review: ReviewData; onStart: () => void; onMoves: () => void }) {
  const coach = read(review);
  const g = review.game;
  const count = (side: "mine" | "theirs", c: MoveClass) => review.summary[side][c] ?? 0;
  const k = review.key_moments.length;
  return (
    <div className="summary">
      <h1>{g.ending}</h1>
      <p className="summary-story">{coach.story}</p>

      <table className="rv-sumtable">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Grade</span>
            </th>
            <th scope="col">You</th>
            <th scope="col">{g.opponent}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="summary-acc">
            <th scope="row">Accuracy</th>
            <td className="num">{g.accuracy?.toFixed(1) ?? "–"}</td>
            <td className="num">{g.opp_accuracy?.toFixed(1) ?? "–"}</td>
          </tr>
          {SUMMARY_CLASSES.filter((c) => count("mine", c) + count("theirs", c) > 0).map((c) => (
            <tr key={c}>
              <th scope="row">
                <span className="rv-sumlabel">
                  <ClassIcon cls={c} size={16} />
                  {CLASS_META[c].label}
                </span>
              </th>
              <td className="num">{count("mine", c)}</td>
              <td className="num">{count("theirs", c)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="summary-phases" aria-label="Your play by phase">
        {review.phases.map((ph) => (
          <li key={ph.phase}>
            <ClassIcon cls={ph.mistakes ? ph.worst_class : "good"} size={16} />
            <span>{PHASE_NAME[ph.phase]}</span>
            <small className="num">{ph.mistakes ? plural(ph.mistakes, "mistake") : "clean"}</small>
          </li>
        ))}
      </ul>

      <div className="summary-actions">
        {k > 0 ? (
          <button type="button" className="btn btn--primary" onClick={onStart}>
            Review {k === 1 ? "the key moment" : `${k} key moments`}
          </button>
        ) : (
          <p className="muted">No mistakes to review in this game.</p>
        )}
        <button type="button" className="btn" onClick={onMoves}>
          Every move
        </button>
      </div>
    </div>
  );
}

export function Review({ id, ply }: { id: string | null; ply: number | null }) {
  const games = useGames();
  const list = games.status === "ready" ? games.data : [];
  const gameId = id ?? list[0]?.id ?? null;
  const review = useGame(gameId);
  const { player } = useLibrary();

  if (games.status === "error") return <p className="state">Couldn't load your games ({games.error}).</p>;
  if (games.status === "ready" && list.length === 0) return <FirstReview />;
  if (review.status === "error") return <p className="state">Couldn't load this game ({review.error}).</p>;
  if (review.status === "loading") return <div className="rv rv--loading" aria-busy="true" />;

  const position = list.findIndex((g) => g.id === review.data.game.id);
  const newer = position > 0 ? list[position - 1].id : null;
  const older = position >= 0 && position < list.length - 1 ? list[position + 1].id : null;
  return <ReviewView key={review.data.game.id} review={review.data} player={player ?? "You"} initialPly={ply} newer={newer} older={older} />;
}

/** The review for one game's data. Also used by the Chrome extension's side panel. */
export function ReviewView({
  review,
  player = "You",
  initialPly = null,
  newer = null,
  older = null,
  startMode = "summary",
}: {
  review: ReviewData;
  player?: string;
  initialPly?: number | null;
  newer?: string | null;
  older?: string | null;
  startMode?: "summary" | "moments";
}) {
  const g = review.game;
  const n = review.moves.length;
  const moments = review.key_moments;
  const openOnMoments = startMode === "moments" && initialPly === null && moments.length > 0;
  const [mode, setMode] = useState<Mode>(
    initialPly !== null ? { kind: "moves" } : openOnMoments ? { kind: "moments", step: 0 } : { kind: "summary" },
  );
  const [index, setIndex] = useState(
    initialPly !== null ? Math.min(n - 1, Math.max(-1, initialPly - 1)) : openOnMoments ? moments[0] - 1 : -1,
  );
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
  const [threat, setThreat] = useState(false);

  const go = useCallback(
    (i: number) => {
      const next = Math.min(n - 1, Math.max(-1, i));
      setIndex(next);
      setThreat(false);
      replacePly(g.id, next + 1);
    },
    [n, g.id],
  );
  const stepMoves = useCallback(
    (i: number) => {
      setMode({ kind: "moves" });
      go(i);
    },
    [go],
  );

  // Arrow keys always step through the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest("input, textarea")) return;
      const map: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: -1, End: n - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      stepMoves(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, n, stepMoves]);

  // ----- key-moment retry -----
  const momentPly = mode.kind === "moments" ? moments[mode.step] : null;
  const moment = momentPly !== null ? review.moves[momentPly - 1] : null;
  const attempt: Attempt = (momentPly !== null && attempts[momentPly]) || { status: "trying", tries: [], last: null };
  const beforeFen = momentPly !== null ? (momentPly === 1 ? review.start_fen : review.moves[momentPly - 2].fen) : null;

  const startMoments = (step = 0) => {
    setMode({ kind: "moments", step });
    setThreat(false);
    go(moments[step] - 1);
  };

  const finishMoment = (status: Attempt["status"], uci: string | null) => {
    if (momentPly === null) return;
    setAttempts((a) => ({ ...a, [momentPly]: { status, tries: a[momentPly]?.tries ?? [], last: uci } }));
    recordAttempt(g.id, momentPly, status === "found");
  };

  const onRetryMove = (orig: string, dest: string) => {
    if (!moment || !beforeFen || !moment.retry) return;
    const uci = dragToUci(beforeFen, orig, dest);
    if (moment.retry.accept.includes(uci)) {
      finishMoment("found", uci);
    } else {
      setAttempts((a) => ({ ...a, [momentPly!]: { status: "trying", tries: [...(a[momentPly!]?.tries ?? []), uci], last: uci } }));
    }
  };

  const nextMoment = () => {
    if (mode.kind !== "moments") return;
    if (mode.step + 1 < moments.length) startMoments(mode.step + 1);
    else setMode({ kind: "done" });
  };

  // ----- what the board shows -----
  const move = index >= 0 ? review.moves[index] : null;
  let fen = move ? move.fen : review.start_fen;
  let lastMove = move?.uci ?? null;
  let arrows: Arrow[] = [];
  let badge: { square: string; cls: MoveClass } | null = move ? { square: move.uci.slice(2, 4), cls: move.class } : null;
  let movable: Movable | null = null;
  let check = !!move && /[+#]$/.test(move.san);

  if (mode.kind === "moments" && moment && beforeFen) {
    const prev = momentPly! >= 2 ? review.moves[momentPly! - 2] : null;
    if (attempt.status === "trying") {
      fen = beforeFen;
      lastMove = prev?.uci ?? null;
      badge = null;
      check = !!prev && /[+#]$/.test(prev.san);
      movable = { color: g.color, dests: legalDests(beforeFen), onMove: onRetryMove };
    } else if (threat) {
      fen = moment.fen;
      lastMove = moment.uci;
      badge = { square: moment.uci.slice(2, 4), cls: moment.class };
      const reply = moment.reply_line[0] ? uciOfSan(moment.fen, moment.reply_line[0]) : null;
      arrows = reply ? [{ uci: reply, brush: "threat" }] : [];
      check = /[+#]$/.test(moment.san);
    } else {
      fen = beforeFen;
      lastMove = prev?.uci ?? null;
      badge = null;
      const shown = attempt.status === "found" ? attempt.last : moment.best_uci;
      arrows = shown ? [{ uci: shown, brush: "best" }] : [];
    }
  } else if (mode.kind === "moves" && move && move.mine && BAD.includes(move.class) && !move.decided && move.best_uci && move.best_uci !== move.uci) {
    arrows = [{ uci: move.best_uci, brush: "best" }];
  }

  // The eval bar follows the position on the board: before the mistake while you look for a better move.
  const shownPly = mode.kind === "moments" && momentPly !== null && !threat ? momentPly - 1 : index + 1;
  const whiteWin = shownPly >= 1 ? review.moves[shownPly - 1].win_white : review.start_win_white;
  const me = { name: player, rating: g.rating, change: g.rating_change, accuracy: g.accuracy, color: g.color };
  const them = { name: g.opponent, rating: g.opp_rating, change: null, accuracy: g.opp_accuracy, color: g.color === "white" ? ("black" as const) : ("white" as const) };
  const nextMistake = review.moves.findIndex((m, i) => i > index && m.mine && BAD.includes(m.class) && !m.decided);

  const boardLabel =
    mode.kind === "moments" && attempt.status === "trying"
      ? `Find a better move for ${g.color}`
      : move
        ? `Position after ${moveLabel(move.ply, move.san)}`
        : "Starting position";

  return (
    <div className="rv">
      <div className="rv-grid">
        <div className="rv-top">
          <PlayerStrip {...them} />
        </div>
        <div className="rv-eval">
          <EvalBar whiteWin={whiteWin} orientation={g.color} />
        </div>
        <div className="rv-board">
          <Board fen={fen} orientation={g.color} lastMove={lastMove} check={check} arrows={arrows} badge={badge} movable={movable} label={boardLabel} />
        </div>
        <div className="rv-bottom">
          <PlayerStrip {...me} you />
        </div>

        <section className="rv-panel" aria-label="Review">
          <header className="panel-head">
            <div className="panel-title">
              <span>vs {g.opponent}</span>
              <small>
                {timeControl(g.time_control)} · {dayTime(g.t)}
              </small>
            </div>
            <nav className="panel-tabs" aria-label="Review mode">
              <button type="button" aria-pressed={mode.kind === "summary"} onClick={() => setMode({ kind: "summary" })}>
                Summary
              </button>
              <button type="button" aria-pressed={mode.kind === "moments" || mode.kind === "done"} onClick={() => moments.length && startMoments(0)} disabled={!moments.length}>
                Key moments
              </button>
              <button type="button" aria-pressed={mode.kind === "moves"} onClick={() => stepMoves(index)}>
                Moves
              </button>
            </nav>
          </header>

          <div className="panel-body">
            {mode.kind === "summary" && <Summary review={review} onStart={() => startMoments(0)} onMoves={() => stepMoves(-1)} />}

            {mode.kind === "moments" && moment && beforeFen && (
              <MomentCard
                review={review}
                step={mode.step}
                ply={momentPly!}
                attempt={attempt}
                beforeFen={beforeFen}
                threat={threat}
                onHint={() => setAttempts((a) => ({ ...a, [momentPly!]: { ...attempt, last: "hint" } }))}
                onShow={() => finishMoment("shown", moment.best_uci)}
                onSkip={() => {
                  finishMoment("skipped", null);
                  nextMoment();
                }}
                onThreat={() => setThreat((t) => !t)}
                onNext={nextMoment}
              />
            )}

            {mode.kind === "done" && (
              <div className="coach">
                <h2>
                  Done: {moments.filter((p) => attempts[p]?.status === "found").length} of {moments.length} found
                </h2>
                <p>Positions you didn't find come back in practice tomorrow.</p>
                <div className="summary-actions">
                  <button type="button" className="btn btn--primary" onClick={() => stepMoves(-1)}>
                    Step through every move
                  </button>
                  <button type="button" className="btn" onClick={() => setMode({ kind: "summary" })}>
                    Back to the summary
                  </button>
                </div>
              </div>
            )}

            {mode.kind === "moves" && <MoveNote review={review} index={index} />}

            {mode.kind !== "summary" && <Scoresheet moves={review.moves} index={index} onSelect={stepMoves} />}
          </div>

          <footer className="panel-foot">
            <Graph review={review} index={index} onSelect={stepMoves} />
            <div className="controls">
              <button type="button" className="btn btn--icon" onClick={() => stepMoves(-1)} disabled={index === -1} aria-label="First position">
                <IconFirst />
              </button>
              <button type="button" className="btn btn--icon" onClick={() => stepMoves(index - 1)} disabled={index === -1} aria-label="Previous move">
                <IconPrev />
              </button>
              <button type="button" className="btn btn--icon" onClick={() => stepMoves(index + 1)} disabled={index === n - 1} aria-label="Next move">
                <IconNext />
              </button>
              <button type="button" className="btn btn--icon" onClick={() => stepMoves(n - 1)} disabled={index === n - 1} aria-label="Last move">
                <IconLast />
              </button>
              <button type="button" className="btn controls-next" onClick={() => stepMoves(nextMistake)} disabled={nextMistake < 0}>
                Next mistake
              </button>
            </div>
            <p className="panel-games">
              {newer ? <a href={href({ name: "game", id: newer, ply: null })}>Newer game</a> : <span />}
              {g.url.startsWith("https://www.chess.com/") ? (
                <a href={g.url} target="_blank" rel="noreferrer">
                  Open on chess.com
                </a>
              ) : (
                <span />
              )}
              {older ? <a href={href({ name: "game", id: older, ply: null })}>Older game</a> : <span />}
            </p>
          </footer>
        </section>
      </div>
    </div>
  );
}

function MomentCard({
  review,
  step,
  ply,
  attempt,
  beforeFen,
  threat,
  onHint,
  onShow,
  onSkip,
  onThreat,
  onNext,
}: {
  review: ReviewData;
  step: number;
  ply: number;
  attempt: Attempt;
  beforeFen: string;
  threat: boolean;
  onHint: () => void;
  onShow: () => void;
  onSkip: () => void;
  onThreat: () => void;
  onNext: () => void;
}) {
  const m = review.moves[ply - 1];
  const g = review.game;
  const total = review.key_moments.length;
  const [before, after] = chancesAround(review, ply - 1);
  const wins = m.retry?.wins ?? {};
  const lastTry = attempt.tries[attempt.tries.length - 1];
  const tag = mainTag(m.tags);
  const why = tag ? tagSentence(tag, m) : null;
  const hintPiece = m.best_uci ? pieceAt(beforeFen, m.best_uci.slice(0, 2)) : null;
  const last = step + 1 === total;

  return (
    <div className="coach">
      <p className="coach-step">
        Key moment {step + 1} of {total}
        <span className="coach-dots" aria-hidden="true">
          {review.key_moments.map((p, i) => (
            <i key={p} data-on={i <= step || undefined} />
          ))}
        </span>
      </p>

      {attempt.status === "trying" ? (
        <>
          <h2>
            You played {moveLabel(ply, m.san)}. Find a better move for {g.color}.
          </h2>
          {lastTry && (
            <p className="coach-feedback coach-feedback--no">
              Not quite: {sanOf(beforeFen, lastTry)} leaves your chances at {Math.round(wins[lastTry] ?? 0)}%. Try another move.
            </p>
          )}
          {attempt.last === "hint" && hintPiece && m.best_uci && (
            <p className="coach-feedback">
              Hint: look at your {hintPiece} on {m.best_uci.slice(0, 2)}.
            </p>
          )}
          <div className="coach-actions">
            <button type="button" className="btn" onClick={onHint}>
              Hint
            </button>
            <button type="button" className="btn" onClick={onShow}>
              Show the answer
            </button>
            <button type="button" className="btn btn--quiet" onClick={onSkip}>
              Skip
            </button>
          </div>
        </>
      ) : (
        <>
          {attempt.status === "found" && attempt.last ? (
            <p className="coach-feedback coach-feedback--yes">
              {attempt.last === m.best_uci
                ? `Good move. ${sanOf(beforeFen, attempt.last)} is the engine's choice too.`
                : `Good move. ${sanOf(beforeFen, attempt.last)} holds your position; the engine's choice was ${m.best}.`}
            </p>
          ) : (
            <p className="coach-feedback">The answer was {m.best}.</p>
          )}
          <h2 className="coach-verdict">
            <ClassIcon cls={m.class} size={20} />
            {m.san} was a {CLASS_META[m.class].label.toLowerCase()}: your chances went from {Math.round(before)}% to {Math.round(after)}%.
          </h2>
          {why ? <p>{why}</p> : m.reply_line[0] && <p>It allowed {m.reply_line[0]}.</p>}
          <HabitLine review={review} tags={m.tags} />
          <div className="coach-actions">
            {m.reply_line[0] && (
              <button type="button" className="btn" aria-pressed={threat} onClick={onThreat}>
                {threat ? "Back to the better move" : `Show what ${m.san} allowed`}
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={onNext}>
              {last ? "Finish" : "Next key moment"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MoveNote({ review, index }: { review: ReviewData; index: number }) {
  if (index < 0) {
    return (
      <div className="coach coach--compact">
        <h2>Starting position</h2>
        <p className="muted">Use the arrow keys or the buttons below to step through the game.</p>
      </div>
    );
  }
  const m = review.moves[index];
  const e = explain(review, index);
  return (
    <div className="coach coach--compact" aria-live="polite">
      <h2 className="coach-move">
        <ClassIcon cls={m.class} size={20} />
        <span>{e.heading}</span>
        <span className={`coach-class coach-class--${m.class}`}>{CLASS_META[m.class].label}</span>
        {!m.mine && <small>their move</small>}
      </h2>
      {m.decided ? (
        <p className="muted">The game was already decided here, so this grade matters little.</p>
      ) : (
        <>
          <p>{e.chances}</p>
          {e.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          {m.mine && BAD.includes(m.class) && <HabitLine review={review} tags={m.tags} />}
        </>
      )}
    </div>
  );
}
