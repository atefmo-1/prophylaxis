// Building blocks of the review screen: eval bar, player strips, scoresheet, winning-chances graph.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClassIcon } from "../components/ClassIcon";
import { chancesAround } from "../lib/explain";
import { moveLabel } from "../lib/format";
import type { Color, GameReview, Move, MoveClass } from "../types";

const NOTABLE: MoveClass[] = ["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"];

/** Vertical winning-chances bar beside the board; white fills from white's side of the board. */
export function EvalBar({ whiteWin, orientation }: { whiteWin: number; orientation: Color }) {
  const pct = Math.round(whiteWin);
  return (
    <div className={`evalbar evalbar--${orientation}`} title={`White ${pct}% · Black ${100 - pct}%`} aria-hidden="true">
      <span className="evalbar-white" style={{ "--w": whiteWin / 100 } as React.CSSProperties} />
      <span className="evalbar-mid" />
    </div>
  );
}

export function PlayerStrip({
  name,
  rating,
  change,
  accuracy,
  color,
  you,
}: {
  name: string;
  rating: number;
  change?: number | null;
  accuracy: number | null;
  color: Color;
  you?: boolean;
}) {
  return (
    <div className="strip">
      <span className={`strip-color strip-color--${color}`} aria-label={`plays ${color}`} />
      <span className="strip-name">{name}</span>
      <span className="strip-rating num">{rating}</span>
      {change != null && change !== 0 && (
        <span className={`strip-change num ${change > 0 ? "up" : "down"}`}>{change > 0 ? `+${change}` : change}</span>
      )}
      {you && <span className="strip-you">you</span>}
      <span className="strip-acc">
        <b className="num">{accuracy?.toFixed(1) ?? "–"}</b> accuracy
      </span>
    </div>
  );
}

function Cell({ move, index, current, onSelect }: { move?: Move; index: number; current: boolean; onSelect: (i: number) => void }) {
  if (!move) return <span className="sheet-cell sheet-cell--empty" />;
  const notable = NOTABLE.includes(move.class);
  return (
    <button
      type="button"
      className={`sheet-cell${move.mine ? " mine" : ""}${move.decided ? " decided" : ""}`}
      aria-current={current || undefined}
      data-index={index}
      onClick={() => onSelect(index)}
    >
      <span className="sheet-san">{move.san}</span>
      {notable && <ClassIcon cls={move.class} size={15} title={move.class} />}
    </button>
  );
}

/** The two-column scoresheet: number, White, Black. The current move stays in view inside the sheet. */
export function Scoresheet({ moves, index, onSelect }: { moves: Move[]; index: number; onSelect: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    const cell = el?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!el || !cell) return;
    const b = el.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    if (c.top < b.top + 4) el.scrollTop -= b.top - c.top + 36;
    else if (c.bottom > b.bottom - 4) el.scrollTop += c.bottom - b.bottom + 36;
    if (c.left < b.left) el.scrollLeft -= b.left - c.left + 24;
    else if (c.right > b.right) el.scrollLeft += c.right - b.right + 24;
  }, [index]);

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) rows.push(i);
  return (
    <div className="sheet" ref={box}>
      <ol className="sheet-rows" aria-label="Moves">
        {rows.map((i) => (
          <li className="sheet-row" key={i}>
            <span className="sheet-no num">{i / 2 + 1}</span>
            <Cell move={moves[i]} index={i} current={index === i} onSelect={onSelect} />
            <Cell move={moves[i + 1]} index={i + 1} current={index === i + 1} onSelect={onSelect} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const PHASE_LABEL: Record<string, string> = { middlegame: "Middlegame", endgame: "Endgame" };

/** Your winning chances after every move, with phase dividers, numbered key moments and a cursor. */
export function Graph({
  review,
  index,
  onSelect,
  height = 88,
}: {
  review: GameReview;
  index: number;
  onSelect: (i: number) => void;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = review.moves.length;
  const series = [chancesAround(review, 0)[0], ...review.moves.map((_, i) => chancesAround(review, i)[1])];
  const pad = { top: 6, bottom: 6, left: 2, right: 2 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const x = (p: number) => pad.left + (n ? (p / n) * w : 0);
  const y = (v: number) => pad.top + (1 - v / 100) * h;
  const line = series.map((v, p) => `${p ? "L" : "M"}${x(p).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(n)},${y(0)}L${x(0)},${y(0)}Z`;
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(n, Math.max(0, Math.round(((clientX - r.left - pad.left) / Math.max(1, w)) * n)));
  };
  const current = index + 1;

  return (
    <div className="rv-graph" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Your winning chances after every move"
          onPointerMove={(e) => setHover(at(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect(at(e.clientX) - 1)}
        >
          <rect className="g-losing" x={pad.left} y={y(50)} width={w} height={y(0) - y(50)} />
          <line className="g-mid" x1={pad.left} x2={pad.left + w} y1={y(50)} y2={y(50)} />
          {review.phases
            .filter((ph) => ph.first_ply > 1)
            .map((ph) => (
              <g key={ph.phase} className="g-phase">
                <line x1={x(ph.first_ply - 1)} x2={x(ph.first_ply - 1)} y1={pad.top} y2={pad.top + h} />
                <text x={x(ph.first_ply - 1) + 4} y={pad.top + h - 3}>
                  {PHASE_LABEL[ph.phase]}
                </text>
              </g>
            ))}
          <path className="g-area" d={area} />
          <path className="g-line" d={line} />
          {review.key_moments.map((ply) => {
            const m = review.moves[ply - 1];
            return <circle key={ply} className={`g-dot g-dot--${m.class}`} cx={x(ply)} cy={y(series[ply])} r={4.5} />;
          })}
          <line className="g-cursor" x1={x(current)} x2={x(current)} y1={pad.top} y2={pad.top + h} />
        </svg>
      )}
      <span className="g-label g-label--top">Winning</span>
      <span className="g-label g-label--bottom">Losing</span>
      {hover !== null && width > 0 && (
        <div className="g-tip" style={{ left: Math.min(width - 64, Math.max(64, x(hover))) }}>
          <b className="num">{Math.round(series[hover])}%</b> {hover === 0 ? "start" : moveLabel(hover, review.moves[hover - 1].san)}
        </div>
      )}
    </div>
  );
}
