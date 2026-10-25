// Who this browser has compared the player against, so deleting the player's data deletes theirs too.
import { forget } from "./store";

const KEY = "prophylaxis.compared";

export function comparedPlayers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function remember(player: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...comparedPlayers(), player.toLowerCase()])]));
  } catch {
    // Without storage, their reviews simply aren't deleted with the player's.
  }
}

export async function forgetCompared() {
  for (const p of comparedPlayers()) await forget(p).catch(() => undefined);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to remove
  }
}
