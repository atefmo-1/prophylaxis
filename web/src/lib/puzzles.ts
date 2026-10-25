// Practice puzzles for a habit, from the Lichess puzzle database (CC0; ml/tactics/bundle.py picks them). Served at
// the player's level, which moves up when they solve one cleanly and down when they don't, per habit.
export type PuzzleRow = [id: string, fen: string, moves: string, rating: number];

export interface Puzzle {
  id: string;
  fen: string; // before the opponent's move, which starts the puzzle
  moves: string[];
  rating: number;
}

const MIXED = ["hangingPiece", "fork", "pin", "discoveredAttack"];
const MATES = ["mateIn1", "mateIn2"];

/** Which puzzle themes train each habit. Habits about the clock have no puzzles. */
export const TAG_THEMES: Record<string, string[]> = {
  hanging_piece: ["hangingPiece"],
  missed_free_piece: ["hangingPiece"],
  allowed_fork: ["fork"],
  missed_fork: ["fork"],
  allowed_pin: ["pin"],
  missed_pin: ["pin"],
  allowed_skewer: ["skewer"],
  missed_skewer: ["skewer"],
  allowed_discovered_attack: ["discoveredAttack"],
  missed_discovered_attack: ["discoveredAttack"],
  trapped_piece: ["trappedPiece"],
  missed_trapped_piece: ["trappedPiece"],
  allowed_mate: MATES,
  missed_mate: MATES,
  back_rank_mate: ["backRankMate"],
  lost_material: MIXED,
  missed_tactic: MIXED,
};

export const hasPuzzles = (tag: string | null) => tag === null || tag in TAG_THEMES;

const KEY = "prophylaxis.puzzles.v1";
const STEP = 40;
const LOWEST = 400;
const HIGHEST = 1700;

interface Stored {
  level: Record<string, number>;
  seen: string[];
}

function load(): Stored {
  try {
    return { level: {}, seen: [], ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Stored>) };
  } catch {
    return { level: {}, seen: [] };
  }
}

function save(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Without storage the level simply starts again next visit.
  }
}

/** Lichess puzzle ratings run several hundred points above chess.com game ratings for beginners. */
export function startLevel(rating: number | null): number {
  return Math.max(500, Math.min(1500, Math.round(((rating ?? 400) + 400) / 50) * 50));
}

export function levelFor(tag: string | null, rating: number | null): number {
  return load().level[tag ?? "any"] ?? startLevel(rating);
}

export function recordPuzzle(tag: string | null, id: string, clean: boolean, rating: number | null) {
  const s = load();
  const key = tag ?? "any";
  const level = s.level[key] ?? startLevel(rating);
  s.level[key] = Math.max(LOWEST, Math.min(HIGHEST, level + (clean ? STEP : -STEP)));
  s.seen = [...s.seen.filter((x) => x !== id), id].slice(-2000);
  save(s);
}

const cache = new Map<string, Promise<Puzzle[]>>();

function theme(base: string, name: string): Promise<Puzzle[]> {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`${base}puzzles/${name}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`puzzles/${name}.json: ${r.status}`);
          return r.json() as Promise<PuzzleRow[]>;
        })
        .then((rows) => rows.map(([id, fen, moves, rating]) => ({ id, fen, moves: moves.split(" "), rating }))),
    );
  }
  return cache.get(name)!;
}

/** `count` unseen puzzles for the habit, closest to the player's level first. */
export async function pickPuzzles(base: string, tag: string | null, level: number, count: number): Promise<Puzzle[]> {
  const names = tag ? TAG_THEMES[tag] : MIXED;
  const all = (await Promise.all(names.map((n) => theme(base, n)))).flat();
  const seen = new Set(load().seen);
  const unique = [...new Map(all.map((p) => [p.id, p])).values()];
  const fresh = unique.filter((p) => !seen.has(p.id));
  const pool = fresh.length >= count ? fresh : unique;
  return pool.sort((a, b) => Math.abs(a.rating - level) - Math.abs(b.rating - level) || a.id.localeCompare(b.id)).slice(0, count);
}
