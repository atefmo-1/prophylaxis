// Turn one chess.com game into the same GameReview the site exports, using an engine in the browser.
// Mirrors src/coach/analysis.py and stats.game_review; the site's Python pipeline stays the reference.
import type { Position } from "chessops/chess";
import { makeFen } from "chessops/fen";
import { parsePgn, startingPosition } from "chessops/pgn";
import { makeSan, parseSan } from "chessops/san";
import { makeUci } from "chessops/util";
import type { NormalMove } from "chessops/types";
import type { Color, GameReview, Move, MoveClass, MoveTag, Overview, Result } from "../types";
import type { GameFacts } from "./stats";
import { ENDINGS, TAG_INFO } from "./catalog";
import type { Analyser } from "./engine";
import { bookPlies, type OpeningBook } from "./book";
import { BOOK_MAX_LOSS, classify, gameAccuracy, isBrilliant, lineWinWhite, moveAccuracy, phase, pov, type Line } from "./grading";
import { detect, toMove } from "./motifs";
import { refineTags, type TacticModel } from "./tactics";

export const NODES = 400_000;
export const RETRY_NODES = 400_000;
const BAD: MoveClass[] = ["mistake", "miss", "blunder"];
const ALLOWED = new Set([
  "hanging_piece", "allowed_fork", "allowed_mate", "back_rank_mate", "lost_material", "allowed_stalemate",
  "allowed_discovered_attack", "allowed_pin", "allowed_skewer", "trapped_piece",
]);
const DRAWS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);
const RETRY_TOLERANCE = 3;

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class?: string;
  end_time: number;
  rules?: string;
  eco?: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  accuracies?: { white?: number; black?: number };
}

/** A position the engine just finished, for showing the analysis as it happens. */
export interface Frame {
  fen: string;
  win: number; // white's winning chances
}

/** `done` counts finished searches; frames come in game order, so a live replay never skips back. */
export type Progress = (done: number, total: number, stage: "positions" | "retries", frame?: Frame) => void;

const terminal = (p: Position) => p.isCheckmate() || p.isStalemate() || p.isInsufficientMaterial();
const fenOf = (p: Position) => makeFen(p.toSetup());
const epd = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

