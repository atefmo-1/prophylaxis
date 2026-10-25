// Comparing the player with another chess.com player: that player's latest games in the same time control,
// reviewed in this browser exactly like the player's own (and kept under their name, so the next comparison is
// instant), then the same statistics for both.
import { useEffect, useMemo, useRef, useState } from "react";
import { NODES, type ChessComGame } from "../analysis/review";
import { ANALYSIS_VERSION, overview as buildOverview, type StoredGame } from "../analysis/stats";
import type { Overview } from "../types";
import { fetchGames, findPlayer, gameId } from "./chesscom";
import { getDevice, inView, pliesOf } from "./device";
import { useLibraryStatus } from "./Library";
import { reviewGame } from "./reviewer";
import { remember } from "./compared";
import { loadGames, saveGame } from "./store";

/** Games compared on each side: enough for the ranges to separate real differences, about 2–3 minutes on a laptop. */
export const COMPARE_GAMES = 30;
/**
 * The made-up player the sample player compares with (scripts/make_sample.py --rival). Their games and reviews ship
 * with the site, like the sample player's, so anyone can try Compare without an account.
 */
export const SAMPLE_RIVAL = "sample-rival";
const sampleFile = (name: string) => `${import.meta.env.BASE_URL}sample/${name}`;

async function rivalGames(): Promise<ChessComGame[]> {
  const res = await fetch(sampleFile("rival-games.json"));
  if (!res.ok) throw new Error("The sample rival's games are missing.");
  return ((await res.json()).games as ChessComGame[]).sort((a, b) => b.end_time - a.end_time);
}

async function rivalReviews(): Promise<StoredGame[]> {
  try {
    const res = await fetch(sampleFile("rival-reviews.json"));
    // A dev server answers a missing file with the page itself, so check it really is JSON.
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return [];
    return (await res.json()) as StoredGame[];
  } catch {
    return [];
  }
}

/** Results appear once this many of their games are reviewed. */
export const COMPARE_MIN = 10;
const MONTHS = 12;

export type CompareStatus =
  | { kind: "idle" }
  | { kind: "loading"; step: string }
  | { kind: "waiting" } // the player's own games are reviewed first
  | { kind: "reviewing"; done: number; total: number; eta: number | null } // no estimate until a game is timed
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

export function useComparison(name: string | null, timeClass: string | null, sample = false) {
  const own = useLibraryStatus();
  const busy = own.kind === "analysing" || own.kind === "checking";
  const [status, setStatus] = useState<CompareStatus>({ kind: "idle" });
  const [player, setPlayer] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredGame[]>([]);
  const [todo, setTodo] = useState<ChessComGame[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const run = useRef(0);
  const pace = useRef({ ms: 0, plies: 0 }); // what this comparison's games actually took, for the time left

  // Who they are, what's already reviewed, and which of their games to review.
  useEffect(() => {
    const token = ++run.current;
    const live = () => run.current === token;
    setPlayer(null);
    setStored([]);
    setTodo(null);
    setChosen([]);
    pace.current = { ms: 0, plies: 0 };
    if (!name || !timeClass) return void setStatus({ kind: "idle" });
    const rival = sample && name.toLowerCase() === SAMPLE_RIVAL;
    (async () => {
      setStatus({ kind: "loading", step: rival ? "Loading the sample rival…" : "Finding the player on chess.com…" });
      const who = rival ? SAMPLE_RIVAL : await findPlayer(name);
      if (!live()) return;
      setPlayer(who);
      if (!rival) remember(who);
      const shipped = rival ? await rivalReviews() : [];
      const have = [...shipped, ...(await loadGames(who.toLowerCase()).catch(() => [] as StoredGame[]))];
      if (!live()) return;
      setStored(have);
      setStatus({ kind: "loading", step: `Loading ${who}'s games…` });
      const games = (rival ? await rivalGames() : await fetchGames(who, MONTHS, 300))
        .filter((g) => g.time_class === timeClass && (g as ChessComGame & { rated?: boolean }).rated !== false)
        .slice(0, COMPARE_GAMES);
      if (!live()) return;
      const done = new Set(have.filter((s) => s.version === ANALYSIS_VERSION).map((s) => s.review.game.id));
      setChosen(games.map(gameId));
      setTodo(games.filter((g) => !done.has(gameId(g))));
      if (!games.length) setStatus({ kind: "error", message: `${who} has no rated ${timeClass} games in the last year.` });
    })().catch((e: Error) => live() && setStatus({ kind: "error", message: e.message }));
  }, [name, timeClass, sample]);

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
      // The time left, from what this comparison's games took: the device's stored speed can be stale (measured while
      // the machine was busy), and the first game takes only seconds on a laptop.
      const { ms, plies: seen } = pace.current;
      const eta = seen ? todo.reduce((a, g) => a + Math.max(pliesOf(g.pgn), 1) * (ms / seen), 0) : null;
      setStatus({ kind: "reviewing", done: chosen.length - todo.length, total: chosen.length, eta });
      const game = todo[0];
      try {
        const plies = pliesOf(game.pgn);
        const stayedInView = inView();
        const started = performance.now();
        const entry = await reviewGame(game, player, dev);
        if (!live()) return;
        if (stayedInView()) {
          const took = performance.now() - started;
          pace.current = { ms: pace.current.ms + took, plies: pace.current.plies + plies };
          dev.learn(plies, took);
        }
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
