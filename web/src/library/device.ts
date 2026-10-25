// How much analysis this device can take: how many engines to run side by side, and how long one move of a game
// takes to read with all of them. Measured once with a short search, then corrected by every game reviewed. A slow
// device reviews fewer games at the same depth, never shallower reviews.
import { Engine, workerTransport } from "../analysis/engine";
import { EnginePool } from "../analysis/pool";
import { NODES } from "../analysis/review";

const KEY = "prophylaxis.device";
const MAX_AGE = 7 * 24 * 3600 * 1000;
const PROBE_NODES = 300_000;
const PROBE_FEN = "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8"; // a quiet middlegame
// Besides one search per position, a game needs a few more for its mistakes, and the last searches of a game leave
// some engines idle.
const OVERHEAD = 1.15;

export interface DeviceProfile {
  engines: number;
  ms_per_ply: number; // how long one move of a game takes to review, all engines together
  measured_at: number;
}

interface NavigatorExtras {
  deviceMemory?: number; // GB, Chrome only
  userAgentData?: { mobile?: boolean };
}

/** Engines to run side by side: one per core, keeping one for the page, at most 6; fewer on phones and small devices. */
export function engineCount(): number {
  const nav = navigator as Navigator & NavigatorExtras;
  const cores = nav.hardwareConcurrency || 2;
  const mobile = nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  let n = Math.min(Math.max(cores - 1, 1), 6);
  if (mobile) n = Math.min(n, 2);
  if (nav.deviceMemory !== undefined) n = Math.min(n, nav.deviceMemory <= 2 ? 1 : nav.deviceMemory <= 4 ? 2 : n);
  return n;
}

const newEngine = () => new Engine(workerTransport(new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`)));

function readProfile(): DeviceProfile | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as DeviceProfile | null;
  } catch {
    return null;
  }
}

function writeProfile(profile: DeviceProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Without storage the speed check simply runs again next visit.
  }
}

/** A second or two of searching on every engine at once: how many positions a second the device reads in total. */
async function measure(pool: EnginePool): Promise<number> {
  const all = (nodes: number) => Promise.all(pool.engines.map((_, lane) => pool.analyse(PROBE_FEN, 2, nodes, lane)));
  await all(20_000); // loads the network into every engine
  const t0 = performance.now();
  await all(PROBE_NODES);
  return (pool.size * PROBE_NODES) / ((performance.now() - t0) / 1000);
}

export interface Device {
  pool: EnginePool;
  profile: DeviceProfile;
  /** Estimated time to review a game of this many moves (plies). */
  estimate: (plies: number) => number;
  /** What a reviewed game actually took, to sharpen the estimates. */
  learn: (plies: number, ms: number) => void;
}

let device: Promise<Device> | null = null;

export function getDevice(): Promise<Device> {
  return (device ??= (async () => {
    const pool = new EnginePool(Array.from({ length: engineCount() }, newEngine));
    let profile = readProfile();
    if (!profile || profile.engines !== pool.size || !(profile.ms_per_ply > 0) || Date.now() - profile.measured_at > MAX_AGE) {
      const nps = await measure(pool);
      profile = { engines: pool.size, ms_per_ply: (NODES / nps) * 1000 * OVERHEAD, measured_at: Date.now() };
      writeProfile(profile);
    }
    const current = profile;
    return {
      pool,
      profile: current,
      estimate: (plies) => Math.max(plies, 1) * current.ms_per_ply,
      learn: (plies, ms) => {
        if (plies < 10) return; // too short to say much
        // A stored speed that's far off (measured while the machine was busy, say) is replaced quickly.
        const seen = ms / plies;
        const ratio = seen / current.ms_per_ply;
        const weight = ratio > 2 || ratio < 0.5 ? 0.8 : 0.4;
        current.ms_per_ply = (1 - weight) * current.ms_per_ply + weight * seen;
        writeProfile(current);
      },
    };
  })());
}

// Chrome slows down a page in a background tab, so a game reviewed while the tab was hidden says nothing about speed.
let hiddenTimes = 0;
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => void (document.hidden && hiddenTimes++));
/** Call before a game; the returned check says whether the page stayed in view all through it. */
export function inView(): () => boolean {
  const before = document.hidden ? -1 : hiddenTimes;
  return () => hiddenTimes === before;
}

/** Moves (plies) in a PGN, without reading it properly: enough for estimates. */
export function pliesOf(pgn: string): number {
  return pgn
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).length;
}
