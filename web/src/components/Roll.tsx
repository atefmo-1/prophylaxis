import type { CSSProperties } from "react";

/**
 * A number whose digits roll like an odometer: from 0 when it first appears (`entrance`), and from
 * the old digit to the new one whenever it changes. The rolling columns are drawn in CSS (see .roll
 * in app.css), so copying the text or reading it aloud gives just the value.
 */
export function Roll({ value, entrance = false }: { value: string | number; entrance?: boolean }) {
  const text = String(value);
  const chars = [...text];
  return (
    <span className={`roll num${entrance ? " roll--in" : ""}`}>
      <span className="visually-hidden">{text}</span>
      <span className="roll-face" aria-hidden="true">
        {chars.map((ch, i) => {
          // Key by place from the right, so the units column stays the same element when 9 becomes 10.
          const key = chars.length - i;
          return /\d/.test(ch) ? (
            <span key={key} className="roll-d" style={{ "--d": Number(ch), "--i": i } as CSSProperties} />
          ) : (
            <span key={`s${key}`} className="roll-s" data-c={ch} />
          );
        })}
      </span>
    </span>
  );
}
