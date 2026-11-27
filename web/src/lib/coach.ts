// The coach's read of one game: its key moments, and a line for a game without any.
// Every sentence is built from engine facts in the export; nothing is generated freely.
import type { GameReview, Move, MoveClass } from "../types";
import { chancesAround, HARD, tagSentence } from "./explain";
import { CLASS_META, moveLabel } from "./format";

export interface Moment {
  ply: number;
  index: number;
  label: string; // "8… f6"
  cls: MoveClass;
  before: number; // your winning chances before / after
  after: number;
  loss: number;
  why: string; // one sentence: what the move did wrong
  best: string | null;
}

export interface CoachRead {
  /** Said only when there is no key moment to point at: a clean game. */
  story: string;
  moments: Moment[];
}

export function momentAt(review: GameReview, ply: number): Moment {
  const index = ply - 1;
  const m = review.moves[index];
  const [before, after] = chancesAround(review, index);
  const why =
    m.tags.map((t) => tagSentence(t, m)).find((s): s is string => !!s) ??
    (m.best ? `The best move was ${m.best}.` : `${CLASS_META[m.class].label}.`);
  return { ply, index, label: moveLabel(ply, m.san, m.color), cls: m.class, before, after, loss: m.win_loss, why, best: m.best };
}

const MOMENTS = 3;
const KEY: MoveClass[] = ["mistake", "miss", "blunder"];

/**
 * The key moments worth replaying, in the order the quiz asks them. Without Maia: the costliest mistakes, in game
 * order, as the review stored them (reviews saved before decided positions were left out may still list them).
 * With Maia: the costliest mistake always, since the game turned on it; then the costliest of the ones most players
 * at your rating would find, before any hard ones; asked easiest first, so a miss worth fixing comes before one
 * that's fine to lose.
 */
export function keyMoments(review: GameReview): number[] {
  const stored = review.key_moments.filter((ply) => !review.moves[ply - 1]?.decided);
  const pool = review.moves.filter((m) => m.mine && KEY.includes(m.class) && !m.decided);
  if (!pool.some((m) => m.human)) return stored;
  const turn = pool.reduce((a, b) => (b.win_loss > a.win_loss ? b : a));
  const hard = (m: Move) => (m.human?.best ?? 0) < HARD;
  const rest = pool
    .filter((m) => m !== turn)
    .sort((a, b) => Number(hard(a)) - Number(hard(b)) || b.win_loss - a.win_loss)
    .slice(0, MOMENTS - 1);
  return [turn, ...rest]
    .sort((a, b) => (b.human?.best ?? 0) - (a.human?.best ?? 0) || a.ply - b.ply)
    .map((m) => m.ply);
}

export function read(review: GameReview): CoachRead {
  const moments = keyMoments(review).map((ply) => momentAt(review, ply));
  const story = `A clean game: no mistakes or blunders from you. Your accuracy was ${review.game.accuracy?.toFixed(0) ?? "–"}.`;
  return { story, moments };
}
