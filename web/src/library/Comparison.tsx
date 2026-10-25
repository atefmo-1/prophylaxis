// The comparison in progress, kept above the pages: it carries on while the player looks at other pages, and the
// Compare link in the top bar comes back to it.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const [target, setTarget] = useState<string | null>(null);
  // A different player in the library starts with no comparison (only on a change: on the first render the page may
  // already have asked for one).
  const shownFor = useRef(lib.player);
  useEffect(() => {
    if (shownFor.current === lib.player) return;
    shownFor.current = lib.player;
    setTarget(null);
  }, [lib.player]);
  const tc = lib.overview.empty ? null : lib.overview.player.rating_time_class;
  const comparison = useComparison(target, tc, lib.isSample);
  return <ComparisonContext.Provider value={{ ...comparison, target, setTarget }}>{children}</ComparisonContext.Provider>;
}
