import { useEffect, useState } from "react";

// Hash routes keep the site working on any static host without rewrite rules.
//   #/                 latest game
//   #/game/<id>/<ply>  a game, optionally at a move
//   #/patterns         weaknesses across games
//   #/games            every game
export type Route =
  | { name: "latest" }
  | { name: "game"; id: string; ply: number | null }
  | { name: "patterns" }
  | { name: "games" }
  | { name: "practice"; tag: string | null };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "game" && parts[1]) {
    const ply = parts[2] !== undefined ? Number.parseInt(parts[2], 10) : NaN;
    return { name: "game", id: parts[1], ply: Number.isFinite(ply) ? ply : null };
  }
  if (parts[0] === "patterns") return { name: "patterns" };
  if (parts[0] === "games") return { name: "games" };
  if (parts[0] === "practice") return { name: "practice", tag: parts[1] ?? null };
  return { name: "latest" };
}

// Where links point. Empty on the site itself; the extension's side panel sets the site's address.
let linkBase = "";
export const setLinkBase = (base: string) => {
  linkBase = base;
};

export function href(route: Route): string {
  return linkBase + hashOf(route);
}

function hashOf(route: Route): string {
  switch (route.name) {
    case "game":
      return `#/game/${route.id}${route.ply !== null ? `/${route.ply}` : ""}`;
    case "patterns":
      return "#/patterns";
    case "games":
      return "#/games";
    case "practice":
      return `#/practice${route.tag ? `/${route.tag}` : ""}`;
    default:
      return "#/";
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Update the ply in the URL without adding a history entry for every arrow-key press. */
export function replacePly(id: string, ply: number) {
  const next = hashOf({ name: "game", id, ply });
  if (window.location.hash !== next) window.history.replaceState(null, "", next);
}
