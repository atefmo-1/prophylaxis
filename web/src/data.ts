// What the pages read: the current player's analysed games, kept in this browser (see library/Library.tsx).
import { useMemo } from "react";
import { inContext } from "./analysis/stats";
import { useLibrary } from "./library/Library";
import type { GameReview, GameSummary, Overview, PracticePosition } from "./types";

export type Loadable<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

function useReady<T>(pick: (lib: ReturnType<typeof useLibrary>) => T): Loadable<T> {
  const lib = useLibrary();
  return lib.loaded ? { status: "ready", data: pick(lib) } : { status: "loading" };
}

export const useOverview = (): Loadable<Overview> => useReady((lib) => lib.overview);
export const useGames = (): Loadable<GameSummary[]> => useReady((lib) => lib.games);
export const usePractice = (): Loadable<PracticePosition[]> => useReady((lib) => lib.practice);

export function useGame(id: string | null): Loadable<GameReview> {
  const lib = useLibrary();
  return useMemo(() => {
    if (!lib.loaded || id === null) return { status: "loading" };
    const game = lib.stored.find((s) => s.review.game.id === id);
    if (!game) return { status: "error", error: "this game isn't analysed yet" };
    return { status: "ready", data: inContext(game, lib.stored, lib.overview) };
  }, [lib.loaded, lib.stored, lib.overview, id]);
}
