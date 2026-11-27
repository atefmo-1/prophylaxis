// Plain-English explanation of one move, built from engine facts in the export and, on your mistakes, Maia-3's
// chances for players at your rating (analysis/maia.ts).
import type { GameReview, Move, MoveTag } from "../types";
import { CLASS_META, pct } from "./format";

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const str = (value: unknown) => String(value ?? "");

export function tagSentence(tag: MoveTag, move: Move): string | null {
  const d = tag.detail;
  const best = move.best ?? "the best move";
  switch (tag.tag) {
    case "hanging_piece":
      return `It left your ${str(d.piece)} on ${str(d.square)} where it could be taken for free or by a cheaper piece.`;
    case "allowed_fork":
      return (d.targets as string[] | undefined)?.length
        ? `It allowed a ${str(d.by)} fork of your ${list(d.targets as string[])}.`
        : `It allowed a fork that wins about ${str(d.amount)} points of material.`;
    case "allowed_discovered_attack":
      return `It allowed a discovered attack: one enemy piece moves and uncovers another, winning about ${str(d.amount)} points of material.`;
    case "allowed_pin":
      return `It allowed a pin that wins about ${str(d.amount)} points of material.`;
    case "allowed_skewer":
      return `It allowed a skewer that wins about ${str(d.amount)} points of material.`;
    case "trapped_piece":
      return `It left one of your pieces trapped, and it can be won: about ${str(d.amount)} points of material.`;
    case "allowed_mate":
      return Number(d.in) === 1 ? "It allowed checkmate on the next move." : `It allowed a forced checkmate in ${str(d.in)}.`;
    case "back_rank_mate":
      return "The mate lands on your back rank, where your own pawns box the king in.";
    case "ignored_threat": {
      const move = str(d.move);
      if (d.mate !== undefined)
        return Number(d.mate) === 1
          ? `Your opponent already threatened checkmate with ${move}, and your move didn't stop it.`
          : `Your opponent already threatened a forced mate starting with ${move}, and your move didn't stop it.`;
      const what = Number(d.amount) === 1 ? "a pawn" : `about ${str(d.amount)} points of material`;
      return `Your opponent already threatened ${move}, winning ${what}, and your move didn't stop it.`;
    }
    case "lost_pawn":
      return `It let your opponent win a pawn with ${str(d.move)}.`;
    case "missed_pawn":
      return `${str(d.move)} would have won a pawn.`;
    case "lost_material":
      return `It let your opponent win about ${str(d.amount)} points of material (a pawn is 1, a knight 3).`;
    case "allowed_stalemate":
      return "It left your opponent with no legal moves: stalemate, a draw from a winning position.";
    case "missed_free_piece":
      return `${best} would have won a ${str(d.piece)}.`;
    case "missed_fork":
      return (d.targets as string[] | undefined)?.length
        ? `${best} was a ${str(d.by)} fork of their ${list(d.targets as string[])}.`
        : `${best} started a fork, winning about ${str(d.amount)} points of material.`;
    case "missed_discovered_attack":
      return `${best} started a discovered attack, winning about ${str(d.amount)} points of material.`;
    case "missed_pin":
      return `${best} started a pin, winning about ${str(d.amount)} points of material.`;
    case "missed_skewer":
      return `${best} started a skewer, winning about ${str(d.amount)} points of material.`;
    case "missed_trapped_piece":
      return `${best} started winning a trapped piece: about ${str(d.amount)} points of material.`;
    case "missed_mate":
      return Number(d.in) === 1 ? `${best} was checkmate.` : `${best} started a forced checkmate in ${str(d.in)}.`;
    case "missed_tactic":
      return `${best} started a sequence winning about ${str(d.amount)} points of material.`;
    case "time_pressure":
      return `You played it with ${str(d.clock)} seconds left on your clock.`;
    case "rushed":
      return `You played it in ${str(d.seconds)} seconds while you still had plenty of time.`;
    default:
      return null;
  }
}

const NICE = [7, 10, 15, 20, 30, 50, 100];

/** "about 3 in 10 players at your rating find it", from Maia's chance for the move at your rating. Maia's chances
 *  are honest on chess.com beginners (ml/results/maia.md), so these are fair statements about players at your
 *  rating; they say nothing about you. */
export function findable(p: number): { text: string; hard: boolean } {
  if (p >= 0.95) return { text: "almost every player at your rating finds", hard: false };
  if (p >= 0.15) return { text: `about ${Math.round(p * 10)} in 10 players at your rating find`, hard: false };
  if (p < 0.01) return { text: "fewer than 1 in 100 players at your rating find", hard: true };
  const m = NICE.reduce((a, b) => (Math.abs(Math.log(b * p)) < Math.abs(Math.log(a * p)) ? b : a));
  return { text: `only about 1 in ${m} players at your rating find`, hard: true };
}

