// An opening explorer for one player's own games: the board at the current position, the moves played from it with
// how they turned out, and the games that got there. Click a move to go deeper.
import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredGame } from "../analysis/stats";
import { bookKey, loadOpeningNames } from "../analysis/book";
import { day, plural, share } from "../lib/format";
import { accuracy, branches, buildTree, moveLabel, score, TREE_DEPTH, type TreeNode } from "../lib/openingTree";
import { RESULT_META } from "../lib/format";
import type { Color } from "../types";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { Board } from "./Board";
import "./openingTree.css";

const MIN_FOR_VERDICT = 3; // games before a move is called a good or bad choice

function nameAt(names: Map<string, string>, path: TreeNode[]): string | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const setup = parseFen(path[i].fen);
    if (setup.isErr) continue;
    const pos = Chess.fromSetup(setup.value);
    if (pos.isErr) continue;
    const name = names.get(bookKey(pos.value));
    if (name) return name;
  }
  return null;
}

export function OpeningTree({
  stored,
  who,
  gameLink,
  level = 3,
}: {
  stored: StoredGame[];
  /** "You" for the player's own games, or the other player's name. */
  who: string;
  /** Where a game opens: the review for your games, chess.com for someone else's; null when it has nowhere to open. */
  gameLink: (g: TreeNode["recent"][number]) => string | null;
  /** The level of the tree's own headings, one below the heading it sits under. */
  level?: 2 | 3;
}) {
  const [color, setColor] = useState<Color>("white");
  const [path, setPathState] = useState<string[]>([]);
  // Choosing a move replaces the list it was chosen from: keep keyboard focus in the tree rather than losing it.
  const side = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const setPath = (next: string[]) => {
    refocus.current = side.current?.contains(document.activeElement) ?? false;
    setPathState(next);
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const at = side.current;
    (at?.querySelector<HTMLElement>(".otree-move") ?? at?.querySelector<HTMLElement>(".otree-back"))?.focus();
  }, [path]);
  const H = `h${level}` as "h2" | "h3";
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    loadOpeningNames(import.meta.env.BASE_URL).then(setNames);
  }, []);

  const tree = useMemo(() => buildTree(stored, color), [stored, color]);
  const nodes = useMemo(() => {
    const out = [tree];
    for (const san of path) {
      const next = out[out.length - 1].children.get(san);
      if (!next) break;
      out.push(next);
    }
    return out;
  }, [tree, path]);
  const at = nodes[nodes.length - 1];
  const ply = nodes.length - 1;
  const theirMove = (ply % 2 === 0) !== (color === "white"); // whose move it is from here
  const you = who === "You";
  const mover = theirMove ? (you ? "Your opponents" : `${who}'s opponents`) : you ? "You" : who;
  const moves = branches(at);
  const judged = moves.filter((m) => m.games >= MIN_FOR_VERDICT);
  const best = !theirMove && judged.length > 1 ? judged.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
  const worst = !theirMove && judged.length > 1 ? judged.reduce((a, b) => (score(b) < score(a) ? b : a)) : null;
  const name = nameAt(names, nodes);

  const pick = (c: Color) => {
    setColor(c);
    setPath([]);
  };

  if (tree.games === 0)
    return (
      <div className="otree-empty">
        <div className="seg" role="group" aria-label="Colour">
          {(["white", "black"] as Color[]).map((c) => (
            <button key={c} type="button" aria-pressed={color === c} onClick={() => pick(c)}>
              As {c}
            </button>
          ))}
        </div>
        <p className="muted">No reviewed games with {color} yet.</p>
      </div>
    );

  return (
    <div className="otree">
      <div className="otree-board">
        <Board fen={at.fen} orientation={color} lastMove={at.uci} coordinates label={name ?? "Starting position"} />
      </div>
      <div className="otree-side" ref={side}>
        <div className="otree-top">
          <div className="seg" role="group" aria-label="Colour">
            {(["white", "black"] as Color[]).map((c) => (
              <button key={c} type="button" aria-pressed={color === c} onClick={() => pick(c)}>
                As {c}
              </button>
            ))}
          </div>
          <span className="muted num">{plural(tree.games, "game")}</span>
        </div>

        {ply > 0 && (
          <nav className="otree-path" aria-label="Moves so far">
            <button type="button" className="otree-back" onClick={() => setPath(path.slice(0, -1))}>
              ← Back
            </button>
            {nodes.slice(1).map((n, i) => (
              <button key={i} type="button" onClick={() => setPath(path.slice(0, i + 1))} aria-current={i + 1 === ply ? "step" : undefined}>
                {moveLabel(i, n.san!)}
              </button>
            ))}
          </nav>
        )}

        <p className="otree-name">{name ?? (ply === 0 ? "Starting position" : "Off the named lines")}</p>
        <p className="otree-here">
          {plural(at.games, "game")} reached this position: {at.win} won, {at.loss} lost
          {at.draw > 0 && <>, {at.draw} drawn</>}. A {share(score(at))} score
          {accuracy(at) !== null && <> and {accuracy(at)!.toFixed(1)} accuracy</>}.
        </p>

        {moves.length > 0 ? (
          <>
            <H className="otree-h">{mover} played</H>
            <table className="ptable otree-moves">
              <thead>
                <tr>
                  <th scope="col">Move</th>
                  <th scope="col" className="num">Games</th>
                  <th scope="col">Result</th>
                  <th scope="col" className="num">Score</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.san} onClick={() => setPath([...path, m.san!])} className={m === best ? "is-best" : m === worst ? "is-worst" : undefined}>
                    <td>
                      <button type="button" className="otree-move" onClick={() => setPath([...path, m.san!])}>
                        {moveLabel(ply, m.san!)}
                      </button>
                      {m === best && <small className="otree-tag otree-tag--best">best for {you ? "you" : who}</small>}
                      {m === worst && <small className="otree-tag otree-tag--worst">worst for {you ? "you" : who}</small>}
                    </td>
                    <td className="num">{m.games}</td>
                    <td>
                      <span className="otree-bar" role="img" aria-label={`${m.win} won, ${m.loss} lost, ${m.draw} drawn`}>
                        <i className="w" style={{ flexGrow: m.win }} />
                        <i className="d" style={{ flexGrow: m.draw }} />
                        <i className="l" style={{ flexGrow: m.loss }} />
                      </span>
                    </td>
                    <td className="num">{share(score(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="otree-note muted">
              Scores are from {you ? "your" : `${who}'s`} side. A move needs {MIN_FOR_VERDICT} games before it's called best or worst.
            </p>
          </>
        ) : (
          <p className="muted">{ply < TREE_DEPTH ? "Every game that got here ended here." : "The tree stops at ten moves each."}</p>
        )}

        <H className="otree-h">Latest games from here</H>
        <ul className="otree-games">
          {at.recent.map((g) => {
            const link = gameLink(g);
            return (
              <li key={g.id}>
                {link ? (
                  <a href={link} target={link === g.url ? "_blank" : undefined} rel="noreferrer">
                    vs {g.opponent}
                  </a>
                ) : (
                  <span>vs {g.opponent}</span>
                )}{" "}
                <span className={`otree-res otree-res--${g.result}`}>{RESULT_META[g.result].label.toLowerCase()}</span>{" "}
                <span className="muted">{day(g.t)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
