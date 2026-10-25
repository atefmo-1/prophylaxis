// Light / dark / follow-the-system, remembered in this browser. index.html applies it before first paint.
import { useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "coach.theme";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
  // The browser's own bar follows the chosen theme too, not just the system's.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const light = meta.media.includes("light");
    meta.content = choice === "auto" ? (light ? "#f3f3f1" : "#161718") : choice === "light" ? "#f3f3f1" : "#161718";
  }
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  const set = (next: ThemeChoice) => {
    apply(next);
    setChoice(next);
  };
  return [choice, set] as const;
}
