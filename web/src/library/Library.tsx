// The player's library: which chess.com player this browser follows, their analysed games, and the background work
// that finds new games and analyses them with Stockfish, newest first, on as many engines as the device can spare
// (device.ts). Every page reads from here.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildReview, gameFacts, NODES, type ChessComGame, type Frame } from "../analysis/review";
import { loadTacticModel, type TacticModel } from "../analysis/tactics";
import { ANALYSIS_VERSION, gameList, overview as buildOverview, practicePositions, type StoredGame } from "../analysis/stats";
import type { Color, GameSummary, Overview, PracticePosition } from "../types";
import { habitsToExtension, helloExtension, reviewsFromExtension } from "./bridge";
import { fetchGames, findPlayer, gameId } from "./chesscom";
import { getDevice, pliesOf, type Device } from "./device";
import { forget, loadGames, saveGame } from "./store";

const PLAYER_KEY = "prophylaxis.player";
/**
 * The sample player: made-up beginner games played by weak engine settings (scripts/make_sample.py), so anyone can
 * look around without a chess.com account. Their reviews ship with the site, already done.
 */
export const SAMPLE = "sample-player";
const sampleFile = (name: string) => `${import.meta.env.BASE_URL}sample/${name}`;

async function sampleGames(): Promise<ChessComGame[]> {
  const res = await fetch(sampleFile("games.json"));
  if (!res.ok) throw new Error("The sample games are missing.");
  return ((await res.json()).games as ChessComGame[]).sort((a, b) => b.end_time - a.end_time);
}

async function sampleReviews(): Promise<StoredGame[] | null> {
  try {
    const res = await fetch(sampleFile("reviews.json"));
    // A dev server answers a missing file with the page itself, so check it really is JSON.
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    return (await res.json()) as StoredGame[];
  } catch {
    return null;
  }
}
/** The most games analysed per player; how many of them are reviewed depends on the device (BUDGET_MS). */
export const MAX_GAMES = 100;
const MONTHS = 24;
const RECHECK_MS = 2 * 60 * 1000;
// The first visit reviews as many of the newest games as this device gets through in about five minutes, and at
// least the 5 that Habits needs, however slow the device; "Review more" adds the same again. Every game is read at
// the same depth on every device.
const BUDGET_MS = 5 * 60 * 1000;
const MIN_GAMES = 5;
const LOW_BATTERY = 0.2;

const targetKey = (who: string) => `prophylaxis.target.${who.toLowerCase()}`;
const readTarget = (who: string) => {
  try {
    const n = Number(localStorage.getItem(targetKey(who)));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
};
const writeTarget = (who: string, n: number | null) => {
  try {
    if (n) localStorage.setItem(targetKey(who), String(n));
    else localStorage.removeItem(targetKey(who));
  } catch {
    // Without storage, the budget is worked out again next visit.
  }
};

/** How many games from `from` on fit in one budget on this device, and about how long they take; done games are free. */
function fit(games: ChessComGame[], from: number, done: Set<string>, device: Device) {
  let eta = 0;
  let i = from;
  for (; i < games.length; i++) {
    if (done.has(gameId(games[i]))) continue;
    const ms = device.estimate(pliesOf(games[i].pgn));
    if (eta + ms > BUDGET_MS && i - from >= MIN_GAMES) break;
    eta += ms;
  }
  return { games: i - from, eta };
}

export interface Current {
  id: string;
  opponent: string;
  color: Color;
  plies: number;
  percent: number;
  fen: string | null;
  wins: number[]; // white's winning chances, position by position
  eta: number; // ms until this game's review is ready
}

/** Why the reviews are on hold: the player paused them, or the battery is low and not charging. */
export type Paused = null | "you" | "battery";

export type LibraryStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "analysing"; done: number; total: number; current: Current | null; eta: number; paused: Paused }
  | { kind: "error"; message: string };