function clockOf(comments: string[] | undefined): number | null {
  const m = (comments ?? []).join(" ").match(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** Readable opening name and family from a chess.com ECO URL (as src/coach/openings.py). */
export function openingParts(ecoUrl: string | undefined): { name: string; family: string } {
  const slug = (ecoUrl ?? "").replace(/\/$/, "").split("/").pop() ?? "";
  if (!slug || slug === "Undefined") return { name: "Unclassified opening", family: "Unclassified opening" };
  const possessive: Record<string, string> = {
    Kings: "King's", Queens: "Queen's", Bishops: "Bishop's", Birds: "Bird's", Petrovs: "Petrov's", Alekhines: "Alekhine's", Owens: "Owen's", Larsens: "Larsen's",
  };
  const words = slug.split("-").map((w) => possessive[w] ?? w).join(" ").replace("Van t ", "Van't ").split(" ");
  const cut = words.findIndex((w) => ["Opening", "Game", "Defense", "Gambit", "Attack", "System"].includes(w));
  const end = cut >= 0 ? cut + 1 : Math.min(2, words.length);
  const family = words.slice(0, end).join(" ");
  const rest = words.slice(end).join(" ");
  return { name: rest ? `${family}: ${rest}` : family, family };
}

/** What the statistics need about a game beyond its review. */
export function gameFacts(game: ChessComGame, username: string): GameFacts {
  const mine = game.white.username.toLowerCase() === username.toLowerCase() ? game.white : game.black;
  const theirs = mine === game.white ? game.black : game.white;
  const eco = game.eco ?? parsePgn(game.pgn)[0]?.headers.get("ECOUrl");
  return { time_class: game.time_class ?? "rapid", family: openingParts(eco).family, my_code: mine.result, opp_code: theirs.result, end_time: game.end_time };
}

export async function buildReview(
  game: ChessComGame,
  username: string,
  engine: Analyser,
  overview: Overview | null,
  progress?: Progress,
  { tactics = null, book = null }: { tactics?: TacticModel | null; book?: OpeningBook | null } = {},
): Promise<GameReview> {
  const parsed = parsePgn(game.pgn)[0];
  if (!parsed) throw new Error("Couldn't read this game's moves.");
  const myColor: Color = game.white.username.toLowerCase() === username.toLowerCase() ? "white" : "black";
  const me = game[myColor];
  const opp = game[myColor === "white" ? "black" : "white"];

  // Replay the game
  const positions: Position[] = [startingPosition(parsed.headers).unwrap()];
  const sans: string[] = [];
  const clocks: (number | null)[] = [];
  const daily = game.time_control.includes("/"); // a daily game's clock resets every move
  for (const node of parsed.moves.mainline()) {
    const pos = positions[positions.length - 1].clone();
    const move = parseSan(pos, node.san);
    if (!move) break;
    sans.push(makeSan(pos, move));
    pos.play(move);
    positions.push(pos);
    clocks.push(daily ? null : clockOf(node.comments));
  }
  const n = sans.length;

  // Evaluate every distinct position once. Each lane (one engine) takes a run of consecutive positions, which share
  // most of what the engine learns reading them.
  const lines = new Map<string, Line[]>();
  const todo = [...new Map(positions.filter((p) => !terminal(p)).map((p) => [epd(fenOf(p)), fenOf(p)])).values()];
  const lanes = Math.min(engine.lanes, Math.max(todo.length, 1));
  const laneOf = (i: number) => Math.floor((i * lanes) / todo.length);
  for (let l = 0; l < lanes; l++) engine.newGame(l);
  let finished = 0;
  const searches = todo.map((fen, i) =>
    engine.analyse(fen, 2, NODES, laneOf(i)).then((found) => {
      progress?.(++finished, todo.length, "positions");
      return found;
    }),
  );
  for (const s of searches) s.catch(() => undefined); // if one fails (stopped), the first await below reports it
  for (let i = 0; i < todo.length; i++) {
    const found = await searches[i];
    lines.set(epd(todo[i]), found);
    progress?.(finished, todo.length, "positions", { fen: todo[i], win: found[0] ? lineWinWhite(found[0]) : 50 });
  }
  const linesAt = (p: Position) => (terminal(p) ? null : lines.get(epd(fenOf(p))) ?? []);
  const winWhite = positions.map((p) =>
    terminal(p) ? (p.isCheckmate() ? (p.turn === "white" ? 0 : 100) : 50) : lineWinWhite(linesAt(p)![0] ?? { cp: 0, mate: null }),
  );

  // Grade every move
  const inBook = book ? bookPlies(book, positions) : 0;
  const [base, inc] = game.time_control.split("+").map(Number);
  const lastClock: Record<Color, number | null> = { white: Number.isFinite(base) ? base : null, black: Number.isFinite(base) ? base : null };
  const moves: Move[] = [];
  const accuracyAt = new Map<number, number>();
  for (let ply = 1; ply <= n; ply++) {
    const before = positions[ply - 1];
    const after = positions[ply];
    const mover = before.turn;
    const move = parseSan(before, sans[ply - 1]) as NormalMove;
    const uci = makeUci(toUciMove(before, move));
    const lb = linesAt(before) ?? [];
    const la = linesAt(after);
    const wb = pov(winWhite[ply - 1], mover === "white");
    const wa = pov(winWhite[ply], mover === "white");
    const loss = Math.max(0, wb - wa);
    accuracyAt.set(ply, moveAccuracy(wb, wa));
    const bestUci = lb[0]?.pv[0] ?? null;
    let cls = classify(loss, uci === bestUci);
    if (cls === "best" && lb.length > 1 && !before.isCheck() && wb >= 25) {
      const prev = moves[ply - 2];
      const recapture = prev && prev.uci.slice(2, 4) === uci.slice(2, 4) && !!before.board.get(move.to);
      if (!recapture && wb - pov(lineWinWhite(lb[1]), mover === "white") >= 20) cls = "great";
    }
    if (isBrilliant(before, move, wb, wa, loss)) cls = "brilliant";
    if (ply <= inBook && loss < BOOK_MAX_LOSS) cls = "book";
    const clockAfter = clocks[ply - 1];
    const clockBefore = lastClock[mover];
    const spent = clockAfter !== null && clockBefore !== null ? Math.max(0, clockBefore + (inc || 0) - clockAfter) : null;
    lastClock[mover] = clockAfter;

    let tags: MoveTag[] = [];
    if (mover === myColor) {
      let found = detect(before, move, lb, la, loss, clockBefore, spent);
      if (tactics) found = await refineTags(tactics, found, before, uci, lb, la).catch(() => found);
      tags = found.map(([tag, detail]) => ({ tag, detail }));
      const names = new Set(tags.map((t) => t.tag));
      const oppErred = moves.length >= 1 && BAD.includes(moves[moves.length - 1].class);
      if (BAD.includes(cls) && oppErred && [...names].some((t) => t.startsWith("missed_")) && ![...names].some((t) => ALLOWED.has(t))) {
        cls = "miss";
      }
    }
    const san = (p: Position, ucis: string[]) => {
      const q = p.clone();
      const out: string[] = [];
      for (const u of ucis.slice(0, 8)) {
        const m = toMove(q, u);
        if (!m || !q.isLegal(m)) break;
        out.push(makeSan(q, m));
        q.play(m);
      }
      return out;
    };
    const bestLine = lb[0] ? san(before, lb[0].pv) : [];
    moves.push({
      ply,
      color: mover,
      mine: mover === myColor,
      san: sans[ply - 1],
      uci,
      fen: fenOf(after),
      clock: clockAfter,
      time_spent: spent,
      win_white: winWhite[ply],
      eval_cp: la?.[0]?.cp ?? null,
      eval_mate: la?.[0]?.mate ?? null,
      win_loss: loss,
      class: cls,
      best: bestLine[0] ?? null,
      best_uci: bestUci,
      best_line: bestLine,
      reply_line: la?.[0] ? san(after, la[0].pv) : [],
      phase: phase(before, ply),
      tags,
      decided: (wb >= 95 && wa >= 85) || wb <= 5,
      retry: null,
    });
  }

  // Retry answers: every legal move scored where you went wrong
  // (on the lane that read the position, where the engine already knows it).
  const retries = moves.filter((m) => m.mine && BAD.includes(m.class) && !m.decided);
  const laneAt = new Map(todo.map((fen, i) => [epd(fen), laneOf(i)]));
  let retried = 0;
  await Promise.all(
    retries.map(async (m) => {
      const before = positions[m.ply - 1];
      const count = [...before.allDests().values()].reduce((a, d) => a + d.size(), 0);
      const all = await engine.analyse(fenOf(before), Math.min(count, 60), RETRY_NODES, laneAt.get(epd(fenOf(before))) ?? 0);
      const wins: Record<string, number> = {};
      for (const l of all) if (l.pv[0]) wins[l.pv[0]] = Math.round(pov(lineWinWhite(l), m.color === "white") * 10) / 10;
      const best = Math.max(...Object.values(wins));
      const accept = Object.keys(wins).filter((u) => wins[u] >= best - RETRY_TOLERANCE && u !== m.uci).sort((a, b) => wins[b] - wins[a]);
      m.retry = { accept: accept.length ? accept : m.best_uci ? [m.best_uci] : [], wins };
      progress?.(++retried, retries.length, "retries");
    }),
  );

  // Summary
  const [accWhite, accBlack] = gameAccuracy(winWhite, positions[0].turn === "white");
  const mine = moves.filter((m) => m.mine);
  const key = [...mine.filter((m) => BAD.includes(m.class))].sort((a, b) => b.win_loss - a.win_loss).slice(0, 3).sort((a, b) => a.ply - b.ply);
  const count = (side: boolean) => moves.filter((m) => m.mine === side).reduce<Record<string, number>>((c, m) => ((c[m.class] = (c[m.class] ?? 0) + 1), c), {});
  const code = me.result;
  const result: Result = code === "win" ? "win" : DRAWS.has(code) ? "draw" : "loss";
  const endingCode = result === "win" ? opp.result : code;
  const weaknesses = overview && !overview.empty ? overview.weaknesses : [];
  const present = [...new Set(moves.flatMap((m) => m.tags.map((t) => t.tag)))];
  const startTime = parsed.headers.get("UTCDate") && parsed.headers.get("UTCTime")
    ? Date.parse(`${parsed.headers.get("UTCDate")!.replace(/\./g, "-")}T${parsed.headers.get("UTCTime")}Z`) / 1000
    : game.end_time;

  return {
    game: {
      id: game.url.replace(/\/$/, "").split("/").pop()!,
      url: game.url,
      t: startTime,
      color: myColor,
      opponent: opp.username,
      opp_rating: opp.rating,
      rating: me.rating,
      result,
      ending: ENDINGS[`${result}:${endingCode}`] ?? result[0].toUpperCase() + result.slice(1),
      opening: openingParts(game.eco ?? parsed.headers.get("ECOUrl")).name,
      time_control: game.time_control,
      accuracy: myColor === "white" ? accWhite : accBlack,
      opp_accuracy: myColor === "white" ? accBlack : accWhite,
      chesscom_accuracy: game.accuracies?.[myColor] ?? null,
      rating_change: null,
    },
    phases: (["opening", "middlegame", "endgame"] as const).flatMap((ph) => {
      const pm = mine.filter((m) => m.phase === ph);
      if (!pm.length) return [];
      const worst = pm.reduce((a, b) => (b.win_loss > a.win_loss ? b : a));
      return [{
        phase: ph,
        first_ply: moves.find((m) => m.phase === ph)!.ply,
        moves: pm.length,
        mistakes: pm.filter((m) => BAD.includes(m.class)).length,
        accuracy: pm.reduce((a, m) => a + accuracyAt.get(m.ply)!, 0) / pm.length,
        worst_class: worst.class,
      }];
    }),
    habits: Object.fromEntries(
      present.flatMap((tag) => {
        const i = weaknesses.findIndex((w) => w.tag === tag);
        return i < 0 ? [] : [[tag, { rank: i + 1, recent_games: weaknesses[i].windows.last, window: weaknesses[i].windows.size }]];
      }),
    ),
    start_fen: fenOf(positions[0]),
    start_win_white: winWhite[0],
    moves,
    key_moments: key.map((m) => m.ply),
    summary: { mine: count(true), theirs: count(false) },
    tag_info: Object.fromEntries(present.filter((t) => TAG_INFO[t]).map((t) => [t, TAG_INFO[t]])),
  };
}

/** UCI as python-chess writes it: castling as the king's two-square move. */
function toUciMove(pos: Position, move: NormalMove): NormalMove {
  const king = pos.board.get(move.from);
  if (king?.role === "king") {
    const rook = pos.board.get(move.to);
    if (rook?.role === "rook" && rook.color === king.color) {
      const kingside = move.to > move.from;
      return { from: move.from, to: (move.from & ~7) + (kingside ? 6 : 2) };
    }
  }
  return move;
}
