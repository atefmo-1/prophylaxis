import type { HTMLAttributes } from "react";
import { usePill } from "../lib/motion";

/** A segmented-control group with a sliding pill under the selected button. */
export function PillGroup(props: HTMLAttributes<HTMLDivElement>) {
  const pill = usePill<HTMLDivElement>();
  return <div ref={pill} {...props} />;
}
