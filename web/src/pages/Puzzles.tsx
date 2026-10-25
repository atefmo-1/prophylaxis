// Puzzles for a habit: five Lichess puzzles of the tactic behind it, at the player's level. The opponent's move
// plays first, as on Lichess; then find every move of the solution.
import { useEffect, useMemo, useState } from "react";
import { TAG_INFO } from "../analysis/catalog";
import { Board, type Movable } from "../components/Board";
import { IconNext } from "../components/Icons";
import { useOverview } from "../data";
import { levelFor, pickPuzzles, recordPuzzle, type Puzzle } from "../lib/puzzles";
import { dragToUci, isCheck, isMate, legalDests, pieceAt, playUci, sanOf } from "../lib/rules";
import { href } from "../router";
import "../review/review.css";
import "./pages.css";
import { LoadError } from "../components/LoadError";

const SESSION = 5;
const OPPONENT_DELAY = 500;

export function Puzzles({ tag }: { tag: string | null }) {
  const overview = useOverview();
  const rating = overview.status === "ready" && !overview.data.empty ? overview.data.player.rating : null;
  const [round, setRound] = useState(0);
  const [session, setSession] = useState<{ puzzles: Puzzle[]; level: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (overview.status !== "ready") return;
    const level = levelFor(tag, rating);
    let live = true;
    pickPuzzles(import.meta.env.BASE_URL, tag, level, SESSION)
      .then((puzzles) => live && setSession({ puzzles, level }))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [overview.status, tag, round, rating]);

  if (error) return <LoadError what="puzzles" detail={error} />;
  if (!session) return <div className="page" aria-busy="true" />;
  return <Session key={`${tag}-${round}`} {...session} tag={tag} rating={rating} onAgain={() => setRound((r) => r + 1)} />;
}

type Status = "opening" | "solving" | "solved" | "shown";

function Session({ puzzles, level, tag, rating, onAgain }: { puzzles: Puzzle[]; level: number; tag: string | null; rating: number | null; onAgain: () => void }) {
  const [step, setStep] = useState(0);
  const [clean, setClean] = useState<boolean[]>([]);
  const title = tag && TAG_INFO[tag] ? `Puzzles: ${TAG_INFO[tag].title.toLowerCase()}` : "Puzzles";

  if (step >= puzzles.length) {
    const solved = clean.filter(Boolean).length;
    return (
      <div className="page">
        <header className="page-top">
          <h1>
            {solved} of {puzzles.length} solved first time
          </h1>
          <p>Puzzles get a little harder each time you solve one first time, and a little easier when you don't.</p>
        </header>
        <div className="focus-actions">
          <button type="button" className="pbtn pbtn--primary" onClick={onAgain}>
            Another {SESSION}
          </button>
          <a className="pbtn" href={href({ name: "patterns" })}>
            Back to habits
          </a>
        </div>
      </div>
    );
  }
  return (
    <PuzzleBoard
      key={puzzles[step].id}
      puzzle={puzzles[step]}
      title={title}
      fix={tag ? TAG_INFO[tag]?.fix : undefined}
      index={step}
      total={puzzles.length}
      level={level}
      onDone={(first) => {
        recordPuzzle(tag, puzzles[step].id, first, rating);
        setClean((c) => [...c, first]);
      }}
      onNext={() => setStep((s) => s + 1)}
    />
  );
}

