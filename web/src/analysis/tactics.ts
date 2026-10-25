// The trained tactic classifier (ml/REPORT.md) alongside the motif rules. The rules still decide *whether* a move
// lost or missed material, from the engine's lines. Where they can't say how, the model names the tactic from the
// position and the engine's line, using only the themes where it beat the rules both on held-out Lichess puzzles
// and on real beginner games ("trusted" in tactics.json).
import { Chess, type Position } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { makeUci } from "chessops/util";
import type { NormalMove } from "chessops/types";
import type { GameReview } from "../types";
import { TAG_INFO } from "./catalog";
import { encode, modelLine, PLANES } from "./planes";
import { toMove, type Tag } from "./motifs";
import type { Line } from "./grading";

export interface TacticModel {
  /** Changes whenever the shipped model does, so reviews tagged by an older one can be re-tagged. */
  version: string;
  trusted: Set<string>;
  /** Themes present for each position and engine line (UCI) for the side to move: the line's first move is theirs. */
  classify(items: { pos: Position; line: string[] }[]): Promise<Set<string>[]>;
}

const LOAD_TIMEOUT_MS = 30_000; // the 14 MB runtime on a slow connection

interface Meta {
  version: string;
  planes: number;
  themes: string[];
  thresholds: number[];
  trusted: string[];
}

/** Loads the model in its own worker; resolves to null (rules only) if anything about it fails. */
export async function loadTacticModel(base: string): Promise<TacticModel | null> {
  try {
    const meta = (await (await fetch(`${base}models/tactics.json`)).json()) as Meta;
    if (meta.planes !== PLANES) throw new Error("tactics.json was made for a different encoding");
    const worker = new Worker(new URL("./tactics.worker.ts", import.meta.url), { type: "module" });
    let next = 0;
    const pending = new Map<number, { resolve: (v: Float32Array | undefined) => void; reject: (e: Error) => void }>();
    worker.onmessage = (e: MessageEvent<{ id: number; probs?: Float32Array; error?: string }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (e.data.error) p?.reject(new Error(e.data.error));
      else p?.resolve(e.data.probs);
    };
    // A worker that fails to start never answers: fail everything waiting, so reviews fall back to the rules.
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "tactic worker failed"));
      pending.clear();
    };
    const call = (msg: object, transfer: Transferable[] = []) =>
      new Promise<Float32Array | undefined>((resolve, reject) => {
        const id = next++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, ...msg }, transfer);
      });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tactic model took too long to load")), LOAD_TIMEOUT_MS));
    await Promise.race([call({ url: new URL(`${base}models/tactics.onnx`, location.href).href }), timeout]);
    const k = meta.themes.length;
    return {
      version: meta.version,
      trusted: new Set(meta.trusted),
      async classify(items) {
        const planes = new Float32Array(items.length * PLANES * 64);
        const ok = items.map(({ pos, line }, i) => encode(pos, modelLine(pos, line), planes, i * PLANES * 64) !== null);
        if (!items.length) return [];
        const probs = (await call({ planes, n: items.length, size: PLANES }, [planes.buffer]))!;
        return items.map((_, i) => new Set(ok[i] ? meta.themes.filter((_, j) => probs[i * k + j] >= meta.thresholds[j]) : []));
      },
    };
  } catch (e) {
    console.warn("Tactic classifier unavailable, using the rules alone:", e);
    return null;
  }
}

// The tag each theme becomes on either side of a mistake, in the order a coach would name them.
const NAMED: [theme: string, allowed: string, missed: string][] = [
  ["hangingPiece", "hanging_piece", "missed_free_piece"],
  ["fork", "allowed_fork", "missed_fork"],
  ["discoveredAttack", "allowed_discovered_attack", "missed_discovered_attack"],
  ["pin", "allowed_pin", "missed_pin"],
  ["skewer", "allowed_skewer", "missed_skewer"],
  ["trappedPiece", "trapped_piece", "missed_trapped_piece"],
];

/** Name a generic material tag (`lost_material`, `missed_tactic`) after the first trusted theme the model sees.
 *  A tag the rules already named (a hanging piece, a fork) is never overruled: the rules check it against the
 *  engine's line, and on those two themes Lichess's labels are narrower than the site's meaning (ml/REPORT.md). */
function rename(tag: Tag, side: 1 | 2, found: Set<string>, trusted: Set<string>, pos: Position, uci: string): Tag {
  for (const [theme, ...names] of NAMED) {
    if (!trusted.has(theme) || !found.has(theme)) continue;
    const victim = pos.board.get(toMove(pos, uci)!.to);
    if (theme === "hangingPiece") {
      // A free piece is only "free" if the move takes it.
      if (!victim || victim.color === pos.turn) continue;
      const detail = side === 1 ? { piece: victim.role, square: uci.slice(2, 4) } : { piece: victim.role };
      return [names[side - 1], { ...detail, amount: tag[1].amount, source: "model" }];
    }
    // The model names the idea, not the piece: the first move of the line may not be the one that pins or forks.
    return [names[side - 1], { ...tag[1], source: "model" }];
  }
  return tag;
}

