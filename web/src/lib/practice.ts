// Positions to practise again, kept in this browser and scheduled with FSRS (lib/fsrs.ts): each position comes back
// when you're expected to have about a 90% chance of still finding the move. Finding it first time pushes it further
// out; needing tries or a hint brings it back sooner; missing it brings it back tomorrow.
import { review, retrievability, daysBetween, type Grade, type Memory } from "./fsrs";

export interface PracticeItem extends Memory {
  game: string;
  ply: number;
}

/** One attempt, kept so recall can be measured on this device (and nowhere else). */
export interface PracticeLog {
  game: string;
  ply: number;
  t: number; // unix ms
  grade: Grade;
  expected: number | null; // the scheduler's chance of recall at that moment; null for a first attempt
}

const KEY = "coach.practice.v1";
const LOG_KEY = "coach.practice.log.v1";
const LOG_MAX = 5000;
const DAY = 24 * 60 * 60 * 1000;
const OLD_STEPS = [1, 3, 7, 21]; // the fixed schedule before FSRS: days after a miss, then after each find in a row

/** Found first time, found with help (wrong tries or a hint), or not found (shown, skipped). */
export const gradeOf = (found: boolean, clean: boolean): Grade => (found ? (clean ? 3 : 2) : 1);

type Stored = PracticeItem | { game: string; ply: number; due: number; streak: number };

/** A position scheduled before FSRS: its stability is the gap it was given, so it stays due when it was. */
function migrate(item: Stored): PracticeItem {
  if ("s" in item) return item;
  const days = OLD_STEPS[Math.min(item.streak, OLD_STEPS.length - 1)];
  const missed = item.streak === 0;
  return {
    game: item.game,
    ply: item.ply,
    s: missed ? 0.4 : days,
    d: missed ? 7 : 5.3,
    last: item.due - days * DAY,
    reps: Math.max(1, item.streak),
    lapses: missed ? 1 : 0,
    due: item.due,
  };
}

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private windows); practice then simply isn't remembered.
  }
}

export function loadPractice(): PracticeItem[] {
  return read<Stored>(KEY).map(migrate);
}

export const loadPracticeLog = () => read<PracticeLog>(LOG_KEY);

/** Record an attempt at a position. */
export function recordAttempt(game: string, ply: number, grade: Grade, now = Date.now()) {
  const items = loadPractice();
  const existing = items.find((i) => i.game === game && i.ply === ply) ?? null;
  const memory = review(existing, grade, now);
  const next: PracticeItem = { game, ply, ...memory };
  write(KEY, existing ? items.map((i) => (i === existing ? next : i)) : [...items, next]);
  const expected = existing ? Math.round(retrievability(daysBetween(existing.last, now), existing.s) * 1000) / 1000 : null;
  write(LOG_KEY, [...loadPracticeLog(), { game, ply, t: now, grade, expected }].slice(-LOG_MAX));
}
