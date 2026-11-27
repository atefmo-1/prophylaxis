// "Was this explanation right?" under the explanation of one of your mistakes. The answer is counted anonymously
// with the kind of explanation it was (lib/analytics.ts: "vote/no/allowed_fork"), never the game or the move, so the
// share of each kind that players accept can be measured. Shown only when counting is on.
import { useState } from "react";
import { countEvent, counting } from "../lib/analytics";

const KEY = "coach.votes.v1";

function voted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** `id` keeps one answer per explanation in this browser; `kind` is what's counted. */
export function Vote({ id, kind }: { id: string; kind: string }) {
  const [done, setDone] = useState(() => voted().has(id));
  if (!counting()) return null;
  if (done) return <p className="vote vote--done">Thanks: that helps make these explanations better.</p>;
  const answer = (right: boolean) => {
    countEvent(`vote/${right ? "yes" : "no"}/${kind}`);
    try {
      localStorage.setItem(KEY, JSON.stringify([...voted(), id].slice(-2000)));
    } catch {
      // Without storage the question may come back; the answer was still counted.
    }
    setDone(true);
  };
  return (
    <p className="vote">
      Was this explanation right?
      <button type="button" className="link-btn" onClick={() => answer(true)}>
        Yes
      </button>
      <button type="button" className="link-btn" onClick={() => answer(false)}>
        No
      </button>
    </p>
  );
}
