// A segmented control: one choice out of a few ("All / Wins / Losses", "Auto / Light / Dark"), with the sliding pill
// under the chosen one (lib/motion.ts). Radix's ToggleGroup gives it the keyboard behaviour people expect: Tab reaches
// the group once, the arrow keys move between choices, and Space or Enter picks one.
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";
import { usePill } from "../lib/motion";

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  value,
  onChange,
  choices,
  label,
  className = "seg",
}: {
  value: T;
  onChange: (value: T) => void;
  choices: Choice<T>[];
  label: string;
  className?: string;
}) {
  const pill = usePill<HTMLDivElement>();
  return (
    <ToggleGroup.Root
      ref={pill}
      type="single"
      className={className}
      aria-label={label}
      value={value}
      // Picking the chosen one again would clear it; a segmented control always has one choice.
      onValueChange={(v) => v && onChange(v as T)}
    >
      {choices.map((c) => (
        <ToggleGroup.Item key={c.value} value={c.value} disabled={c.disabled}>
          {c.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
