// The opening tree of the player's reviewed games: what they play, what their opponents answer, and how it goes.
import { OpeningTree } from "../components/OpeningTree";
import { useLibrary } from "../library/Library";
import { plural } from "../lib/format";
import { href } from "../router";
import "./pages.css";

export function Openings() {
  const { stored, loaded } = useLibrary();
  if (!loaded) return <div className="page" aria-busy="true" />;
  const played = stored.filter((s) => s.review.moves.length > 0);
  return (
    <div className="page">
      <header className="page-top">
        <h1>Openings</h1>
        <p>
          Your first ten moves across {plural(played.length, "reviewed game")}, merged into one tree for each colour. Click a move to follow
          it; each one shows how those games went.
        </p>
      </header>
      <OpeningTree stored={played} who="You" gameLink={(g) => href({ name: "game", id: g.id, ply: null })} level={2} />
    </div>
  );
}
