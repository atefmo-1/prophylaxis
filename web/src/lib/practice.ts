// Positions to practise again, kept in this browser. Spaced repetition: missed → tomorrow, found → 3 days, then a week.
export interface PracticeItem {
  game: string;
  ply: number;
  due: number; // unix ms
  streak: number;
}

const KEY = "coach.practice.v1";
const DAY = 24 * 60 * 60 * 1000;
const STEPS = [1, 3, 7, 21];

export function loadPractice(): PracticeItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PracticeItem[];
  } catch {
    return [];
  }
}

function save(items: PracticeItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable (private windows); practice then simply isn't remembered.
  }
}

/** Record an attempt at a position: found it or not. */
export function recordAttempt(game: string, ply: number, found: boolean) {
  const items = loadPractice();
  const existing = items.find((i) => i.game === game && i.ply === ply);
  const streak = found ? (existing?.streak ?? 0) + 1 : 0;
  const days = found ? STEPS[Math.min(streak, STEPS.length - 1)] : STEPS[0];
  const next = { game, ply, streak, due: Date.now() + days * DAY };
  save(existing ? items.map((i) => (i === existing ? next : i)) : [...items, next]);
}
