// Several Stockfish workers reading one game together, so its positions are read in parallel on every core the
// device can spare. Each lane is one engine: its searches run one at a time, in the order they're asked for, so a game
// gets the same answers every time on the same device, and pausing or cancelling takes effect after the current search.
import type { Analyser, Engine } from "./engine";
import type { Line } from "./grading";

export class Cancelled extends Error {
  constructor() {
    super("The analysis was stopped.");
  }
}

export class EnginePool implements Analyser {
  private gate: Promise<void> = Promise.resolve();
  private open: (() => void) | null = null;
  private generation = 0;
  private chains: Promise<unknown>[];

  constructor(readonly engines: Engine[]) {
    this.chains = engines.map(() => Promise.resolve());
  }

  get lanes() {
    return this.engines.length;
  }

  get size() {
    return this.engines.length;
  }

  get paused() {
    return this.open !== null;
  }

  /** How many times the pool has been paused: compare before and after some work to know it ran straight through. */
  pauses = 0;

  newGame(lane: number) {
    this.engines[lane % this.lanes].newGame();
  }

  analyse(fen: string, multipv: number, nodes: number, lane = 0): Promise<Line[]> {
    const i = lane % this.lanes;
    const generation = this.generation;
    const run = async () => {
      await this.gate;
      if (generation !== this.generation) throw new Cancelled();
      return this.engines[i].analyse(fen, multipv, nodes);
    };
    const result = this.chains[i].then(run, run);
    this.chains[i] = result.catch(() => undefined);
    return result;
  }

  /** Searches already running finish; nothing new starts until resume(). */
  pause() {
    if (this.open) return;
    this.pauses++;
    this.gate = new Promise((resolve) => (this.open = resolve));
  }

  resume() {
    this.open?.();
    this.open = null;
  }

  /** Searches that haven't started fail with Cancelled, e.g. when the player changes. */
  cancel() {
    this.generation++;
  }
}
