// The player's library: which chess.com player this browser follows, their analysed games, and the background work
// that finds new games and analyses them with Stockfish in a Web Worker, newest first. Every page reads from here.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Engine, workerTransport } from "../analysis/engine";
import { buildReview, gameFacts, NODES, type ChessComGame, type Frame } from "../analysis/review";
import { ANALYSIS_VERSION, gameList, overview as buildOverview, practicePositions, type StoredGame } from "../analysis/stats";
import type { Color, GameSummary, Overview, PracticePosition } from "../types";
import { fetchGames, findPlayer, gameId } from "./chesscom";
import { forget, loadGames, saveGame } from "./store";

const PLAYER_KEY = "prophylaxis.player";
/** The most recent games analysed per player; enough for habits, and about 40 minutes of work the first time. */
export const MAX_GAMES = 100;
const MONTHS = 24;
const RECHECK_MS = 2 * 60 * 1000;

export interface Current {
  id: string;
  opponent: string;
  color: Color;
  plies: number;
  percent: number;
  fen: string | null;
  wins: number[]; // white's winning chances, position by position
}

export type LibraryStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "analysing"; done: number; total: number; current: Current | null }
  | { kind: "error"; message: string };

interface LibraryValue {
  player: string | null;
  loaded: boolean;
  stored: StoredGame[];
  overview: Overview;
  games: GameSummary[];
  practice: PracticePosition[];
  start: (username: string) => Promise<void>;
  leave: () => void;
  forgetPlayer: () => Promise<void>;
}

// Two contexts: the data changes once per analysed game, the status many times a second while one is analysed,
// so pages that only show data don't re-render with every engine position.
const LibraryContext = createContext<LibraryValue | null>(null);
const StatusContext = createContext<LibraryStatus>({ kind: "idle" });

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary outside <LibraryProvider>");
  return value;
}

export const useLibraryStatus = () => useContext(StatusContext);

let engine: Engine | null = null;
const getEngine = () =>
  (engine ??= new Engine(workerTransport(new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`))));

const readPlayer = () => {
  try {
    return localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
};
const writePlayer = (player: string | null) => {
  try {
    if (player) localStorage.setItem(PLAYER_KEY, player);
    else localStorage.removeItem(PLAYER_KEY);
  } catch {
    // Private windows can refuse storage; the player is then asked again next visit.
  }
};

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<string | null>(readPlayer);
  const [stored, setStored] = useState<StoredGame[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>({ kind: "idle" });
  const run = useRef(0); // bumps when the player changes, so a stale analysis loop stops
  const lastCheck = useRef(0);

  const sync = useCallback(async (who: string, token: number, have: StoredGame[]) => {
    const live = () => run.current === token;
    lastCheck.current = Date.now();
    setStatus({ kind: "checking" });
    let todo: ChessComGame[];
    try {
      const done = new Set(have.filter((s) => s.version === ANALYSIS_VERSION).map((s) => s.review.game.id));
      todo = (await fetchGames(who, MONTHS, MAX_GAMES)).slice(0, MAX_GAMES).filter((g) => !done.has(gameId(g)));
    } catch (e) {
      if (live()) setStatus({ kind: "error", message: (e as Error).message });
      return;
    }
    for (let i = 0; i < todo.length && live(); i++) {
      const game = todo[i];
      const color: Color = game.white.username.toLowerCase() === who.toLowerCase() ? "white" : "black";
      const current: Current = { id: gameId(game), opponent: game[color === "white" ? "black" : "white"].username, color, plies: 0, percent: 0, fen: null, wins: [] };
      setStatus({ kind: "analysing", done: i, total: todo.length, current });
      try {
        const review = await buildReview(game, who, getEngine(), null, (n, total, stage, frame?: Frame) => {
          if (!live()) return;
          if (frame) {
            current.fen = frame.fen;
            current.wins = [...current.wins, frame.win];
          }
          current.plies = stage === "positions" ? total : current.plies;
          current.percent = Math.round(stage === "positions" ? (n / total) * 85 : 85 + (n / total) * 15);
          setStatus({ kind: "analysing", done: i, total: todo.length, current: { ...current } });
        });
        const entry: StoredGame = { review, facts: gameFacts(game, who), version: ANALYSIS_VERSION };
        if (!live()) return;
        await saveGame(who.toLowerCase(), entry);
        setStored((s) => [...s.filter((x) => x.review.game.id !== review.game.id), entry]);
      } catch {
        // A game the analysis can't read (a broken PGN, a variant that slipped through) is skipped.
      }
    }
    if (live()) setStatus({ kind: "idle" });
  }, []);

  // Load the player's saved games, then look for new ones.
  useEffect(() => {
    const token = ++run.current;
    setLoaded(false);
    setStored([]);
    setStatus({ kind: "idle" });
    if (!player) return;
    loadGames(player.toLowerCase()).then(
      (have) => {
        if (run.current !== token) return;
        setStored(have);
        setLoaded(true);
        sync(player, token, have);
      },
      () => {
        if (run.current !== token) return;
        setLoaded(true);
        sync(player, token, []);
      },
    );
  }, [player, sync]);

  // Coming back to the tab after a while: check chess.com for games played since.
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !player || !loaded) return;
      if (statusRef.current.kind === "analysing" || statusRef.current.kind === "checking") return;
      if (Date.now() - lastCheck.current < RECHECK_MS) return;
      sync(player, run.current, storedRef.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [player, loaded, sync]);

  const start = useCallback(async (username: string) => {
    const name = await findPlayer(username);
    writePlayer(name);
    setPlayer(name);
  }, []);

  const leave = useCallback(() => {
    writePlayer(null);
    setPlayer(null);
  }, []);

  const forgetPlayer = useCallback(async () => {
    if (!player) return;
    run.current++;
    await forget(player.toLowerCase());
    writePlayer(null);
    setPlayer(null);
  }, [player]);

  // `status` changes many times a second while a game is analysed; the statistics only change with `stored`.
  const derived = useMemo(() => {
    const method = { engine: "Stockfish 19 Lite", nodes: NODES, analysis_version: ANALYSIS_VERSION };
    return { overview: buildOverview(stored, player ?? "", method), games: gameList(stored), practice: practicePositions(stored) };
  }, [stored, player]);

  const value = useMemo<LibraryValue>(
    () => ({ player, loaded, stored, ...derived, start, leave, forgetPlayer }),
    [player, loaded, stored, derived, start, leave, forgetPlayer],
  );

  return (
    <LibraryContext.Provider value={value}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </LibraryContext.Provider>
  );
}
