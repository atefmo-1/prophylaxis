// The trained tactic classifier (ml/REPORT.md) alongside the motif rules. The rules still decide *whether* a move
// lost or missed material, from the engine's lines. Where they can't say how, the model names the tactic, using
// only the themes where it beat the rules on held-out Lichess puzzles ("trusted" in tactics.json).
import type { Position } from "chessops/chess";
import { encode, PLANES } from "./planes";
import { toMove, type Tag } from "./motifs";
import type { Line } from "./grading";

export interface TacticModel {
  trusted: Set<string>;
  /** Themes present for each (position, UCI move): the move is the side to move's tactic. */
  classify(items: { pos: Position; uci: string }[]): Promise<Set<string>[]>;
}

const LOAD_TIMEOUT_MS = 30_000; // the 14 MB runtime on a slow connection

interface Meta {
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
      trusted: new Set(meta.trusted),
      async classify(items) {
        const planes = new Float32Array(items.length * PLANES * 64);
        const ok = items.map(({ pos, uci }, i) => encode(pos, uci, planes, i * PLANES * 64) !== null);
        if (!items.length) return [];
        const probs = (await call({ planes, n: items.length }, [planes.buffer]))!;
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
      return [names[side - 1], { ...detail, source: "model" }];
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
  const items = [...(askAllowed ? [{ pos: after, uci: reply[0] }] : []), ...(askMissed ? [{ pos: before, uci: best[0] }] : [])];
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
