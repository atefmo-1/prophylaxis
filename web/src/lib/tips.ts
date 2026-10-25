// How to play against someone, from their reviewed games: their costliest habits, the phase where they go wrong,
// their clock, how they handle winning positions, and their openings. Every tip carries the evidence it rests on,
// and a tip is only given when that evidence is solid enough (see the thresholds). Nothing here is guessed.
import type { Interval, Overview } from "../types";
import { share } from "./format";

export interface Tip {
  title: string;
  why: string;
}

const MIN_HABIT_GAMES = 3; // a habit has to show up in at least this many of their games
const MIN_PHASE_MOVES = 30;
const MAX_TIPS = 6;

// What to do about each of their habits (the tag names are the coach's, written from the mistake-maker's side).
const AGAINST: Record<string, { title: string; how: string }> = {
  hanging_piece: { title: "Check what they leave undefended", how: "After each of their moves, look for a piece with no defender." },
  lost_material: { title: "Look for loose pieces", how: "Count attackers and defenders on their pieces: they often come up short." },
  allowed_fork: { title: "Look for forks", how: "Check knight jumps and pawn pushes that hit two of their pieces at once." },
  allowed_pin: { title: "Pin their pieces", how: "Line up a bishop or rook on a piece with their king or queen behind it." },
  allowed_skewer: { title: "Line up their big pieces", how: "When their king or queen sits on a line with another piece behind, attack along it." },
  allowed_discovered_attack: { title: "Set up discovered attacks", how: "Put a piece in front of your bishop, rook or queen, then move it with a threat." },
  trapped_piece: { title: "Trap their wandering pieces", how: "Pieces that go deep into your side often have no way back: take away their squares." },
  allowed_mate: { title: "Keep looking for mate", how: "Check every check: they miss mating threats against their own king." },
  back_rank_mate: { title: "Aim at their back rank", how: "If their king is stuck behind its pawns, a rook or queen on the back row can mate." },
  time_pressure: { title: "Make it a long game", how: "Keep pieces on and the position busy, so their clock runs down." },
  rushed: { title: "Give them something to think about", how: "Quiet positions with a trap in them reward patience; they play fast." },
  missed_free_piece: { title: "Your slips may go unpunished", how: "Play actively, but still check your pieces are safe." },
  missed_fork: { title: "Your slips may go unpunished", how: "Play actively, but still check your pieces are safe." },
  missed_tactic: { title: "Your slips may go unpunished", how: "Play actively, but still check your pieces are safe." },
  missed_mate: { title: "Your slips may go unpunished", how: "Play actively, but still check your pieces are safe." },
};

const PHASE_TIP: Record<string, string> = {
  opening: "Make the opening count: they go wrong early more than you do",
  middlegame: "Keep the middlegame complicated: they go wrong there more than you do",
  endgame: "Trade pieces and head for an endgame: they go wrong there more than you do",
};

const clearlyAbove = (a: Interval | null, b: Interval | null) => !!a && !!b && a.lo > b.hi;

export function tipsAgainst(them: Overview, me: Overview | null, name: string): Tip[] {
  const tips: Tip[] = [];
  const games = them.player.played;

  // Their costliest habits, if they come up often enough.
  const used = new Set<string>();
  for (const w of them.weaknesses.slice(0, 4)) {
    const k = w.games.k;
    const how = AGAINST[w.tag];
    if (!how || k < MIN_HABIT_GAMES || used.has(how.title)) continue;
    used.add(how.title);
    tips.push({ title: how.title, why: `${name}: ${w.title.toLowerCase()} in ${k} of their last ${w.games.n} games. ${how.how}` });
  }

  // The phase where they make clearly more mistakes than you (the two ranges don't overlap). Their own worst phase
  // alone isn't enough: it may still be better than yours.
  const phases = them.phases.filter((p) => p.mistake_rate && p.moves >= MIN_PHASE_MOVES);
  const gaps = phases
    .map((p) => ({ p, mine: me?.phases.find((x) => x.phase === p.phase)?.mistake_rate ?? null }))
    .filter(({ p, mine }) => clearlyAbove(p.mistake_rate, mine));
  if (gaps.length) {
    const { p, mine } = gaps.reduce((a, b) => (b.p.mistake_rate!.rate - b.mine!.rate > a.p.mistake_rate!.rate - a.mine!.rate ? b : a));
    tips.push({
      title: PHASE_TIP[p.phase] ?? `Watch the ${p.phase}`,
      why: `${share(p.mistake_rate!.rate)} of their ${p.phase} moves are mistakes or worse, against ${share(mine!.rate)} of yours.`,
    });
  }

  // The clock.
  const lostOnTime = them.clock.lost_on_time;
  if (lostOnTime >= 2 && lostOnTime / games >= 0.1 && !used.has(AGAINST.time_pressure.title)) {
    tips.push({ title: "Don't rush the end", why: `${name} lost ${lostOnTime} of ${games} games on time. If the position is level, keep playing.` });
  }

  // Winning positions they don't convert.
  const conv = them.conversion.winning;
  if (conv && conv.n >= 4 && conv.rate < 0.65) {
    tips.push({
      title: "Don't give up when you're behind",
      why: `${name} won only ${conv.k} of the ${conv.n} games where they were clearly winning. Keep fighting.`,
    });
  }

  // Openings: what to expect, and where they score badly.
  for (const color of ["white", "black"] as const) {
    const theirs = them.openings.filter((o) => o.color === color && o.games >= 3);
    if (!theirs.length) continue;
    const total = them.colors.find((c) => c.color === color)?.games ?? 0;
    const top = theirs[0];
    const weak = theirs.filter((o) => (o.score ?? 1) <= 0.35).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    if (weak) {
      tips.push({
        title: `Steer for the ${weak.family} when they're ${color}`,
        why: `${name} scored ${share(weak.score ?? 0)} in ${weak.games} games of it as ${color}.`,
      });
    } else if (total >= 5 && top.games / total >= 0.4) {
      tips.push({
        title: `Prepare for the ${top.family} when they're ${color}`,
        why: `${name} played it in ${top.games} of ${total} games as ${color} (${share(top.score ?? 0)} score).`,
      });
    }
  }

  // Your clear edge in a skill area.
  if (me) {
    for (const key of ["endgame", "opening"] as const) {
      const a = me.skills.find((s) => s.key === key)?.recent;
      const b = them.skills.find((s) => s.key === key)?.recent;
      if (a == null || b == null || a - b < 8) continue;
      tips.push({
        title: key === "endgame" ? "Trade down when you can" : "Play your openings with confidence",
        why: `Your ${key} accuracy is ${a.toFixed(0)}, theirs ${b.toFixed(0)}.`,
      });
    }
  }

  return tips.slice(0, MAX_TIPS);
}
