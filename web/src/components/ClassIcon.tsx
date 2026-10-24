// Move-grade badges: chess.com's names and colour ramp, drawn as SVG so they read the same everywhere.
import type { MoveClass } from "../types";

export const CLASS_COLOR: Record<MoveClass, string> = {
  great: "#5b8baf",
  best: "#81b64c",
  excellent: "#96bc4b",
  good: "#95a88a",
  inaccuracy: "#f0b93a",
  mistake: "#e5872b",
  miss: "#e8613a",
  blunder: "#ca3431",
};

const GLYPH: Partial<Record<MoveClass, string>> = {
  great: "!",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

function Mark({ cls }: { cls: MoveClass }) {
  switch (cls) {
    case "best":
      return <path d="M10 4.2l1.7 3.6 3.9.5-2.9 2.7.7 3.9L10 13l-3.4 1.9.7-3.9-2.9-2.7 3.9-.5z" fill="#fff" />;
    case "excellent":
      return (
        <path
          d="M6.2 9.4h1.9v5.2H6.2zM9 14.6h4.2c.6 0 1-.4 1.2-.9l1-3.1c.2-.7-.3-1.4-1-1.4h-2.6l.4-2c.1-.6-.3-1.2-.9-1.3L9 9.4z"
          fill="#fff"
        />
      );
    case "good":
      return <path d="M6.3 10.3l2.4 2.4 5-5" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
    case "miss":
      return <path d="M7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6" stroke="#fff" strokeWidth={2.1} strokeLinecap="round" />;
    default:
      return (
        <text x="10" y="13.9" textAnchor="middle" fontSize={GLYPH[cls]!.length > 1 ? 9.5 : 11} fontWeight={800} fill="#fff" fontFamily="Hanken Grotesk Variable, sans-serif">
          {GLYPH[cls]}
        </text>
      );
  }
}

export function ClassIcon({ cls, size = 18, title }: { cls: MoveClass; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="10" cy="10" r="9.25" fill={CLASS_COLOR[cls]} stroke="rgb(0 0 0 / 0.25)" strokeWidth={0.75} />
      <Mark cls={cls} />
    </svg>
  );
}
