import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const HOLD_MS = 1200;

/**
 * A button for things that can't be undone: press and hold until the fill reaches the end. Letting
 * go early cancels. Keyboard users hold Enter or Space; an activation with no press at all (a screen
 * reader's) asks for a second one instead.
 */
export function HoldButton({ children, onDone, className }: { children: ReactNode; onDone: () => void; className?: string }) {
  const [state, setState] = useState<"idle" | "holding" | "again">("idle");
  const timer = useRef(0);
  const pressed = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = () => {
    pressed.current = true;
    setState("holding");
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setState("idle");
      onDone();
    }, HOLD_MS);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    // The click that follows a press comes right after this; forget the press once it has passed.
    setTimeout(() => (pressed.current = false));
    setState((s) => (s === "holding" ? "idle" : s));
  };

  return (
    <button
      type="button"
      className={`hold${className ? ` ${className}` : ""}`}
      data-state={state}
      style={{ "--hold": `${HOLD_MS}ms` } as CSSProperties}
      onPointerDown={(e) => e.button === 0 && start()}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === "Enter" || e.key === " ") && cancel()}
      onBlur={() => {
        cancel();
        setState("idle");
      }}
      onClick={() => {
        // Pointer and keyboard presses are handled above; a click with no press is assistive tech.
        if (pressed.current) {
          pressed.current = false;
          return;
        }
        if (state === "again") {
          setState("idle");
          onDone();
        } else setState("again");
      }}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-label">{state === "again" ? "Press again to delete" : children}</span>
    </button>
  );
}
