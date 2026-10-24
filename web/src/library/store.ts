// The player's analysed games, kept in this browser's IndexedDB. Nothing is sent anywhere: the site has no server.
import type { ChessComGame } from "../analysis/review";
import type { StoredGame } from "../analysis/stats";

const DB = "prophylaxis";
const GAMES = "games"; // key `${player}/${gameId}`, value { player, id, stored }
const MONTHS = "months"; // key `${player}/${archiveUrl}`, value { player, url, games, fetched }

export interface MonthRecord {
  player: string;
  url: string;
  games: ChessComGame[];
  fetched: number;
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(GAMES).createIndex("player", "player");
      db.createObjectStore(MONTHS).createIndex("player", "player");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const byPlayer = <T>(store: string, player: string) =>
  run<{ [k: string]: unknown }[]>(store, "readonly", (s) => s.index("player").getAll(player)) as Promise<T[]>;

export const loadGames = (player: string) => byPlayer<{ stored: StoredGame }>(GAMES, player).then((rows) => rows.map((r) => r.stored));

export const saveGame = (player: string, stored: StoredGame) =>
  run(GAMES, "readwrite", (s) => s.put({ player, id: stored.review.game.id, stored }, `${player}/${stored.review.game.id}`));

export const loadMonths = (player: string) => byPlayer<MonthRecord>(MONTHS, player);

export const saveMonth = (month: MonthRecord) => run(MONTHS, "readwrite", (s) => s.put(month, `${month.player}/${month.url}`));

/** Remove everything this browser keeps about a player. */
export async function forget(player: string): Promise<void> {
  for (const store of [GAMES, MONTHS]) {
    const keys = await run<IDBValidKey[]>(store, "readonly", (s) => s.index("player").getAllKeys(player));
    await run(store, "readwrite", (s) => {
      for (const k of keys) s.delete(k);
    });
  }
}
