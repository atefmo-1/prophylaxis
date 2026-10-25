// Turn a player's analysed games into the numbers the site shows. A port of src/coach/stats.py that works on the
// reviews saved in the browser instead of SQLite rows, so the two produce the same shapes (see types.ts).
//
// With a few dozen games, raw percentages are noisy, so every rate comes with a 90% Jeffreys interval:
// "35% (27–44%)" rather than a falsely exact "35%".
import type {
  Color,
  Example,
  GameReview,
  GameSummary,
  Interval,
  MoveClass,
  MoveTag,
  Overview,
  PracticePosition,
  Result,
  Skill,
  WinRecord,
} from "../types";
import { ENDINGS, TAG_INFO } from "./catalog";
import { moveAccuracy, pov } from "./grading";

export const ANALYSIS_VERSION = 1;
const MISTAKES: MoveClass[] = ["mistake", "miss", "blunder"];
const CLASSES: MoveClass[] = ["great", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder"];
const HABIT_WINDOW = 10;
const RECENT_GAMES = 20;
const SKILL_RECENT = 20;
const SESSION_GAP_S = 30 * 60;
const SAFETY_TAGS = [
  "hanging_piece", "allowed_fork", "lost_material", "allowed_mate",
  "allowed_discovered_attack", "allowed_pin", "allowed_skewer", "trapped_piece",
];
const MISSED_TAGS = [
  "missed_free_piece", "missed_fork", "missed_mate", "missed_tactic",
  "missed_discovered_attack", "missed_pin", "missed_skewer", "missed_trapped_piece",
];

/** What a review doesn't carry but the statistics need, taken from the chess.com archive entry. */
export interface GameFacts {
  time_class: string;
  family: string;
  my_code: string;
  opp_code: string;
  end_time: number;
}

/** One analysed game as stored in the browser. */
export interface StoredGame {
  review: GameReview;
  facts: GameFacts;
  version: number;
  /** The tactic model that named its tags (tactics.json "version"), if any. */
  tagged?: string;
}

// ---------- numbers ----------

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (Numerical Recipes, betacf). */
function betaFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < 1e-12) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b): the beta distribution's CDF. */
function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaFraction(a, b, x)) / a : 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Jeffreys interval for k successes out of n. */
export function interval(k: number, n: number, level = 0.9): Interval | null {
  if (n === 0) return null;
  const tail = (1 - level) / 2;
  const lo = k === 0 ? 0 : betaQuantile(tail, k + 0.5, n - k + 0.5);
  const hi = k === n ? 1 : betaQuantile(1 - tail, k + 0.5, n - k + 0.5);
  return { k, n, rate: k / n, lo, hi };
}

