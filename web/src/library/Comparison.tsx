// The comparison in progress, kept above the pages: it carries on while the player looks at other pages, and the
// Compare link in the top bar comes back to it.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useComparison } from "./compare";
import { useLibrary } from "./Library";

type ComparisonValue = ReturnType<typeof useComparison> & {
  /** Who is being compared (as typed or linked), or null. */
  target: string | null;
  setTarget: (name: string | null) => void;
};

const ComparisonContext = createContext<ComparisonValue | null>(null);

export function useCurrentComparison(): ComparisonValue {
  const value = useContext(ComparisonContext);
  if (!value) throw new Error("useCurrentComparison outside <ComparisonProvider>");
  return value;
}

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const lib = useLibrary();
  // A comparison belongs to the library player who asked for it: switching or leaving the player drops it in the
  // same render, so it never runs with the next player's settings.
  const [asked, setAsked] = useState<{ name: string; owner: string } | null>(null);
  const target = asked && lib.player && asked.owner === lib.player ? asked.name : null;
  const setTarget = useCallback((name: string | null) => setAsked(name && lib.player ? { name, owner: lib.player } : null), [lib.player]);
  const tc = lib.overview.empty ? null : lib.overview.player.rating_time_class;
  const comparison = useComparison(target, tc, lib.isSample, lib.player);
  return <ComparisonContext.Provider value={{ ...comparison, target, setTarget }}>{children}</ComparisonContext.Provider>;
}
