// SPDX-License-Identifier: AGPL-3.0
// The board encoding and move list below follow Maia-3 (CSSLab, University of Toronto; github.com/CSSLab/maia3,
// AGPL-3.0), whose model public/models/maia3.onnx is. See LICENSES/AGPL-3.0.txt and ml/results/maia.md.
//
// Maia-3 predicts the moves people play, at a given rating. On chess.com beginners its chances are honest: when it
// gives the best move a 30% chance at a player's rating, about 30% of players at that rating find it
// (ml/results/maia.md). So on each of your mistakes the review can say how findable the better move was at your
// level, and whether the move you played is also the one most players at your level play there.
//
// Input: the position and the 7 before it (oldest first), each as 64 squares by 12 one-hot channels seen from the
// side to move in that position (its own pieces first: pawn, knight, bishop, rook, queen, king; then the other
// side's), plus both players' ratings on Maia's (Lichess) scale. Output: one logit per move in Maia's 4,352-move
// list, written from the side to move's view. web/scripts/check-maia.ts compares all of it with the authors' code.
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { makeSquare, roleToChar } from "chessops/util";
import type { NormalMove, Role, Square } from "chessops/types";
import type { GameReview, Move, MoveClass } from "../types";

export const HISTORY = 8;
const CHANNELS = 12;
export const WIDTH = HISTORY * CHANNELS;
export const MOVES = 4352;
const ROLES: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const PROMOTIONS = "qrbn";

/** One position's history (up to HISTORY FENs, oldest first, the position itself last), written into `out` at
 *  `offset` (64 * WIDTH floats). A short history is padded with its earliest position, as the authors do. */
export function encode(fens: string[], out: Float32Array = new Float32Array(64 * WIDTH), offset = 0): Float32Array {
  const boards = fens.slice(-HISTORY);
  const padded = [...Array(HISTORY - boards.length).fill(boards[0]), ...boards];
  padded.forEach((fen: string, h) => {
    const setup = parseFen(fen).unwrap();
    const flip = setup.turn === "white" ? 0 : 56;
    for (const square of setup.board.occupied) {
      const piece = setup.board.get(square)!;
      const channel = ROLES.indexOf(piece.role) + (piece.color === setup.turn ? 0 : 6);
      out[offset + (square ^ flip) * WIDTH + h * CHANNELS + channel] = 1;
    }
  });
  return out;
}

/** A move's place in Maia's move list. UCI as the engine writes it (castling is the king's two-square move);
 *  Black's moves are mirrored first, since the model sees every position from the side to move. */
export function moveIndex(uci: string, black: boolean): number {
  const sq = (s: string) => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
  const flip = black ? 56 : 0;
  const from = sq(uci.slice(0, 2)) ^ flip;
  const to = sq(uci.slice(2, 4)) ^ flip;
  if (uci.length > 4) return 4096 + ((from & 7) * 8 + (to & 7)) * 4 + PROMOTIONS.indexOf(uci[4]);
  return from * 64 + to;
}

/** Every legal move in the position, in UCI as the engine writes it. */
export function legalUcis(fen: string): string[] {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const out = new Set<string>();
  for (const [from, dests] of pos.allDests()) {
    const piece = pos.board.get(from)!;
    for (const to of dests) {
      const target = pos.board.get(to);
      if (piece.role === "king" && target?.role === "rook" && target.color === piece.color) {
        out.add(makeSquare(from) + makeSquare(((from & ~7) + (to > from ? 6 : 2)) as Square));
      } else if (piece.role === "pawn" && (to >> 3 === 7 || to >> 3 === 0)) {
        for (const p of PROMOTIONS) out.add(makeSquare(from) + makeSquare(to) + p);
      } else {
        out.add(makeSquare(from) + makeSquare(to));
      }
    }
  }
  return [...out];
}

/** A SAN move in UCI as the engine writes it (castling as the king's two-square move), or undefined. */
export function sanToEngineUci(fen: string, san: string): string | undefined {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const move = parseSan(pos, san) as NormalMove | undefined;
  if (!move) return undefined;
  const piece = pos.board.get(move.from);
  const target = pos.board.get(move.to);
  const castle = piece?.role === "king" && target?.role === "rook" && target.color === piece.color;
  const to = castle ? (((move.from & ~7) + (move.to > move.from ? 6 : 2)) as Square) : move.to;
  return makeSquare(move.from) + makeSquare(to) + (move.promotion ? roleToChar(move.promotion) : "");
}

/** Chance of each legal move, from the model's logits for that position. */
export function legalChances(logits: Float32Array, offset: number, fen: string): Map<string, number> {
  const black = parseFen(fen).unwrap().turn === "black";
  const ucis = legalUcis(fen);
  const x = ucis.map((u) => logits[offset + moveIndex(u, black)]);
  const top = Math.max(...x);
  const e = x.map((v) => Math.exp(v - top));
  const sum = e.reduce((a, b) => a + b, 0);
  return new Map(ucis.map((u, i) => [u, e[i] / sum]));
}

/** A chess.com rating on Maia's scale, from the map fitted on chess.com beginners (ml/results/maia.md): linear
 *  between its points, flat below the first, and the last point's offset above it. */
export function maiaRating(rating: number, map: [number, number][]): number {
  if (rating <= map[0][0]) return map[0][1];
  for (let i = 1; i < map.length; i++) {
    const [x0, y0] = map[i - 1];
    const [x1, y1] = map[i];
    if (rating <= x1) return Math.round(y0 + ((rating - x0) / (x1 - x0)) * (y1 - y0));
  }
  const [x, y] = map[map.length - 1];
  return Math.min(2600, Math.round(rating + y - x));
}

