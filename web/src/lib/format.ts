import type { Color, Interval, MoveClass, Result } from "../types";

export const CLASS_META: Record<MoveClass, { label: string; mark: string; tone: string }> = {
  brilliant: { label: "Brilliant", mark: "!!", tone: "teal" },
  great: { label: "Great", mark: "!", tone: "blue" },
  best: { label: "Best", mark: "", tone: "green" },
  excellent: { label: "Excellent", mark: "", tone: "sage" },
  good: { label: "Good", mark: "", tone: "grey" },
  book: { label: "Book", mark: "", tone: "brown" },
  inaccuracy: { label: "Inaccuracy", mark: "?!", tone: "yellow" },
  mistake: { label: "Mistake", mark: "?", tone: "orange" },
  miss: { label: "Miss", mark: "×", tone: "red" },
  blunder: { label: "Blunder", mark: "??", tone: "red" },
};

export const RESULT_META: Record<Result, { label: string; tone: string }> = {
  win: { label: "Won", tone: "green" },
  loss: { label: "Lost", tone: "red" },
  draw: { label: "Drew", tone: "grey" },
};

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const day = (t: number) => dateFormat.format(new Date(t * 1000));
export const dayTime = (t: number) => `${dateFormat.format(new Date(t * 1000))}, ${timeFormat.format(new Date(t * 1000))}`;

export const pct = (value: number, digits = 0) => `${value.toFixed(digits)}%`;
export const share = (value: number) => `${Math.round(value * 100)}%`;
export const range = (ci: Interval) => `${share(ci.lo)}–${share(ci.hi)}`;
export const accuracy = (value: number | null) => (value === null ? "–" : value.toFixed(1));

export function timeControl(tc: string): string {
  const [base, inc] = tc.split("+");
  const minutes = Number(base) / 60;
  if (!Number.isFinite(minutes)) return tc;
  return inc && inc !== "0" ? `${minutes} min + ${inc} s` : `${minutes} min`;
}

export function clock(seconds: number | null): string {
  if (seconds === null) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const moveNumber = (ply: number) => Math.ceil(ply / 2);
/**
 * "12. Nf3" or "12… Nf6". Ply 1 is White's first move, unless the game started from a set-up position with Black to
 * move: pass the mover's colour and the numbering follows it.
 */
export function moveLabel(ply: number, san: string, color?: Color): string {
  const n = color && (ply % 2 === 1) !== (color === "white") ? ply + 1 : ply;
  return `${moveNumber(n)}${n % 2 === 1 ? "." : "…"} ${san}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A rough time left: "about 15 s", "about 4 min", "about 1 h 20 min". */
export function timeLeft(ms: number): string {
  const s = Math.max(ms, 0) / 1000;
  if (s < 55) return `about ${Math.max(5, Math.round(s / 5) * 5)} s`;
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `about ${min} min`;
  const h = Math.floor(min / 60);
  const rest = Math.round((min % 60) / 10) * 10;
  return rest && rest < 60 ? `about ${h} h ${rest} min` : `about ${rest === 60 ? h + 1 : h} h`;
}