const mean = (values: (number | null | undefined)[]): number | null => {
  const v = values.filter((x): x is number => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function record(games: GameRow[]): WinRecord {
  const n = games.length;
  const count = (r: Result) => games.filter((g) => g.result === r).length;
  return { games: n, win: count("win"), loss: count("loss"), draw: count("draw"), score: n ? (count("win") + 0.5 * count("draw")) / n : null };
}

export function ending(result: Result, code: string): string {
  return ENDINGS[`${result}:${code}`] ?? result[0].toUpperCase() + result.slice(1);
}

// ---------- rows: the same game and move records the Python pipeline keeps in SQLite ----------

interface GameRow {
  id: string;
  url: string;
  start_time: number;
  end_time: number;
  time_class: string;
  time_control: string;
  my_color: Color;
  my_rating: number;
  opp_name: string;
  opp_rating: number;
  result: Result;
  my_code: string;
  opp_code: string;
  opening: string;
  family: string;
  my_accuracy: number | null;
  opp_accuracy: number | null;
  chesscom_accuracy: number | null;
  session: number;
}

interface MoveRow {
  game_id: string;
  ply: number;
  color: Color;
  is_mine: boolean;
  san: string;
  uci: string;
  fen_before: string;
  move_class: MoveClass;
  phase: string;
  accuracy: number;
  win_white: number;
  win_before: number; // mover's side
  win_after: number;
  win_loss: number;
  clock_before: number | null;
  time_spent: number | null;
  best_san: string | null;
  best_uci: string | null;
  reply_line: string[];
  tags: MoveTag[];
  decided: boolean;
  retry: { accept: string[]; wins: { [uci: string]: number } } | null;
}

function baseClock(timeControl: string): number | null {
  const base = Number(timeControl.split("+")[0]);
  return Number.isFinite(base) && !timeControl.includes("/") ? base : null;
}

function rowsOf(stored: StoredGame[]): { games: GameRow[]; moves: MoveRow[] } {
  const sorted = [...stored].sort((a, b) => a.review.game.t - b.review.game.t);
  const games: GameRow[] = [];
  const moves: MoveRow[] = [];
  let session = 0;
  let lastEnd: number | null = null;
  for (const { review: r, facts } of sorted) {
    const g = r.game;
    if (lastEnd !== null && g.t - lastEnd > SESSION_GAP_S) session += 1;
    lastEnd = facts.end_time;
    games.push({
      id: g.id,
      url: g.url,
      start_time: g.t,
      end_time: facts.end_time,
      time_class: facts.time_class,
      time_control: g.time_control,
      my_color: g.color,
      my_rating: g.rating,
      opp_name: g.opponent,
      opp_rating: g.opp_rating,
      result: g.result,
      my_code: facts.my_code,
      opp_code: facts.opp_code,
      opening: g.opening,
      family: facts.family,
      my_accuracy: g.accuracy,
      opp_accuracy: g.opp_accuracy,
      chesscom_accuracy: g.chesscom_accuracy,
      session,
    });
    const lastClock: Record<Color, number | null> = { white: baseClock(g.time_control), black: baseClock(g.time_control) };
    let prevWhite = r.start_win_white;
    let prevFen = r.start_fen;
    for (const m of r.moves) {
      const white = m.color === "white";
      const wb = pov(prevWhite, white);
      const wa = pov(m.win_white, white);
      moves.push({
        game_id: g.id,
        ply: m.ply,
        color: m.color,
        is_mine: m.mine,
        san: m.san,
        uci: m.uci,
        fen_before: prevFen,
        move_class: m.class,
        phase: m.phase,
        accuracy: moveAccuracy(wb, wa),
        win_white: m.win_white,
        win_before: wb,
        win_after: wa,
        win_loss: m.win_loss,
        clock_before: lastClock[m.color],
        time_spent: m.time_spent,
        best_san: m.best,
        best_uci: m.best_uci,
        reply_line: m.reply_line,
        tags: m.tags,
        decided: m.decided,
        retry: m.retry,
      });
      lastClock[m.color] = m.clock;
      prevWhite = m.win_white;
      prevFen = m.fen;
    }
  }
  return { games, moves };
}

function example(m: MoveRow, g: GameRow, detail: { [key: string]: unknown } = {}): Example {
  return {
    game_id: g.id,
    ply: m.ply,
    move_number: Math.floor((m.ply + 1) / 2),
    fen: m.fen_before,
    played: m.san,
    played_uci: m.uci,
    best: m.best_san,
    best_uci: m.best_uci,
    win_loss: Math.round(m.win_loss * 10) / 10,
    opponent: g.opp_name,
    date: g.start_time,
    color: g.my_color,
    detail,
  };
}

// ---------- overview ----------

type Tagged = [MoveRow, { [key: string]: unknown }];

/** How often a habit shows up per move in your last 20 played games, against the games before them. */
function trend(items: Tagged[], played: GameRow[], myMoves: Map<string, number>): Overview["weaknesses"][number]["trend"] {
  if (played.length < RECENT_GAMES * 2) return null;
  const recentIds = new Set(played.slice(-RECENT_GAMES).map((g) => g.id));
  const recentMoves = [...recentIds].reduce((a, id) => a + (myMoves.get(id) ?? 0), 0);
  const beforeMoves = played.reduce((a, g) => a + (myMoves.get(g.id) ?? 0), 0) - recentMoves;
  if (recentMoves === 0 || beforeMoves === 0) return null;
  const recent = items.filter(([m]) => recentIds.has(m.game_id)).length;
  const recentRate = (recent / recentMoves) * 100;
  const beforeRate = ((items.length - recent) / beforeMoves) * 100;
  const change = (recentRate - beforeRate) / Math.max(beforeRate, 0.5);
  const direction = change >= 0.3 ? "rising" : change <= -0.3 ? "falling" : "steady";
  return { recent: recentRate, before: beforeRate, games: RECENT_GAMES, direction };
}

/** Six skill areas as plain measurements, each for your last 20 games and the games before them. */
function skills(played: GameRow[], movesByGame: Map<string, MoveRow[]>, tagsByName: Map<string, Tagged[]>): Skill[] {
  const taggedGames = new Map<string, Set<string>>();
  const tagCounts = new Map<string, Map<string, number>>();
  for (const [tag, items] of tagsByName) {
    for (const [m] of items) {
      if (!taggedGames.has(tag)) taggedGames.set(tag, new Set());
      taggedGames.get(tag)!.add(m.game_id);
      if (!tagCounts.has(m.game_id)) tagCounts.set(m.game_id, new Map());
      const c = tagCounts.get(m.game_id)!;
      c.set(tag, (c.get(tag) ?? 0) + 1);
    }
  }
  const measure = (group: GameRow[]): Record<string, number | null> => {
    const ids = group.map((g) => g.id);
    const mine = ids.flatMap((id) => (movesByGame.get(id) ?? []).filter((m) => m.is_mine));
    const opening = mine.filter((m) => m.phase === "opening").map((m) => m.accuracy);
    const endgame = mine.filter((m) => m.phase === "endgame").map((m) => m.accuracy);
    const winning = group.filter((g) => Math.max(...(movesByGame.get(g.id) ?? []).map((m) => pov(m.win_white, g.my_color === "white"))) >= 85);
    const n = ids.length || 1;
    return {
      opening: mean(opening),
      safety: (100 * ids.filter((id) => SAFETY_TAGS.some((t) => taggedGames.get(t)?.has(id))).length) / n,
      tactics: ids.reduce((a, id) => a + MISSED_TAGS.reduce((b, t) => b + (tagCounts.get(id)?.get(t) ?? 0), 0), 0) / n,
      endgame: endgame.length >= 20 ? mean(endgame) : null,
      converting: winning.length ? (100 * winning.filter((g) => g.result === "win").length) / winning.length : null,
      time: (100 * group.filter((g) => g.result === "loss" && g.my_code === "timeout").length) / n,
    };
  };
  const recent = measure(played.slice(-SKILL_RECENT));
  const before = played.length > SKILL_RECENT ? measure(played.slice(0, -SKILL_RECENT)) : {};
  const meta: [string, string, string, string, "higher" | "lower"][] = [
    ["opening", "Opening", "How accurate are your first ten moves?", "accuracy", "higher"],
    ["safety", "Piece safety", "How often do you lose material to a simple tactic?", "% of games", "lower"],
    ["tactics", "Spotting tactics", "How many winning chances do you miss?", "missed per game", "lower"],
    ["endgame", "Endgames", "How accurate are you once most pieces are gone?", "accuracy", "higher"],
    ["converting", "Converting wins", "When you get a winning position, do you win?", "% converted", "higher"],
    ["time", "Clock", "How often do you lose on time?", "% of games", "lower"],
  ];
  return meta.map(([key, title, question, unit, better]) => ({
    key,
    title,
    question,
    unit,
    better,
    recent: recent[key] ?? null,
    before: (before as Record<string, number | null>)[key] ?? null,
    games: Math.min(SKILL_RECENT, played.length),
  }));
}

export function overview(stored: StoredGame[], username: string, method: Overview["method"]): Overview {
  const { games, moves } = rowsOf(stored);
  const empty = { empty: true } as Overview;
  if (!games.length) return empty;
  const byId = new Map(games.map((g) => [g.id, g]));
  const mine = moves.filter((m) => m.is_mine);
  const theirs = moves.filter((m) => !m.is_mine);
  const movesByGame = new Map<string, MoveRow[]>();
  for (const m of moves) {
    if (!movesByGame.has(m.game_id)) movesByGame.set(m.game_id, []);
    movesByGame.get(m.game_id)!.push(m);
  }
  // Games that ended before a move count in the record, but never in per-game move statistics.
  const played = games.filter((g) => movesByGame.has(g.id));
  const nPlayed = played.length;
  if (!nPlayed) return empty;
  const myMoves = new Map(played.map((g) => [g.id, movesByGame.get(g.id)!.filter((m) => m.is_mine).length]));
  const playedIds = played.map((g) => g.id);
  const bad = (m: MoveRow) => MISTAKES.includes(m.move_class);

  const series = games.map((g, i) => {
    const window = games.slice(Math.max(0, i - 9), i + 1).map((x) => x.my_accuracy);
    return {
      game_id: g.id,
      t: g.start_time,
      rating: g.my_rating,
      opp_rating: g.opp_rating,
      result: g.result,
      accuracy: g.my_accuracy,
      accuracy_avg10: mean(window),
    };
  });

  const countBy = (ms: MoveRow[], c: MoveClass) => ms.filter((m) => m.move_class === c).length;
  const move_quality = CLASSES.map((c) => ({
    class: c,
    mine: countBy(mine, c),
    mine_per_game: countBy(mine, c) / nPlayed,
    theirs: countBy(theirs, c),
    theirs_per_game: countBy(theirs, c) / nPlayed,
  }));

  const phases = ["opening", "middlegame", "endgame"].map((phase) => {
    const pm = mine.filter((m) => m.phase === phase);
    const mistakes = pm.filter(bad).length;
    return {
      phase,
      moves: pm.length,
      games: new Set(pm.map((m) => m.game_id)).size,
      accuracy: mean(pm.map((m) => m.accuracy)),
      mistakes,
      mistake_rate: interval(mistakes, pm.length),
    };
  });

  const firstBad: number[] = [];
  for (const gm of movesByGame.values()) {
    const m = gm.find((x) => x.is_mine && bad(x));
    if (m) firstBad.push(Math.floor((m.ply + 1) / 2));
  }

  const colors = (["white", "black"] as Color[]).map((color) => {
    const cg = games.filter((g) => g.my_color === color);
    return { color, ...record(cg), accuracy: mean(cg.map((g) => g.my_accuracy)) };
  });

  const families = new Map<string, GameRow[]>();
  for (const g of games) {
    const key = `${g.family}\u0000${g.my_color}`;
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(g);
  }
  const openings = [...families.entries()]
    .map(([key, fg]) => {
      const [family, color] = key.split("\u0000") as [string, Color];
      return { family, color, ...record(fg), accuracy: mean(fg.map((g) => g.my_accuracy)) };
    })
    .sort((a, b) => b.games - a.games || a.family.localeCompare(b.family));

  const timed = mine.filter((m) => m.clock_before !== null);
  const bucket = (label: string, ms: MoveRow[]) => ({ label, moves: ms.length, mistake_rate: interval(ms.filter(bad).length, ms.length) });
  const clockBuckets = (
    [["Over 5 min", 300, null], ["2–5 min", 120, 300], ["1–2 min", 60, 120], ["Under 1 min", 0, 60]] as [string, number, number | null][]
  ).map(([label, lo, hi]) => bucket(label, timed.filter((m) => m.clock_before! >= lo && (hi === null || m.clock_before! < hi))));
  const spent = timed.filter((m) => m.time_spent !== null);
  const speedBuckets = (
    [["Under 3 s", 0, 3], ["3–10 s", 3, 10], ["10–30 s", 10, 30], ["Over 30 s", 30, null]] as [string, number, number | null][]
  ).map(([label, lo, hi]) => bucket(label, spent.filter((m) => m.time_spent! >= lo && (hi === null || m.time_spent! < hi))));
  const clock = {
    buckets: clockBuckets,
    speed: speedBuckets,
    median_time_per_move: median(spent.map((m) => m.time_spent!)),
    lost_on_time: games.filter((g) => g.result === "loss" && g.my_code === "timeout").length,
  };

  const endingCounts = new Map<string, number>();
  for (const g of games) {
    const label = ending(g.result, g.result === "win" ? g.opp_code : g.my_code);
    endingCounts.set(label, (endingCounts.get(label) ?? 0) + 1);
  }
  const terminations = Object.entries(ENDINGS)
    .filter(([, label]) => endingCounts.get(label))
    .map(([key, label]) => ({ label, result: key.split(":")[0] as Result, count: endingCounts.get(label)! }));

  let winning = 0;
  let converted = 0;
  let losing = 0;
  let saved = 0;
  for (const [gid, gm] of movesByGame) {
    const g = byId.get(gid)!;
    const minePov = gm.map((m) => pov(m.win_white, g.my_color === "white"));
    if (Math.max(...minePov) >= 85) {
      winning += 1;
      if (g.result === "win") converted += 1;
    }
    if (Math.min(...minePov) <= 15) {
      losing += 1;
      if (g.result !== "loss") saved += 1;
    }
  }

  // Tilt: how the next game in the same session goes
  const after: Record<"win" | "loss", GameRow[]> = { win: [], loss: [] };
  for (let i = 1; i < games.length; i++) {
    const prev = games[i - 1];
    if (prev.session === games[i].session && (prev.result === "win" || prev.result === "loss")) after[prev.result].push(games[i]);
  }
  const sessions = {
    win: { ...record(after.win), accuracy: mean(after.win.map((g) => g.my_accuracy)) },
    loss: { ...record(after.loss), accuracy: mean(after.loss.map((g) => g.my_accuracy)) },
  };

  // Weaknesses
  const tagsByName = new Map<string, Tagged[]>();
  for (const m of mine) {
    for (const t of m.tags) {
      if (!tagsByName.has(t.tag)) tagsByName.set(t.tag, []);
      tagsByName.get(t.tag)!.push([m, t.detail ?? {}]);
    }
  }
  const last = playedIds.slice(-HABIT_WINDOW);
  const prev = playedIds.slice(-2 * HABIT_WINDOW, -HABIT_WINDOW);
  const weaknesses = [...tagsByName.entries()]
    .filter(([tag]) => TAG_INFO[tag])
    .map(([tag, items]) => {
      const gamesTagged = new Set(items.map(([m]) => m.game_id));
      const avgLoss = mean(items.map(([m]) => m.win_loss))!;
      const examples = [...items].sort((a, b) => b[0].win_loss - a[0].win_loss).slice(0, 4);
      const latest = items.reduce((best, x) => {
        const [bt, xt] = [byId.get(best[0].game_id)!.start_time, byId.get(x[0].game_id)!.start_time];
        return xt > bt || (xt === bt && x[0].ply > best[0].ply) ? x : best;
      });
      return {
        tag,
        ...TAG_INFO[tag],
        windows: {
          // Fewer games than the window: "in 4 of your last 5 games", not "of your last 10".
          size: Math.min(HABIT_WINDOW, playedIds.length),
          last: last.filter((id) => gamesTagged.has(id)).length,
          prev: prev.length === HABIT_WINDOW ? prev.filter((id) => gamesTagged.has(id)).length : null,
        },
        occurrences: items.length,
        per_game: items.length / nPlayed,
        games: interval(gamesTagged.size, nPlayed)!,
        trend: trend(items, played, myMoves),
        avg_loss: avgLoss,
        impact: (items.length / nPlayed) * avgLoss,
        examples: examples.map(([m, d]) => example(m, byId.get(m.game_id)!, d)),
        latest: example(latest[0], byId.get(latest[0].game_id)!, latest[1]),
      };
    })
    .sort((a, b) => b.impact - a.impact);

  const great = mine.filter((m) => m.move_class === "great").sort((a, b) => b.win_before - a.win_before);
  const pairs = games.filter((g) => g.my_accuracy !== null && g.chesscom_accuracy !== null).map((g) => ({ ours: g.my_accuracy!, chesscom: g.chesscom_accuracy! }));

  return {
    generated_at: Math.floor(Date.now() / 1000),
    player: {
      username,
      rating: games[games.length - 1].my_rating,
      peak: Math.max(...games.map((g) => g.my_rating)),
      start_rating: games[0].my_rating,
      ...record(games),
      accuracy: mean(games.map((g) => g.my_accuracy)),
      opp_accuracy: mean(games.map((g) => g.opp_accuracy)),
      first_game: games[0].start_time,
      last_game: games[games.length - 1].start_time,
      moves: mine.length,
      played: nPlayed,
      unplayed: games.length - nPlayed,
      time_classes: [...new Set(games.map((g) => g.time_class))].sort(),
    },
    series,
    move_quality,
    phases,
    first_mistake_move: median(firstBad),
    games_without_mistake: nPlayed - firstBad.length,
    colors,
    openings,
    clock,
    terminations,
    conversion: { winning: interval(converted, winning), losing: interval(saved, losing) },
    sessions,
    weaknesses,
    skills: skills(played, movesByGame, tagsByName),
    great_moves: { count: great.length, examples: great.slice(0, 4).map((m) => example(m, byId.get(m.game_id)!)) },
    validation: {
      pairs,
      pearson: pearson(pairs.map((p) => p.ours), pairs.map((p) => p.chesscom)),
      mean_abs_diff: mean(pairs.map((p) => Math.abs(p.ours - p.chesscom))),
    },
    method,
  };
}

// ---------- the game list, practice positions and one game's review in context ----------

export function gameList(stored: StoredGame[]): GameSummary[] {
  return [...stored]
    .filter((s) => s.review.moves.length > 0)
    .sort((a, b) => b.review.game.t - a.review.game.t)
    .map(({ review: r, facts }) => {
      const mine = r.moves.filter((m) => m.mine);
      const cost = new Map<string, number>();
      for (const m of mine) for (const t of m.tags) if (TAG_INFO[t.tag]) cost.set(t.tag, (cost.get(t.tag) ?? 0) + m.win_loss);
      const top = [...cost.entries()].reduce<[string, number] | null>((best, x) => (!best || x[1] > best[1] ? x : best), null);
      return {
        id: r.game.id,
        t: r.game.t,
        color: r.game.color,
        opponent: r.game.opponent,
        opp_rating: r.game.opp_rating,
        rating: r.game.rating,
        habit: top ? { tag: top[0], title: TAG_INFO[top[0]].title } : null,
        result: r.game.result,
        ending: r.game.ending,
        opening: r.game.opening,
        family: facts.family,
        time_control: r.game.time_control,
        accuracy: r.game.accuracy,
        opp_accuracy: r.game.opp_accuracy,
        blunders: mine.filter((m) => m.class === "blunder").length,
        mistakes: mine.filter((m) => m.class === "mistake" || m.class === "miss").length,
        moves: Math.floor((r.moves[r.moves.length - 1].ply + 1) / 2),
      };
    });
}

/** Every position where you went wrong and a better move is known: the pool for practice. */
export function practicePositions(stored: StoredGame[]): PracticePosition[] {
  const { games, moves } = rowsOf(stored);
  const byId = new Map(games.map((g) => [g.id, g]));
  return moves
    .filter((m) => m.is_mine && MISTAKES.includes(m.move_class) && m.retry && !m.decided)
    .sort((a, b) => byId.get(b.game_id)!.start_time - byId.get(a.game_id)!.start_time || a.ply - b.ply)
    .map((m) => {
      const g = byId.get(m.game_id)!;
      return {
        id: `${m.game_id}-${m.ply}`,
        game: m.game_id,
        ply: m.ply,
        fen: m.fen_before,
        color: g.my_color,
        san: m.san,
        uci: m.uci,
        best: m.best_san,
        best_uci: m.best_uci,
        class: m.move_class,
        before: Math.round(m.win_before * 10) / 10,
        after: Math.round(m.win_after * 10) / 10,
        reply: m.reply_line[0] ?? null,
        tags: m.tags,
        opponent: g.opp_name,
        t: g.start_time,
        accept: m.retry!.accept,
        wins: m.retry!.wins,
      };
    });
}

/**
 * One game's review with what it needs from the rest: each habit's overall rank and how many of the last 10 games up
 * to this one show it, and the rating change since the previous game of the same kind.
 */
export function inContext(game: StoredGame, stored: StoredGame[], ov: Overview): GameReview {
  const ranked = ov.empty ? [] : ov.weaknesses.map((w) => w.tag);
  const played = [...stored].filter((s) => s.review.moves.length > 0).sort((a, b) => a.review.game.t - b.review.game.t);
  const ids = played.map((s) => s.review.game.id);
  const position = ids.includes(game.review.game.id) ? ids.indexOf(game.review.game.id) : ids.length;
  const window = played.slice(Math.max(0, position - HABIT_WINDOW + 1), position + 1);
  const tagsOf = (s: StoredGame) => new Set(s.review.moves.flatMap((m) => m.tags.map((t) => t.tag)));
  const windowTags = window.map(tagsOf);
  const habits = Object.fromEntries(
    [...tagsOf(game)].map((tag) => [
      tag,
      {
        rank: ranked.includes(tag) ? ranked.indexOf(tag) + 1 : null,
        recent_games: windowTags.filter((t) => t.has(tag)).length,
        window: window.length,
      },
    ]),
  );
  const previous = [...stored]
    .filter((s) => s.review.game.t < game.review.game.t && s.facts.time_class === game.facts.time_class)
    .sort((a, b) => b.review.game.t - a.review.game.t)[0];
  return {
    ...game.review,
    game: { ...game.review.game, rating_change: previous ? game.review.game.rating - previous.review.game.rating : null },
    habits,
  };
}
