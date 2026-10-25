// A small UCI client for Stockfish running in a Web Worker (or anything that speaks UCI line by line).
import type { Line } from "./grading";

export interface UciTransport {
  send(command: string): void;
  onLine(handler: (line: string) => void): void;
}

export function workerTransport(worker: Worker): UciTransport {
  return {
    send: (c) => worker.postMessage(c),
    onLine: (h) => {
      worker.onmessage = (e: MessageEvent) => h(String(e.data));
    },
  };
}

/**
 * Anything that reads positions: one engine, or several side by side (pool.ts). A game's searches are split into
 * `lanes`; each lane's searches run in order on one engine, which starts the game cleared, so the same game gets the
 * same answers every time on the same device.
 */
export interface Analyser {
  readonly lanes: number;
  newGame(lane: number): void;
  analyse(fen: string, multipv: number, nodes: number, lane?: number): Promise<Line[]>;
}

/** Serialises searches; each resolves with the final line per MultiPV slot, scores from white's side. */
export class Engine implements Analyser {
  readonly lanes = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((line: string) => void) | null = null;
  readonly ready: Promise<void>;

  constructor(private io: UciTransport) {
    io.onLine((line) => this.listener?.(line));
    this.ready = this.waitFor("uciok", "uci").then(() => this.waitFor("readyok", "isready"));
  }

  private waitFor(token: string, command: string): Promise<void> {
    return new Promise((resolve) => {
      this.listener = (line) => {
        if (line.startsWith(token)) resolve();
      };
      this.io.send(command);
    });
  }

  /** Forgets what earlier games taught the engine. */
  newGame() {
    this.enqueue(async () => {
      await this.ready;
      this.io.send("ucinewgame");
      await this.waitFor("readyok", "isready");
    });
  }

  analyse(fen: string, multipv: number, nodes: number): Promise<Line[]> {
    return this.enqueue(async () => {
      await this.ready;
      const whiteToMove = fen.split(" ")[1] === "w";
      const lines = new Map<number, Line>();
      const done = new Promise<void>((resolve) => {
        this.listener = (line) => {
          if (line.startsWith("bestmove")) return resolve();
          if (!line.startsWith("info") || !line.includes(" pv ")) return;
          const t = line.split(" ");
          const k = Number(t[t.indexOf("multipv") + 1] || 1);
          const s = t.indexOf("score");
          if (s < 0) return;
          const value = Number(t[s + 2]);
          const sign = whiteToMove ? 1 : -1;
          lines.set(k, {
            cp: t[s + 1] === "cp" ? sign * value : null,
            mate: t[s + 1] === "mate" ? sign * value : null,
            pv: t.slice(t.indexOf("pv") + 1),
          });
        };
      });
      this.io.send(`setoption name MultiPV value ${multipv}`);
      this.io.send(`position fen ${fen}`);
      this.io.send(`go nodes ${nodes}`);
      await done;
      return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
    });
  }

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
