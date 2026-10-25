// Who each player in this browser has compared themselves with, so deleting a player's data deletes the reviews of
// the players they compared with too, and nobody else's.
import { forget } from "./store";

const PREFIX = "prophylaxis.compared.";
const keyOf = (owner: string) => PREFIX + owner.toLowerCase();

function read(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export const comparedPlayers = (owner: string) => read(keyOf(owner));

export function remember(owner: string, player: string) {
  try {
    localStorage.setItem(keyOf(owner), JSON.stringify([...new Set([...comparedPlayers(owner), player.toLowerCase()])]));
  } catch {
    // Without storage, their reviews simply aren't deleted with the player's.
  }
}

/** Whether someone else in this browser still needs a compared player's reviews. */
function stillUsed(name: string, owner: string): boolean {
  try {
    if (localStorage.getItem(`prophylaxis.target.${name}`) !== null) return true; // their own library is here
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && key !== keyOf(owner) && read(key).includes(name)) return true;
    }
  } catch {
    return true; // can't tell, so keep them
  }
  return false;
}

export async function forgetCompared(owner: string) {
  for (const name of comparedPlayers(owner)) {
    if (name !== owner.toLowerCase() && !stillUsed(name, owner)) await forget(name).catch(() => undefined);
  }
  try {
    localStorage.removeItem(keyOf(owner));
  } catch {
    // nothing to remove
  }
}