/** The rules' tags for one of your moves, with the model's names where it is trusted. */
export async function refineTags(
  model: TacticModel,
  tags: Tag[],
  before: Position,
  uci: string,
  linesBefore: Line[],
  linesAfter: Line[] | null,
): Promise<Tag[]> {
  const after = before.clone();
  after.play(toMove(before, uci)!);
  const reply = linesAfter?.[0]?.pv ?? [];
  const best = linesBefore[0]?.pv ?? [];
  const allowedAt = tags.findIndex((t) => t[0] === "lost_material");
  const mateAt = tags.findIndex((t) => t[0] === "allowed_mate");
  const missedAt = tags.findIndex((t) => t[0] === "missed_tactic");
  const askAllowed = (allowedAt >= 0 || (mateAt >= 0 && model.trusted.has("backRankMate"))) && reply.length > 0;
  const askMissed = missedAt >= 0 && best.length > 0;
  if (!askAllowed && !askMissed) return tags;
  const items = [...(askAllowed ? [{ pos: after, line: reply }] : []), ...(askMissed ? [{ pos: before, line: best }] : [])];
  const found = await model.classify(items);
  const allowed = askAllowed ? found[0] : null;
  const missed = askMissed ? found[found.length - 1] : null;
  const out = [...tags];
  if (allowed && allowedAt >= 0) out[allowedAt] = rename(tags[allowedAt], 1, allowed, model.trusted, after, reply[0]);
  if (missed && missedAt >= 0) out[missedAt] = rename(tags[missedAt], 2, missed, model.trusted, before, best[0]);
  // Last, since it can add or remove a tag and shift the indices above.
  if (allowed && mateAt >= 0 && model.trusted.has("backRankMate")) {
    const has = out.some((t) => t[0] === "back_rank_mate");
    if (allowed.has("backRankMate") && !has) out.splice(mateAt + 1, 0, ["back_rank_mate", { source: "model" }]);
    if (!allowed.has("backRankMate") && has) out.splice(out.findIndex((t) => t[0] === "back_rank_mate"), 1);
  }
  return out;
}

const ALLOWED_NAMES = new Set(NAMED.map((n) => n[1]));

/** A tag as the rules alone gave it: model-named tags go back to the generic tag they renamed. */
function unname(tag: Tag): Tag | null {
  if (tag[1].source !== "model") return tag;
  if (tag[0] === "back_rank_mate") return null;
  return [ALLOWED_NAMES.has(tag[0]) ? "lost_material" : "missed_tactic", { amount: tag[1].amount }];
}

/** SAN moves from a stored review back to UCI, castling as the king's two-square move (as the engine writes it). */
function sanToUci(fen: string, sans: string[]): string[] {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const out: string[] = [];
  for (const san of sans) {
    const move = parseSan(pos, san) as NormalMove | undefined;
    if (!move) break;
    const piece = pos.board.get(move.from);
    const target = pos.board.get(move.to);
    const castle = piece?.role === "king" && target?.role === "rook" && target.color === piece.color;
    out.push(castle ? makeUci({ from: move.from, to: (move.from & ~7) + (move.to > move.from ? 6 : 2) }) : makeUci(move));
    pos.play(move);
  }
  return out;
}

const REFINED = new Set(["lost_material", "missed_tactic", "allowed_mate"]);

/** Re-tag a stored review with the current model, from the engine lines it kept: no new engine search needed. */
export async function retagReview(model: TacticModel, review: GameReview): Promise<GameReview> {
  const moves = [];
  for (let i = 0; i < review.moves.length; i++) {
    const m = review.moves[i];
    const rules = m.tags.map((t) => unname([t.tag, t.detail])).filter((t): t is Tag => t !== null);
    if (!m.mine || !rules.some((t) => REFINED.has(t[0]))) {
      moves.push(m.tags.length === rules.length ? m : { ...m, tags: rules.map(([tag, detail]) => ({ tag, detail })) });
      continue;
    }
    const beforeFen = i === 0 ? review.start_fen : review.moves[i - 1].fen;
    const before = Chess.fromSetup(parseFen(beforeFen).unwrap()).unwrap();
    const lines = (fen: string, sans: string[]) => [{ cp: null, mate: null, pv: sanToUci(fen, sans) }];
    const tags = await refineTags(model, rules, before, m.uci, lines(beforeFen, m.best_line), lines(m.fen, m.reply_line));
    moves.push({ ...m, tags: tags.map(([tag, detail]) => ({ tag, detail })) });
  }
  const present = [...new Set(moves.flatMap((m) => m.tags.map((t) => t.tag)))];
  return { ...review, moves, tag_info: Object.fromEntries(present.filter((t) => TAG_INFO[t]).map((t) => [t, TAG_INFO[t]])) };
}
