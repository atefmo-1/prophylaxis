// How the background review is going: a compact line in the top bar, and a full view for when there's nothing to
// show yet (your first game replays on the board as Stockfish reads it).
import { useLibrary, useLibraryStatus } from "../library/Library";
import { Board } from "./Board";
import "./progress.css";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function ProgressPill() {
  const status = useLibraryStatus();
  if (status.kind === "checking") return <span className="pill">Checking chess.com for new games…</span>;
  if (status.kind === "error")
    return (
      <span className="pill pill--error" title={status.message}>
        Couldn't reach chess.com
      </span>
    );
  if (status.kind !== "analysing") return null;
  const share = (status.done + (status.current?.percent ?? 0) / 100) / status.total;
  return (
    <span className="pill" aria-live="polite">
      Reviewing game {status.done + 1} of {status.total}
      <span className="pill-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${share})` }} />
      </span>
    </span>
  );
}

/** Shown while the player has no reviewed games yet. */
export function FirstReview() {
  const { player } = useLibrary();
  const status = useLibraryStatus();

  if (status.kind === "error")
    return (
      <div className="first">
        <h1>Couldn't load your games</h1>
        <p className="first-line">{status.message}</p>
      </div>
    );
  if (status.kind !== "analysing" || !status.current)
    return status.kind === "checking" ? (
      <div className="first">
        <h1>Loading your games from chess.com…</h1>
        <p className="first-line">This takes a few seconds.</p>
      </div>
    ) : (
      <div className="first">
        <h1>No games to review yet</h1>
        <p className="first-line">
          {player} has no finished standard chess games on chess.com in the last two years. Play one, then come back.
        </p>
      </div>
    );

  const c = status.current;
  const wins = c.wins.map((w) => (c.color === "white" ? w : 100 - w));
  const plies = Math.max(c.plies, wins.length, 1);
  const points = wins.map((w, i) => `${(i / plies) * 100},${100 - w}`).join(" ");
  const now = wins[wins.length - 1] ?? 50;
  return (
    <div className="first" aria-live="polite">
      <h1>Reviewing your game vs {c.opponent}</h1>
      <p className="first-line">
        Stockfish is reading every position. Your review opens as soon as it's done
        {status.total > 1 ? `, and your other ${status.total - 1} games follow in the background.` : "."}
      </p>
      <div className="first-board">
        <Board fen={c.fen ?? START} orientation={c.color} coordinates={false} label="The position the engine is reading" />
      </div>
      <div className="first-meter" aria-label={`Your winning chances ${Math.round(now)} percent`}>
        <span style={{ transform: `scaleX(${now / 100})` }} />
      </div>
      <svg className="first-graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" x2="100" y1="50" y2="50" className="mid" />
        {wins.length > 1 && <polyline points={`0,100 ${points} ${((wins.length - 1) / plies) * 100},100`} className="area" />}
        {wins.length > 1 && <polyline points={points} className="line" />}
      </svg>
      <p className="first-foot">
        <span className="num">{c.percent < 85 ? `Position ${wins.length} of ${plies + 1}` : "Scoring better moves for your mistakes"}</span>
        <span className="num">{c.percent}%</span>
      </p>
    </div>
  );
}

/** For pages that need several games (Habits, Practice) while the first few are still being reviewed. */
export function NotEnough({ title, when }: { title: string; when: string }) {
  const { stored } = useLibrary();
  const status = useLibraryStatus();
  const have = stored.filter((s) => s.review.moves.length > 0).length;
  return (
    <div className="first">
      <h1>{title}</h1>
      <p className="first-line">
        {have} of your games {have === 1 ? "is" : "are"} reviewed so far{status.kind === "analysing" ? ", and the next is being reviewed now" : ""}.{" "}
        {when}
      </p>
    </div>
  );
}
