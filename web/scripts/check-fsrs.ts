// The practice scheduler (src/lib/fsrs.ts) against the reference FSRS-5 implementation: the same review histories
// (tests/fixtures/fsrs.json, recorded with ts-fsrs 4.7.1) must give the same stability, difficulty and next interval.
//   node scripts/check-fsrs.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { review, type Grade, type Memory } from "../src/lib/fsrs.ts";

const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../tests/fixtures/fsrs.json"), "utf8")) as {
  cases: { day: number; grade: Grade; s: number; d: number; interval: number }[][];
};
const DAY = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 0, 1, 12);
let steps = 0;
let failed = 0;
for (const [c, history] of fixture.cases.entries()) {
  let m: Memory | null = null;
  for (const want of history) {
    const now = start + want.day * DAY;
    m = review(m, want.grade, now);
    steps++;
    const got = { s: m.s, d: m.d, interval: Math.round((m.due - now) / DAY) };
    if (Math.abs(got.s - want.s) > 1e-4 * Math.max(1, want.s) || Math.abs(got.d - want.d) > 1e-4 || got.interval !== want.interval) {
      failed++;
      if (failed <= 5) console.log(`case ${c} day ${want.day} grade ${want.grade}: got`, got, "want", { s: want.s, d: want.d, interval: want.interval });
    }
  }
}
console.log(`${steps} reviews in ${fixture.cases.length} histories: ${failed} differ from the reference`);
if (failed) process.exit(1);