export interface HumanModel {
  /** Changes whenever the shipped model or the rating map does, so stored reviews can be annotated again. */
  version: string;
  map: [number, number][];
  /** True once the runtime has failed to start: reviews then simply say nothing about other players. */
  readonly failed: boolean;
  /** Chance of each legal move, for each position (its history, oldest first) and pair of Maia ratings. */
  predict(items: { fens: string[]; self: number; oppo: number }[]): Promise<Map<string, number>[]>;
}

interface Meta {
  version: string;
  history: number;
  moves: number;
  chesscom_to_maia: [number, number][];
}

const LOAD_TIMEOUT_MS = 30_000;

type Call = (msg: object, transfer?: Transferable[]) => Promise<Float32Array | undefined>;

async function start(base: string): Promise<Call> {
  const worker = new Worker(new URL("./maia.worker.ts", import.meta.url), { type: "module" });
  let next = 0;
  const pending = new Map<number, { resolve: (v: Float32Array | undefined) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<{ id: number; logits?: Float32Array; error?: string }>) => {
    const p = pending.get(e.data.id);
    pending.delete(e.data.id);
    if (e.data.error) p?.reject(new Error(e.data.error));
    else p?.resolve(e.data.logits);
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "Maia worker failed"));
    pending.clear();
  };
  const call: Call = (msg, transfer = []) =>
    new Promise((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, ...msg }, transfer);
    });
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => (timer = window.setTimeout(() => reject(new Error("Maia took too long to load")), LOAD_TIMEOUT_MS)));
  try {
    await Promise.race([call({ url: new URL(`${base}models/maia3.onnx`, location.href).href }), timeout]);
  } catch (e) {
    worker.terminate();
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return call;
}

/** The model's settings, read up front. The 6.5 MB model loads only when a review has a mistake to look at.
 *  Resolves to null if the settings can't be read; reviews then say nothing about other players. */
export async function loadHumanModel(base: string): Promise<HumanModel | null> {
  let meta: Meta;
  try {
    meta = (await (await fetch(`${base}models/maia3.json`)).json()) as Meta;
    if (meta.history !== HISTORY || meta.moves !== MOVES) throw new Error("maia3.json was made for a different encoding");
  } catch (e) {
    console.warn("Maia unavailable:", e);
    return null;
  }
  let runtime: Promise<Call> | null = null;
  let failed = false;
  const load = () => {
    if (failed) return Promise.reject(new Error("Maia unavailable"));
    return (runtime ??= start(base).catch((e) => {
      failed = true;
      console.warn("Maia unavailable:", e);
      throw e;
    }));
  };
  return {
    version: `${meta.version}.${meta.chesscom_to_maia.flat().join("-")}.${ANNOTATION}`,
    map: meta.chesscom_to_maia,
    get failed() {
      return failed;
    },
    async predict(items) {
      if (!items.length) return [];
      const call = await load();
      const tokens = new Float32Array(items.length * 64 * WIDTH);
      items.forEach((it, i) => encode(it.fens, tokens, i * 64 * WIDTH));
      const self = Float32Array.from(items, (it) => it.self);
      const oppo = Float32Array.from(items, (it) => it.oppo);
      const logits = (await call({ tokens, self, oppo, n: items.length }, [tokens.buffer, self.buffer, oppo.buffer]))!;
      return items.map((it, i) => legalChances(logits, i * MOVES, it.fens[it.fens.length - 1]));
    },
  };
}

/** The moves a review says something about other players on: your mistakes, misses and blunders. */
const ASKED: MoveClass[] = ["mistake", "miss", "blunder"];
/** Bumped when annotateReview stores something new, so stored reviews are annotated again. */
const ANNOTATION = 2;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * The review with Maia's view of each of your mistakes, from the positions it kept: no engine search needed. At your
 * rating: the chance of the best move, of the move you played, and the move played most. At your opponent's rating,
 * in the position after your move: the chance of their best answer (the engine's reply line).
 */
export async function annotateReview(model: HumanModel, review: GameReview): Promise<GameReview> {
  const fens = [review.start_fen, ...review.moves.map((m) => m.fen)];
  const self = maiaRating(review.game.rating, model.map);
  const oppo = maiaRating(review.game.opp_rating, model.map);
  const history = (i: number) => fens.slice(Math.max(0, i - HISTORY + 1), i + 1);
  const asked = review.moves
    .map((m, i) => ({ m, i, reply: m.reply_line.length ? sanToEngineUci(m.fen, m.reply_line[0]) : undefined }))
    .filter(({ m }) => m.mine && ASKED.includes(m.class) && !m.decided && m.best_uci && m.best_uci !== m.uci);
  const replies = asked.filter((a) => a.reply);
  const chances = await model.predict([
    ...asked.map(({ i }) => ({ fens: history(i), self, oppo })),
    ...replies.map(({ i }) => ({ fens: history(i + 1), self: oppo, oppo: self })),
  ]);
  const punish = new Map(replies.map((a, k) => [a.i, chances[asked.length + k].get(a.reply!) ?? 0]));
  const human = new Map(asked.map(({ m, i }, k) => {
    const p = chances[k];
    const top = [...p.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
    const reply = punish.has(i) ? { reply: r3(punish.get(i)!), reply_rating: oppo } : {};
    return [i, { best: r3(p.get(m.best_uci!) ?? 0), played: r3(p.get(m.uci) ?? 0), top: top[0], top_p: r3(top[1]), rating: self, ...reply }];
  }));
  const moves: Move[] = review.moves.map((m, i) => {
    const h = human.get(i);
    if (h) return { ...m, human: h };
    if (!m.human) return m;
    const { human: _, ...rest } = m;
    return rest;
  });
  return { ...review, moves };
}