/** After a practice try: how findable the answer was at your rating, as a sentence. */
export function findableLine(p: number): string {
  const text = findable(p).text;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} it in this position.`;
}

/** The best-move line, with how findable the move was at your rating when Maia has looked at it. */
function bestLine(move: Move): string {
  const h = move.human;
  if (!h) return `The best move was ${move.best}.`;
  const f = findable(h.best);
  return f.hard
    ? `The best move was ${move.best}, which ${f.text} here: a hard one to see.`
    : `The best move was ${move.best}: ${f.text} it here.`;
}

/** Said when the move you played is the one players at your rating play most here. */
function commonMistake(move: Move): string | null {
  const h = move.human;
  if (!h || h.top !== move.uci) return null;
  const n = Math.round(h.played * 10);
  return n >= 3 ? `It's a common mistake: about ${n} in 10 players at your rating play it here too.` : null;
}

export interface Explanation {
  heading: string;
  verdict: string;
  chances: string;
  lines: string[];
  bestLine: string[] | null;
  replyLine: string[] | null;
}

/** Your winning chances (0-100) before and after the move at index `i`. */
export function chancesAround(review: GameReview, i: number): [number, number] {
  const mine = review.game.color === "white";
  const toMine = (w: number) => (mine ? w : 100 - w);
  const before = i === 0 ? review.start_win_white : review.moves[i - 1].win_white;
  return [toMine(before), toMine(review.moves[i].win_white)];
}

export function explain(review: GameReview, i: number): Explanation {
  const move = review.moves[i];
  const meta = CLASS_META[move.class];
  const [before, after] = chancesAround(review, i);
  const who = move.mine ? "You" : "Your opponent";
  const bad = move.class === "inaccuracy" || move.class === "mistake" || move.class === "blunder";

  let verdict: string;
  if (move.class === "brilliant") verdict = `Brilliant: ${who.toLowerCase()} gave up material for a better position, and the engine agrees.`;
  else if (move.class === "great") verdict = `${who} found the only good move here.`;
  else if (move.class === "book") verdict = "Book move: known opening theory.";
  else if (move.class === "best") verdict = `${who} played the engine's top choice.`;
  else if (!bad) verdict = `${meta.label} move: close to the best.`;
  else verdict = `${meta.label}.`;

  const chances =
    Math.round(before) === Math.round(after)
      ? `Your winning chances stayed at ${pct(after)}.`
      : `Your winning chances went from ${pct(before)} to ${pct(after)}.`;

  const lines: string[] = [];
  if (move.mine && !["brilliant", "great", "best", "book"].includes(move.class) && move.best) {
    lines.push(bestLine(move));
  }
  for (const tag of move.tags) {
    const sentence = tagSentence(tag, move);
    if (sentence) lines.push(sentence);
  }
  const common = move.mine ? commonMistake(move) : null;
  if (common) lines.push(common);
  // A forced mate on the board after this move, stated once (the mate tags already cover short mates).
  if (move.eval_mate !== null && !move.tags.some((t) => t.tag === "allowed_mate")) {
    // eval_mate is from white's side: positive means white mates
    const whiteMates = move.eval_mate > 0;
    const youMate = (review.game.color === "white") === whiteMates;
    const n = Math.abs(move.eval_mate);
    lines.push(youMate ? `You now have a forced checkmate in ${n}.` : `Your opponent now has a forced checkmate in ${n}.`);
  }
  if (!move.mine && bad && move.reply_line.length > 0) {
    lines.push(`Your best answer was ${move.reply_line[0]}.`);
  }
  // Your mistake, and the reply that didn't punish it: say so, or the next move's jump in your chances looks unexplained.
  const reply = review.moves[i + 1];
  if (move.mine && (bad || move.class === "miss") && reply && reply.win_loss >= 10) {
    const label = `${Math.ceil(reply.ply / 2)}${reply.color === "white" ? "." : "…"} ${reply.san}`;
    lines.push(`Your opponent missed the chance: ${label} put your winning chances back up to ${pct(chancesAround(review, i + 1)[1])}.`);
  }

  return {
    heading: `${Math.ceil(move.ply / 2)}${move.color === "white" ? "." : "…"} ${move.san}`,
    verdict,
    chances,
    lines,
    bestLine: move.mine && bad && move.best_line.length > 0 ? move.best_line : null,
    replyLine: move.mine && bad && move.reply_line.length > 0 ? move.reply_line : null,
  };
}