function PuzzleBoard(props: {
  puzzle: Puzzle;
  title: string;
  fix?: string;
  index: number;
  total: number;
  level: number;
  onDone: (firstTime: boolean) => void;
  onNext: () => void;
}) {
  const { puzzle, title, fix, index, total, level, onDone, onNext } = props;
  const solver = puzzle.fen.split(" ")[1] === "w" ? "black" : "white";
  const [fen, setFen] = useState(puzzle.fen);
  const [ply, setPly] = useState(0); // index of the next move of the line to be played
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("opening");
  const [missed, setMissed] = useState<string | null>(null);
  const [wrongOnce, setWrongOnce] = useState(false);
  const [hint, setHint] = useState<string | null>(null); // the square of the piece to look at, once asked

  // The opponent's moves (and, when shown, the whole answer) play by themselves.
  useEffect(() => {
    const auto = ply < puzzle.moves.length && (status === "shown" || (ply % 2 === 0 && status !== "solved"));
    if (!auto) return;
    const t = setTimeout(() => {
      const uci = puzzle.moves[ply];
      const next = playUci(fen, uci);
      if (!next) return;
      setFen(next);
      setLastMove(uci);
      setPly(ply + 1);
      if (status === "opening") setStatus("solving");
    }, status === "shown" ? 700 : OPPONENT_DELAY);
    return () => clearTimeout(t);
  }, [ply, status, fen, puzzle]);

  const finish = (how: "solved" | "shown") => {
    setStatus(how);
    onDone(how === "solved" && !wrongOnce);
  };

  const onMove = (orig: string, dest: string) => {
    const uci = dragToUci(fen, orig, dest);
    const expected = puzzle.moves[ply];
    const next = playUci(fen, uci);
    const last = ply === puzzle.moves.length - 1;
    // Any mate on the last move counts, as on Lichess.
    const right = uci === expected || (!!next && last && isMate(next));
    if (!right || !next) {
      setWrongOnce(true);
      setMissed(uci);
      return;
    }
    setMissed(null);
    setHint(null);
    setFen(next);
    setLastMove(uci);
    setPly(ply + 1);
    if (last) finish("solved");
  };

  const solving = status === "solving" && ply % 2 === 1;
  const movable: Movable | null = solving ? { color: solver, dests: legalDests(fen), onMove } : null;
  const done = status === "solved" || status === "shown";
  const yourMoves = useMemo(() => {
    let f = puzzle.fen;
    return puzzle.moves.map((uci, i) => {
      const san = sanOf(f, uci);
      f = playUci(f, uci) ?? f;
      return i % 2 === 1 ? san : null;
    });
  }, [puzzle]);
  const answer = yourMoves.filter(Boolean).join(", then ");

  return (
    <div className="rv rv--drill">
      <h1 className="visually-hidden">{title}</h1>
      <div className="rv-grid">
        <div className="rv-top strip">
          <span className="strip-name">Lichess puzzle, rated {puzzle.rating}</span>
          <span className="strip-acc" title="Lichess puzzle ratings run a few hundred points above chess.com game ratings">your puzzle level {level}</span>
        </div>
        <div className="rv-eval" />
        <div className="rv-board">
          <Board
            fen={fen}
            orientation={solver}
            lastMove={lastMove}
            check={isCheck(fen)}
            movable={movable}
            label={solving ? `Find the best move for ${solver}` : `Puzzle position, ${solver} to play`}
          />
        </div>
        <div className="rv-bottom strip">
          <span className="strip-name">You play {solver}</span>
        </div>

        <section className="rv-panel" aria-label="Puzzle">
          <header className="panel-head">
            <div className="panel-title">
              <span>{title}</span>
              <small className="num">
                {index + 1} of {total}
              </small>
            </div>
          </header>
          <div className="panel-body">
            <div className="coach" aria-live="polite">
              {!done ? (
                <>
                  <h2>{status === "opening" ? "Watch your opponent's move…" : `Your move: find the best move for ${solver}.`}</h2>
                  {missed && (
                    <p className="coach-feedback coach-feedback--no" key={missed}>Not this one: {sanOf(fen, missed)} doesn't work here. Try another move.</p>
                  )}
                  {ply > 1 && !missed && <p className="coach-feedback coach-feedback--yes">Good. Keep going: what's next?</p>}
                  {hint && (
                    <p className="coach-feedback">
                      Hint: look at your {pieceAt(fen, hint)} on {hint}.
                    </p>
                  )}
                  <div className="coach-actions">
                    <button type="button" className="btn" onClick={() => setHint(puzzle.moves[ply]?.slice(0, 2) ?? null)} disabled={!solving}>
                      Hint
                    </button>
                    <button type="button" className="btn" onClick={() => finish("shown")} disabled={status === "opening"}>
                      Show the answer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={`coach-feedback ${status === "solved" && !wrongOnce ? "coach-feedback--yes" : ""}`}>
                    {status === "solved" ? (wrongOnce ? "Solved, after a wrong try." : "Solved first time.") : `The answer: ${answer}.`}
                  </p>
                  {fix && <p className="coach-habit">{fix}</p>}
                  <div className="coach-actions">
                    <a className="btn" href={`https://lichess.org/training/${puzzle.id}`} target="_blank" rel="noreferrer">
                      On Lichess
                    </a>
                    <button type="button" className="btn btn--primary" onClick={onNext}>
                      {index + 1 === total ? "Finish" : "Next puzzle"} <IconNext />
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
