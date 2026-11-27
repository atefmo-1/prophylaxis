// Moves written the way a chess book prints them: a piece symbol instead of its letter (♘f3 for Nf3, e8=♕ for
// e8=Q), known as figurine notation. Only the look changes. The letter stays in the page, hidden from sight, so
// screen readers still say "N f3", copied text is ordinary notation, and the symbol itself is drawn by CSS
// (components/notation.css) with an empty alternative text so it isn't read twice.
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import "./notation.css";

// A piece move (Nf3, Qxe7+, Rae1, N1c3) or a promotion (e8=Q, dxc8=N#), standing alone as a word.
const SAN = /(?<![\w-])(?:([KQRBN])([a-h]?[1-8]?x?[a-h][1-8])|([a-h](?:x[a-h])?[18]=)([QRBN]))([+#]?)(?![\w-])/g;

function Piece({ p }: { p: string }) {
  return (
    <span className="fig" data-p={p}>
      <span className="fig-letter">{p}</span>
    </span>
  );
}

/** One move in figurine notation. */
export function Move({ san }: { san: string }) {
  return <span className="san">{figurines(san)}</span>;
}

function figurines(text: string): ReactNode {
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(SAN)) {
    const start = m.index!;
    if (start > at) out.push(text.slice(at, start));
    out.push(
      m[1] ? (
        <span className="san" key={start}>
          <Piece p={m[1]} />
          {m[2]}
          {m[5]}
        </span>
      ) : (
        <span className="san" key={start}>
          {m[3]}
          <Piece p={m[4]} />
          {m[5]}
        </span>
      ),
    );
    at = start + m[0].length;
  }
  if (!out.length) return text;
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** The moves in this text and its plain elements and fragments (not other components), in figurine notation. */
function convert(node: ReactNode): ReactNode {
  if (typeof node === "string") return figurines(node);
  if (Array.isArray(node)) return Children.map(node, convert);
  if (isValidElement(node) && (typeof node.type === "string" || node.type === Fragment)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (el.props.children === undefined) return el;
    return cloneElement(el, undefined, convert(el.props.children));
  }
  return node;
}

export function Notation({ children }: { children: ReactNode }) {
  return <>{convert(children)}</>;
}
