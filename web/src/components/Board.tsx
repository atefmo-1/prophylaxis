import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { useEffect, useRef } from "react";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";
import type { MoveClass } from "../types";
import { ClassIcon } from "./ClassIcon";

export interface Arrow {
  uci: string;
  brush: "best" | "played" | "threat" | "bestTarget" | "threatTarget";
}

export interface Movable {
  color: "white" | "black";
  dests: Map<Key, Key[]>;
  onMove: (orig: string, dest: string) => void;
}

interface Props {
  fen: string;
  orientation: "white" | "black";
  lastMove?: string | null;
  check?: boolean;
  arrows?: Arrow[];
  badge?: { square: string; cls: MoveClass } | null;
  movable?: Movable | null;
  label: string;
  coordinates?: boolean;
}

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];

// Chessground draws arrows as SVG attributes, which can't read CSS variables.
const BRUSHES = {
  best: { key: "best", color: "#629924", opacity: 0.85, lineWidth: 11 },
  played: { key: "played", color: "#3b78c7", opacity: 0.8, lineWidth: 11 },
  threat: { key: "threat", color: "#d43b32", opacity: 0.8, lineWidth: 11 },
  // What a move attacks: thinner and fainter than the move itself.
  bestTarget: { key: "bestTarget", color: "#629924", opacity: 0.5, lineWidth: 6 },
  threatTarget: { key: "threatTarget", color: "#d43b32", opacity: 0.5, lineWidth: 6 },
};

const NO_ARROWS: Arrow[] = [];

function config(p: { fen: string; orientation: "white" | "black"; lastMove?: string | null; check: boolean; movable?: Movable | null }) {
  const sideToMove = p.fen.split(" ")[1] === "b" ? "black" : "white";
  return {
    fen: p.fen,
    orientation: p.orientation,
    turnColor: sideToMove,
    lastMove: p.lastMove ? squares(p.lastMove) : undefined,
    check: p.check ? sideToMove : false,
    // Never viewOnly: chessground binds its mouse handlers only if the board starts interactive.
    movable: p.movable
      ? { free: false, color: p.movable.color, dests: p.movable.dests, showDests: true }
      : { color: undefined, dests: new Map() },
    draggable: { enabled: !!p.movable },
    selectable: { enabled: !!p.movable },
  } as const;
}

const shapesFor = (arrows: Arrow[]): DrawShape[] =>
  arrows.map((arrow) => {
    const [orig, dest] = squares(arrow.uci);
    return { orig, dest, brush: arrow.brush };
  });

/** Chessground owns the DOM inside the wrapper; React feeds it config. Optionally playable, with a grade badge. */
export function Board(props: Props) {
  const { fen, orientation, lastMove, check = false, arrows = NO_ARROWS, badge, movable, label, coordinates = true } = props;
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const latest = useRef(props);
  latest.current = props;

  // Created at the real position, so the first paint never animates in from the starting position.
  useEffect(() => {
    if (!el.current) return;
    const p = latest.current;
    api.current = Chessground(el.current, {
      ...config({ ...p, check: p.check ?? false }),
      coordinates,
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true },
      events: { move: (orig, dest) => latest.current.movable?.onMove(orig, dest) },
      drawable: { enabled: false, visible: true, brushes: BRUSHES as never, autoShapes: shapesFor(p.arrows ?? NO_ARROWS) },
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    const board = api.current;
    if (!board) return;
    board.set(config({ fen, orientation, lastMove, check, movable }));
    board.setAutoShapes(shapesFor(arrows));
  }, [fen, orientation, lastMove, check, arrows, movable]);

  // Badge position: the top-right corner of the square, in board percentages.
  let badgeStyle: React.CSSProperties | undefined;
  if (badge) {
    const file = badge.square.charCodeAt(0) - 97;
    const rank = Number(badge.square[1]) - 1;
    const col = orientation === "white" ? file : 7 - file;
    const row = orientation === "white" ? 7 - rank : rank;
    badgeStyle = { left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%` };
  }

  return (
    <div className="board" role="img" aria-label={label}>
      <div ref={el} className="board-ground" />
      {badge && (
        <span className="board-badge" style={badgeStyle}>
          <ClassIcon cls={badge.cls} size={26} />
        </span>
      )}
    </div>
  );
}