interface LibraryValue {
  player: string | null;
  loaded: boolean;
  stored: StoredGame[];
  overview: Overview;
  games: GameSummary[];
  practice: PracticePosition[];
  isSample: boolean;
  /** The next games that could be reviewed after these, and about how long they'd take; null when there are none. */
  more: { games: number; eta: number } | null;
  reviewMore: () => void;
  pause: () => void;
  resume: () => void;
  start: (username: string) => Promise<void>;
  startSample: () => void;
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

let tactics: Promise<TacticModel | null> | null = null;
const getTactics = () => (tactics ??= loadTacticModel(import.meta.env.BASE_URL));

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

interface BatteryLike extends EventTarget {
  charging: boolean;
  level: number;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<string | null>(readPlayer);
  const [stored, setStored] = useState<StoredGame[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>({ kind: "idle" });
  const [more, setMore] = useState<LibraryValue["more"]>(null);
  const run = useRef(0); // bumps when the player changes, so a stale analysis loop stops
  const lastCheck = useRef(0);
  const device = useRef<Device | null>(null);
  const paused = useRef<Paused>(null);
  const pauses = useRef(0); // counts pauses, so a game that was paused doesn't teach the speed estimate
  const plan = useRef<{ games: ChessComGame[]; target: number } | null>(null);

  const sync = useCallback(async (who: string, token: number, have: StoredGame[]) => {
    const live = () => run.current === token;
    lastCheck.current = Date.now();
    setStatus({ kind: "checking" });
    let todo: ChessComGame[];
    let dev: Device;
    try {
      // Games the Chrome extension already reviewed come over as they are, instead of being analysed again.
      if (who !== SAMPLE) {
        const known = new Set(have.filter((s) => s.version === ANALYSIS_VERSION).map((s) => s.review.game.id));
        const imported = (await reviewsFromExtension(who)).filter((s) => s.version === ANALYSIS_VERSION && !known.has(s.review.game.id));
        for (const entry of imported) await saveGame(who.toLowerCase(), entry);
        if (imported.length && live()) {
          const ids = new Set(imported.map((s) => s.review.game.id));
          setStored((s) => [...s.filter((x) => !ids.has(x.review.game.id)), ...imported]);
        }
        have = [...have, ...imported];
      }
      const done = new Set(have.filter((s) => s.version === ANALYSIS_VERSION).map((s) => s.review.game.id));
      const ready = getDevice(); // a second's speed check the first time, while chess.com answers
      const all = who === SAMPLE ? await sampleGames() : await fetchGames(who, MONTHS, MAX_GAMES);
      dev = device.current = await ready;
      if (paused.current) dev.pool.pause();
      const games = all.slice(0, MAX_GAMES);
      let target = who === SAMPLE ? games.length : readTarget(who);
      if (target === null) {
        target = fit(games, 0, done, dev).games;
        writeTarget(who, target);
      }
      if (!live()) return;
      plan.current = { games, target };
      todo = games.slice(0, target).filter((g) => !done.has(gameId(g)));
    } catch (e) {
      if (live()) setStatus({ kind: "error", message: (e as Error).message });
      return;
    }
    const plies = todo.map((g) => pliesOf(g.pgn));
    // What's left: the rest of this game, then every game after it.
    const etaFrom = (i: number, percent: number) =>
      dev.estimate(plies[i]) * (1 - percent / 100) + plies.slice(i + 1).reduce((a, p) => a + dev.estimate(p), 0);
    for (let i = 0; i < todo.length && live(); i++) {
      const game = todo[i];
      const color: Color = game.white.username.toLowerCase() === who.toLowerCase() ? "white" : "black";
      const current: Current = { id: gameId(game), opponent: game[color === "white" ? "black" : "white"].username, color, plies: plies[i], percent: 0, fen: null, wins: [], eta: dev.estimate(plies[i]) };
      const show = () => {
        current.eta = dev.estimate(plies[i]) * (1 - current.percent / 100);
        setStatus({ kind: "analysing", done: i, total: todo.length, current: { ...current }, eta: etaFrom(i, current.percent), paused: paused.current });
      };
      show();
      const model = await getTactics();
      const started = performance.now();
      const pausesBefore = pauses.current;
      try {
        const review = await buildReview(game, who, dev.pool, null, (n, total, stage, frame?: Frame) => {
          if (!live()) return;
          if (frame) {
            current.fen = frame.fen;
            current.wins = [...current.wins, frame.win];
          }
          current.plies = stage === "positions" ? total : current.plies;
          current.percent = Math.round(stage === "positions" ? (n / total) * 85 : 85 + (n / total) * 15);
          show();
        }, model);
        if (pauses.current === pausesBefore && !paused.current) dev.learn(plies[i], performance.now() - started);
        const entry: StoredGame = { review, facts: gameFacts(game, who), version: ANALYSIS_VERSION };
        if (!live()) return;
        await saveGame(who.toLowerCase(), entry);
        setStored((s) => [...s.filter((x) => x.review.game.id !== review.game.id), entry]);
      } catch {
        // A game the analysis can't read (a broken PGN, a variant that slipped through) is skipped; so is one
        // stopped because the player changed.
      }
    }
    if (!live()) return;
    const p = plan.current;
    const doneNow = new Set([...have.map((s) => s.review.game.id), ...todo.map(gameId)]);
    const next = p && p.target < p.games.length ? fit(p.games, p.target, doneNow, dev) : null;
    setMore(next && next.games > 0 ? next : null);
    setStatus({ kind: "idle" });
  }, []);

  const setPaused = useCallback((reason: Paused) => {
    if (paused.current === reason) return;
    paused.current = reason;
    if (reason) pauses.current++;
    if (reason) device.current?.pool.pause();
    else device.current?.pool.resume();
    setStatus((s) => (s.kind === "analysing" ? { ...s, paused: reason } : s));
  }, []);
  const pause = useCallback(() => setPaused("you"), [setPaused]);
  const resume = useCallback(() => setPaused(null), [setPaused]);

  // A phone or laptop running low, and not charging, waits until it's charging again.
  useEffect(() => {
    let battery: BatteryLike | null = null;
    const check = () => {
      if (!battery) return;
      const low = !battery.charging && battery.level <= LOW_BATTERY;
      if (low && paused.current === null) setPaused("battery");
      else if (!low && paused.current === "battery") setPaused(null);
    };
    (navigator as Navigator & { getBattery?: () => Promise<BatteryLike> })
      .getBattery?.()
      .then((b) => {
        battery = b;
        check();
        b.addEventListener("chargingchange", check);
        b.addEventListener("levelchange", check);
      })
      .catch(() => undefined);
    return () => {
      battery?.removeEventListener("chargingchange", check);
      battery?.removeEventListener("levelchange", check);
    };
  }, [setPaused]);

  // Load the player's saved games, then look for new ones.
  useEffect(() => {
    const token = ++run.current;
    device.current?.pool.cancel(); // the last player's searches that haven't started
    if (paused.current === "you") setPaused(null);
    plan.current = null;
    setMore(null);
    setLoaded(false);
    setStored([]);
    setStatus({ kind: "idle" });
    if (!player) return;
    const fromBrowser = () =>
      loadGames(player.toLowerCase())
        .catch(() => [] as StoredGame[])
        .then((have) => {
          if (run.current !== token) return;
          setStored(have);
          setLoaded(true);
          sync(player, token, have);
        });
    if (player !== SAMPLE) {
      fromBrowser();
      return;
    }
    // The sample is already reviewed: show it at once. (Without reviews.json it is reviewed like any player, which
    // is how that file gets made.)
    sampleReviews().then((reviews) => {
      if (run.current !== token) return;
      if (!reviews) return void fromBrowser();
      setStored(reviews);
      setLoaded(true);
    });
  }, [player, sync, setPaused]);

  // Coming back to the tab after a while: check chess.com for games played since.
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !player || player === SAMPLE || !loaded) return;
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

