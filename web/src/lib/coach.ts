// The coach's read of one game: its key moments, and a line for a game without any.
// Every sentence is built from engine facts in the export; nothing is generated freely.
import type { GameReview, MoveClass } from "../types";
import { chancesAround, tagSentence } from "./explain";
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

/** The key moments worth replaying: reviews saved before decided positions were left out may still list them. */
export const keyMoments = (review: GameReview) => review.key_moments.filter((ply) => !review.moves[ply - 1]?.decided);

export function read(review: GameReview): CoachRead {
  const moments = keyMoments(review).map((ply) => momentAt(review, ply));
  const story = `A clean game: no mistakes or blunders from you. Your accuracy was ${review.game.accuracy?.toFixed(0) ?? "–"}.`;
  return { story, moments };
}
