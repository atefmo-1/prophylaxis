// Charts for the Habits page. Colours come from CSS classes on theme tokens, so they work in light and dark.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { range, share } from "../lib/format";
import type { Interval } from "../types";

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

export interface Series {
  key: string;
  values: (number | null)[];
  kind: "line" | "dots";
}

const PAD = { top: 10, right: 10, bottom: 24, left: 38 };

/** Values over games on one axis. Hover snaps to the nearest game and shows every series there. */
export function GameChart({
  series,
  domain,
  ticks,
  format,
  tip,
  label,
  height = 200,
}: {
  series: Series[];
  domain: [number, number];
  ticks: number[];
  format: (v: number) => string;
  tip: (i: number) => ReactNode;
  label: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(...series.map((s) => s.values.length));
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => PAD.top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * h;
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.round(((clientX - r.left - PAD.left) / Math.max(1, w)) * (n - 1))));
  };

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} onPointerMove={(e) => setHover(at(e.clientX))} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="ch-grid" x1={PAD.left} x2={PAD.left + w} y1={y(t)} y2={y(t)} />
              <text className="ch-tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          <text className="ch-tick" x={PAD.left} y={height - 6}>
            first game
          </text>
          <text className="ch-tick" x={PAD.left + w} y={height - 6} textAnchor="end">
            latest
          </text>
          {series.map((s) =>
            s.kind === "dots" ? (
              <g key={s.key} className={`ch-dots ch-dots--${s.key}`}>
                {s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3.5} />))}
              </g>
            ) : (
              <path
                key={s.key}
                className={`ch-line ch-line--${s.key}`}
                d={s.values.reduce((d, v, i) => (v === null ? d : `${d}${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`), "")}
              />
            ),
          )}
          {hover !== null && <line className="ch-cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} />}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="ch-tip" style={{ left: Math.min(width - 90, Math.max(90, x(hover))) }}>
          {tip(hover)}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { key: string; label: string; kind: "line" | "dot" }[] }) {
  return (
    <ul className="ch-legend">
      {items.map((i) => (
        <li key={i.key}>
          <span className={`ch-key ch-key--${i.kind} ch-key--${i.key}`} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Rates with their 90% interval: the dot is what we measured, the band is where the true rate likely is. */
export function RateRows({ rows }: { rows: { label: string; sub: string; ci: Interval | null }[] }) {
  const max = Math.min(1, Math.ceil(Math.round(Math.max(...rows.map((r) => r.ci?.hi ?? 0)) * 1000) / 100) / 10);
  const at = (v: number) => `${(v / max) * 100}%`;
  return (
    <table className="ptable rates">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">
              {r.label}
              <small>{r.sub}</small>
            </th>
            <td className="ci-cell">
              {r.ci && (
                <span className="ci" aria-hidden="true">
                  <span className="ci-range" style={{ left: at(r.ci.lo), width: `calc(${at(r.ci.hi)} - ${at(r.ci.lo)})` }} />
                  <span className="ci-dot" style={{ left: at(r.ci.rate) }} />
                </span>
              )}
            </td>
            <td className="num">
              {r.ci ? (
                <>
                  <b>{share(r.ci.rate)}</b>
                  <small>{range(r.ci)}</small>
                </>
              ) : (
                "–"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Two values per row (you and your opponents), drawn as thin bars from one baseline. */
export function PairedBars({ rows, format }: { rows: { label: string; icon?: ReactNode; a: number; b: number }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 0.001);
  return (
    <table className="ptable pairs">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">
              <span className="pairs-label">
                {r.icon}
                {r.label}
              </span>
            </th>
            <td>
              <span className="pair" title={`You ${format(r.a)}`}>
                <span className="pair-bar pair-bar--a" style={{ width: `${(r.a / max) * 100}%` }} />
                <span className="num">{format(r.a)}</span>
              </span>
              <span className="pair" title={`Opponents ${format(r.b)}`}>
                <span className="pair-bar pair-bar--b" style={{ width: `${(r.b / max) * 100}%` }} />
                <span className="num">{format(r.b)}</span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One horizontal bar per row, value at the tip. */
export function BarRows({ rows, tone }: { rows: { label: string; value: number }[]; tone: "win" | "loss" | "draw" }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="bars-track">
            <span className={`bars-bar bars-bar--${tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="num">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