  // Another budget's worth of older games, once the current ones are done.
  const reviewMore = useCallback(() => {
    const p = plan.current;
    if (!player || !p || !more || statusRef.current.kind !== "idle") return;
    writeTarget(player, p.target + more.games);
    setMore(null);
    sync(player, run.current, storedRef.current);
  }, [player, more, sync]);

  const startSample = useCallback(() => {
    writePlayer(SAMPLE);
    setPlayer(SAMPLE);
  }, []);

  const leave = useCallback(() => {
    writePlayer(null);
    setPlayer(null);
  }, []);

  const forgetPlayer = useCallback(async () => {
    if (!player) return;
    run.current++;
    device.current?.pool.cancel();
    writeTarget(player, null);
    await forget(player.toLowerCase());
    writePlayer(null);
    setPlayer(null);
  }, [player]);

  // `status` changes many times a second while a game is analysed; the statistics only change with `stored`.
  const derived = useMemo(() => {
    const method = { engine: "Stockfish 19 Lite", nodes: NODES, analysis_version: ANALYSIS_VERSION };
    return { overview: buildOverview(stored, player ?? "", method), games: gameList(stored), practice: practicePositions(stored) };
  }, [stored, player]);

  // Tell the extension, if it's installed, which player this is and their habits, for its own reviews.
  useEffect(() => {
    if (!player || player === SAMPLE) return;
    helloExtension(player);
  }, [player]);
  useEffect(() => {
    if (!player || player === SAMPLE || derived.overview.empty || !derived.overview.weaknesses.length) return;
    habitsToExtension(player, derived.overview.weaknesses);
  }, [player, derived.overview]);

  const value = useMemo<LibraryValue>(
    () => ({ player, loaded, stored, ...derived, isSample: player === SAMPLE, more, reviewMore, pause, resume, start, startSample, leave, forgetPlayer }),
    [player, loaded, stored, derived, more, reviewMore, pause, resume, start, startSample, leave, forgetPlayer],
  );

  return (
    <LibraryContext.Provider value={value}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </LibraryContext.Provider>
  );
}
