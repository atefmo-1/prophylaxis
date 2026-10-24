// Talking to the Prophylaxis Chrome extension, when it's installed: its bridge script on this page
// (extension/public/site-bridge.js) passes messages both ways. Without the extension, every question quietly
// answers null after a short wait, and the site works as before.
import type { StoredGame } from "../analysis/stats";
import type { Weakness } from "../types";

const SITE = "prophylaxis-site";
const EXTENSION = "prophylaxis-extension";
let counter = 0;

function ask<T>(type: string, payload: object, timeout: number): Promise<T | null> {
  return new Promise((resolve) => {
    const id = `${Date.now()}-${counter++}`;
    const finish = (value: T | null) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(value);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source === window && e.data?.source === EXTENSION && e.data.id === id) finish((e.data.reply ?? null) as T | null);
    };
    const timer = setTimeout(() => finish(null), timeout);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: SITE, id, type, payload }, window.location.origin);
  });
}

export interface Hello {
  username: string | null;
  version: number;
}

/** Whether the extension is here, and who it knows; tells it which player the site shows. */
export const helloExtension = (player: string | null) => ask<Hello>("hello", { player }, 800);

/** Reviews the extension made for this player, in the site's format. */
export async function reviewsFromExtension(player: string): Promise<StoredGame[]> {
  if (!(await helloExtension(player))) return [];
  return (await ask<StoredGame[]>("reviews", { player }, 5000)) ?? [];
}

/** The player's habits, so the extension's reviews can say which habit a mistake belongs to. */
export const habitsToExtension = (player: string, weaknesses: Weakness[]) =>
  ask("habits", { player, habits: weaknesses.map((w) => ({ tag: w.tag, windows: w.windows })) }, 1500);
