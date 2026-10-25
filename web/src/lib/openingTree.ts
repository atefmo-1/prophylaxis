// The openings a player actually plays: every game's first moves merged into one tree, with the results from each
// position on. Built from reviewed games, so it works for any player whose games are in this browser.
import type { StoredGame } from "../analysis/stats";
import type { Color, Result } from "../types";

export const TREE_DEPTH = 20; // plies: ten moves each

export interface TreeNode {
  san: string | null; // the move that led here (null at the start)
  uci: string | null;
  fen: string;
  games: number;
  win: number;
  draw: number;
  loss: number;
  accuracySum: number;
  accuracyCount: number;
  recent: { id: string; t: number; opponent: string; result: Result; url: string }[]; // newest first, a few
  children: Map<string, TreeNode>;
}

const node = (san: string | null, uci: string | null, fen: string): TreeNode => ({
  san, uci, fen, games: 0, win: 0, draw: 0, loss: 0, accuracySum: 0, accuracyCount: 0, recent: [], children: new Map(),
});

function count(n: TreeNode, g: StoredGame["review"]["game"]) {
  n.games++;
  n[g.result]++;
  if (g.accuracy !== null) {
    n.accuracySum += g.accuracy;
    n.accuracyCount++;
  }
  n.recent.push({ id: g.id, t: g.t, opponent: g.opponent, result: g.result, url: g.url });
}

/** One tree for the games played with `color`, from that player's side. */
export function buildTree(stored: StoredGame[], color: Color, depth = TREE_DEPTH): TreeNode {
  const games = stored.filter((s) => s.review.game.color === color && s.review.moves.length > 0);
  const root = node(null, null, games[0]?.review.start_fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  for (const s of games) {
    let at = root;
    count(at, s.review.game);
    for (const m of s.review.moves.slice(0, depth)) {
      let next = at.children.get(m.san);
      if (!next) at.children.set(m.san, (next = node(m.san, m.uci, m.fen)));
      count(next, s.review.game);
      at = next;
    }
  }
  const sortRecent = (n: TreeNode) => {
    n.recent = n.recent.sort((a, b) => b.t - a.t).slice(0, 5);
    n.children.forEach(sortRecent);
  };
  sortRecent(root);
  return root;
}

/** Score from the player's side: a win is 1, a draw a half. */
export const score = (n: TreeNode) => (n.games ? (n.win + n.draw / 2) / n.games : 0);
export const accuracy = (n: TreeNode) => (n.accuracyCount ? n.accuracySum / n.accuracyCount : null);

/** The moves played from a position, most played first. */
export const branches = (n: TreeNode) => [...n.children.values()].sort((a, b) => b.games - a.games || score(b) - score(a));

export const moveLabel = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"} ${san}`;
