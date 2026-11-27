// "Your last 7 days" at the top of Habits: the games played, how many of them showed the #1 habit against the 7
// days before, and the practice done. Counts only, with no verdict: a week is a handful of games, too few to say a
// habit is going away. For the sample player the week ends at its last game, so the demo isn't empty.
import { useLibrary } from "../library/Library";
import { loadPracticeLog } from "../lib/practice";
import type { Weakness } from "../types";
import { day } from "../lib/format";

const DAY = 24 * 60 * 60;

export function Week({ habit }: { habit: Weakness }) {
  const { stored, isSample } = useLibrary();
  const played = stored.filter((s) => s.review.moves.length > 0);
  if (!played.length) return null;
  const last = Math.max(...played.map((s) => s.review.game.t));
  const now = isSample ? last + 60 : Date.now() / 1000;
  const inWeek = (t: number, back: number) => t > now - (back + 1) * 7 * DAY && t <= now - back * 7 * DAY;
  const has = (s: (typeof played)[number]) => s.review.moves.some((m) => m.mine && m.tags.some((t) => t.tag === habit.tag));
  const week = played.filter((s) => inWeek(s.review.game.t, 0));
  const before = played.filter((s) => inWeek(s.review.game.t, 1));
  const results = { win: 0, loss: 0, draw: 0 };
  for (const s of week) results[s.review.game.result]++;
  const ids = new Set(played.map((s) => s.review.game.id));
  const tries = loadPracticeLog().filter((l) => ids.has(l.game) && inWeek(l.t / 1000, 0));
  const clean = tries.filter((l) => l.grade === 3).length;
  const name = habit.title.charAt(0).toLowerCase() + habit.title.slice(1);
  const resultLine = [
    results.win && `${results.win} won`,
    results.loss && `${results.loss} lost`,
    results.draw && `${results.draw} drawn`,
  ].filter(Boolean).join(", ");

  const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`;
  const practice = tries.length
    ? `${tries.length} practice position${tries.length === 1 ? "" : "s"}, ${clean} found first time.`
    : "No practice yet.";

  return (
    <section className="week" aria-labelledby="week-title">
      <p>
        <b id="week-title">Last 7 days:</b>{" "}
        {week.length ? (
          <>
            <b className="num">{games(week.length)}</b> ({resultLine}). Your #1 habit, {name}, showed up in{" "}
            <b className="num">{week.filter(has).length}</b> of them
            {before.length ? `, against ${before.filter(has).length} of ${before.length} the week before` : ""}. {practice}
          </>
        ) : (
          <>
            no games; your last was {day(last)}. {practice}
          </>
        )}
      </p>
    </section>
  );
}
