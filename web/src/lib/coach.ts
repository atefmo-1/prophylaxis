// The coach's read of one game: what happened, where it turned, and one thing to do next time.
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
  headline: string;
  story: string;
  lesson: { title: string; fix: string } | null;
  moments: Moment[];
  strengths: string | null;
}

const ENDING_VERB: Record<string, string> = { win: "went on to win", loss: "went on to lose", draw: "drew in the end" };

export function momentAt(review: GameReview, ply: number): Moment {
  const index = ply - 1;
  const m = review.moves[index];
  const [before, after] = chancesAround(review, index);
  const why =
    m.tags.map((t) => tagSentence(t, m)).find((s): s is string => !!s) ??
    (m.best ? `The best move was ${m.best}.` : `${CLASS_META[m.class].label}.`);
  return { ply, index, label: moveLabel(ply, m.san), cls: m.class, before, after, loss: m.win_loss, why, best: m.best };
}

export function read(review: GameReview): CoachRead {
  const g = review.game;
  const moves = Math.ceil(review.moves.length / 2);
  const headline = `${g.ending} in ${moves} moves.`;
  const moments = review.key_moments.map((ply) => momentAt(review, ply));

  let story: string;
  const turn = [...moments].sort((a, b) => b.loss - a.loss)[0];
  if (!turn) {
    story = `A clean game: no mistakes or blunders from you. Your accuracy was ${g.accuracy?.toFixed(0) ?? "–"}.`;
  } else {
    const reply = review.moves[turn.index + 1];
    const punished =
      reply === undefined
        ? ""
        : reply.win_loss >= 10
          ? " Your opponent missed the chance on the very next move."
          : " Your opponent found the right reply.";
    story =
      `The game turned on ${turn.label}: your winning chances fell from ${Math.round(turn.before)}% to ${Math.round(turn.after)}%.` +
      `${punished} You ${ENDING_VERB[g.result]}.`;
  }

  // The habit that cost the most winning chances in this game
  const cost = new Map<string, number>();
  for (const m of review.moves) {
    if (!m.mine) continue;
    for (const t of m.tags) cost.set(t.tag, (cost.get(t.tag) ?? 0) + m.win_loss);
  }
  const top = [...cost.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const info = top ? review.tag_info[top] : undefined;
  const lesson = info ? { title: info.title, fix: info.fix } : null;

  const brilliant = review.moves.filter((m) => m.mine && m.class === "brilliant");
  const great = review.moves.filter((m) => m.mine && m.class === "great");
  const strengths =
    brilliant.length > 0
      ? `${brilliant.length === 1 ? "A brilliant move" : `${brilliant.length} brilliant moves`}: ${moveLabel(brilliant[0].ply, brilliant[0].san)}.`
      : great.length > 0
        ? `${great.length === 1 ? "One great move" : `${great.length} great moves`}, including ${moveLabel(great[0].ply, great[0].san)}.`
        : null;

  return { headline, story, lesson, moments, strengths };
}
