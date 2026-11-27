// FSRS-5, the Free Spaced Repetition Scheduler (open-spaced-repetition), with its published default parameters.
// Each position keeps a memory model: stability (days until recall falls to 90%) and difficulty (1-10). A review
// grade updates both, and the next review is set for when recall is expected to fall to RETENTION. Whole days only:
// a position never comes back the same day. scripts/check-fsrs.ts compares this with the reference implementation.

export type Grade = 1 | 2 | 3 | 4; // again, hard, good, easy

export interface Memory {
  s: number; // stability, days
  d: number; // difficulty, 1-10
  last: number; // unix ms of the last review
  reps: number;
  lapses: number;
  due: number; // unix ms of the next review
}

// FSRS-5 defaults, fitted by the FSRS authors on about 10,000 Anki collections.
const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605,
  2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81; // so that recall is 90% when elapsed time equals stability
export const RETENTION = 0.9;
export const MAX_DAYS = 365;
const DAY = 24 * 60 * 60 * 1000;

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initS = (g: Grade) => W[g - 1];
const initD = (g: Grade) => W[4] - Math.exp(W[5] * (g - 1)) + 1;

/** The chance of recalling it after `days`, for a memory of stability `s`. */
export const retrievability = (days: number, s: number) => Math.pow(1 + (FACTOR * days) / s, DECAY);

/** Days until recall is expected to fall to `retention`. */
export function interval(s: number, retention = RETENTION): number {
  const days = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.min(MAX_DAYS, Math.max(1, Math.round(days)));
}

/** Whole days between two times, as the reference counts them. */
export const daysBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / DAY + 1e-9));

/** Memory after one grade, before scheduling. */
function update(m: Memory | null, g: Grade, now: number): Memory {
  if (!m) return { s: initS(g), d: clampD(initD(g)), last: now, reps: 1, lapses: 0, due: now };
  const r = retrievability(daysBetween(m.last, now), m.s);
  // Difficulty moves toward 10 on a lapse and down on easy recalls, damped near the ends, with a little mean reversion.
  const moved = m.d + (-W[6] * (g - 3) * (10 - m.d)) / 9;
  const d = clampD(W[7] * initD(4) + (1 - W[7]) * moved);
  let s: number;
  if (g === 1) {
    const forgot = W[11] * Math.pow(m.d, -W[12]) * (Math.pow(m.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    s = Math.min(forgot, m.s);
  } else {
    const bonus = g === 2 ? W[15] : g === 4 ? W[16] : 1;
    s = m.s * (1 + Math.exp(W[8]) * (11 - m.d) * Math.pow(m.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * bonus);
  }
  return { s, d, last: now, reps: m.reps + 1, lapses: m.lapses + (g === 1 ? 1 : 0), due: now };
}

/**
 * The memory after a review with grade `g` at time `now` (null: never reviewed), with its next due time. As in the
 * reference, a better grade always comes back at least a day later than a worse one.
 */
export function review(m: Memory | null, g: Grade, now: number): Memory {
  const days = ([1, 2, 3, 4] as Grade[]).map((x) => interval(update(m, x, now).s));
  days[0] = Math.min(days[0], days[1]);
  for (let i = 1; i < 4; i++) days[i] = Math.max(days[i], days[i - 1] + 1);
  const next = update(m, g, now);
  return { ...next, due: now + days[g - 1] * DAY };
}
