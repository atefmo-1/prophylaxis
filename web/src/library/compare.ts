// Comparing the player with another chess.com player: that player's latest games in the same time control,
// reviewed in this browser exactly like the player's own (and kept under their name, so the next comparison is
// instant), then the same statistics for both.
import { useEffect, useMemo, useRef, useState } from "react";
import { NODES, type ChessComGame } from "../analysis/review";
import { ANALYSIS_VERSION, overview as buildOverview, type StoredGame } from "../analysis/stats";
import type { Overview } from "../types";
import { fetchGames, findPlayer, gameId } from "./chesscom";
import { getDevice, pliesOf } from "./device";
import { useLibraryStatus } from "./Library";
import { reviewGame } from "./reviewer";
import { remember } from "./compared";
import { loadGames, saveGame } from "./store";

/** Games compared on each side: enough for the ranges to separate real differences, about 2–3 minutes on a laptop. */
export const COMPARE_GAMES = 30;
/** Results appear once this many of their games are reviewed. */
export const COMPARE_MIN = 10;
const MONTHS = 12;

export type CompareStatus =
  | { kind: "idle" }
  | { kind: "loading"; step: string }
  | { kind: "waiting" } // the player's own games are reviewed first
  | { kind: "reviewing"; done: number; total: number; eta: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const method = { engine: "Stockfish 19 Lite", nodes: NODES, analysis_version: ANALYSIS_VERSION };

/** The latest `n` played games in one time control, newest first. */
export function latest(stored: StoredGame[], timeClass: string, n = COMPARE_GAMES): StoredGame[] {
  return stored
    .filter((s) => s.facts.time_class === timeClass && s.review.moves.length > 0)
    .sort((a, b) => b.review.game.t - a.review.game.t)
    .slice(0, n);
}

export function useComparison(name: string | null, timeClass: string | null) {
  const own = useLibraryStatus();
  const busy = own.kind === "analysing" || own.kind === "checking";
  const [status, setStatus] = useState<CompareStatus>({ kind: "idle" });
  const [player, setPlayer] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredGame[]>([]);
  const [todo, setTodo] = useState<ChessComGame[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const run = useRef(0);

  // Who they are, what's already reviewed, and which of their games to review.
  useEffect(() => {
    const token = ++run.current;
    const live = () => run.current === token;
    setPlayer(null);
    setStored([]);
    setTodo(null);
    setChosen([]);
    if (!name || !timeClass) return void setStatus({ kind: "idle" });
    (async () => {
      setStatus({ kind: "loading", step: "Finding the player on chess.com…" });
      const who = await findPlayer(name);
      if (!live()) return;
      setPlayer(who);
      remember(who);
      const have = await loadGames(who.toLowerCase()).catch(() => [] as StoredGame[]);
      if (!live()) return;
      setStored(have);
      setStatus({ kind: "loading", step: `Loading ${who}'s games…` });
      const games = (await fetchGames(who, MONTHS, 300))
        .filter((g) => g.time_class === timeClass && (g as ChessComGame & { rated?: boolean }).rated !== false)
        .slice(0, COMPARE_GAMES);
      if (!live()) return;
      const done = new Set(have.filter((s) => s.version === ANALYSIS_VERSION).map((s) => s.review.game.id));
      setChosen(games.map(gameId));
      setTodo(games.filter((g) => !done.has(gameId(g))));
      if (!games.length) setStatus({ kind: "error", message: `${who} has no rated ${timeClass} games in the last year.` });
    })().catch((e: Error) => live() && setStatus({ kind: "error", message: e.message }));
  }, [name, timeClass]);

  // Review what's missing, one game per pass, once the player's own games are done. Each pass removes the game it
  // reviewed from the list, so a pass cut short (the page closed, the player's own queue started) loses nothing.
  useEffect(() => {
    if (!player || !todo) return;
    if (!todo.length) return void setStatus((s) => (s.kind === "error" ? s : { kind: "ready" }));
    if (busy) return void setStatus({ kind: "waiting" });
    const token = run.current;
    let stopped = false;
    const live = () => run.current === token && !stopped;
    (async () => {
      const dev = await getDevice();
      const eta = todo.reduce((a, g) => a + dev.estimate(pliesOf(g.pgn)), 0);
      setStatus({ kind: "reviewing", done: chosen.length - todo.length, total: chosen.length, eta });
      const game = todo[0];
      try {
        const entry = await reviewGame(game, player, dev);
        if (!live()) return;
        await saveGame(player.toLowerCase(), entry);
        setStored((s) => [...s.filter((x) => x.review.game.id !== entry.review.game.id), entry]);
      } catch {
        // A game that can't be read is left out.
      }
      if (live()) setTodo((t) => (t ? t.filter((g) => g !== game) : t));
    })();
    return () => {
      stopped = true;
    };
  }, [player, todo, busy, chosen.length]);

  const theirs = useMemo(() => {
    const ids = new Set(chosen);
    return stored.filter((s) => ids.has(s.review.game.id) && s.version === ANALYSIS_VERSION && s.review.moves.length > 0);
  }, [stored, chosen]);
  const overview: Overview | null = useMemo(
    () => (player && theirs.length ? buildOverview(theirs, player, method) : null),
    [theirs, player],
  );
  return { status, player, theirs, overview, total: chosen.length };
}

/** The player's own side of the comparison: their latest games in the same time control. */
export function ownOverview(stored: StoredGame[], username: string, timeClass: string) {
  const mine = latest(stored, timeClass);
  return { games: mine, overview: mine.length ? buildOverview(mine, username, method) : null };
}
