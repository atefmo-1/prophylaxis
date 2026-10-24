import { useEffect, useState } from "react";
import type { GameReview, GameSummary, Overview, PracticePosition } from "./types";

// Relative to the page, so the built site works from any sub-path (e.g. GitHub Pages).
const BASE = `${import.meta.env.BASE_URL}data`;
const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let request = cache.get(path);
  if (!request) {
    // "no-cache" still uses the browser's copy, but checks with the server first (a cheap 304 when unchanged), so a
    // new deploy shows up straight away instead of after the host's cache lifetime (10 minutes on GitHub Pages).
    request = fetch(`${BASE}/${path}`, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`${response.status} loading ${path}`);
      return response.json();
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request as Promise<T>;
}

export type Loadable<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

function useLoad<T>(path: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setState({ status: "loading" });
    load<T>(path).then(
      (data) => live && setState({ status: "ready", data }),
      (error: Error) => live && setState({ status: "error", error: error.message }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

export const useOverview = () => useLoad<Overview>("overview.json");
export const useGames = () => useLoad<GameSummary[]>("games.json");
export const usePractice = () => useLoad<PracticePosition[]>("practice.json");
export const useGame = (id: string | null) => useLoad<GameReview>(id ? `games/${id}.json` : null);
