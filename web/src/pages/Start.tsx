// The first screen: one question, your chess.com username. Everything after it runs in this browser.
import { useState, type FormEvent } from "react";
import { Board } from "../components/Board";
import { PlayerNotFound } from "../library/chesscom";
import { useLibrary } from "../library/Library";
import "./start.css";

const REPO = "https://github.com/atefmo-1/prophylaxis";
// A made-up position for the illustration: the knight on c7 forks king and rook, the habit the coach catches.
const DEMO_FEN = "r3k3/ppN2ppp/8/8/8/8/PPP2PPP/4K2R b K - 0 1";

export function Start() {
  const { start, startSample } = useLibrary();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await start(name);
    } catch (err) {
      setError(err instanceof PlayerNotFound ? err.message : `Couldn't reach chess.com: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <div className="start">
      <section className="start-hero">
        <div className="start-copy">
          <h1>A free chess coach for your chess.com games</h1>
          <p className="start-lede">
            Stockfish reviews every game, finds the habits that cost you the most, and turns your own mistakes into
            practice. It runs in your browser: no account, nothing uploaded.
          </p>
          <form className="start-form" onSubmit={submit}>
            <label htmlFor="username">Your chess.com username</label>
            <div className="start-row">
              <input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. magnuscarlsen"
                aria-invalid={!!error}
                aria-describedby={error ? "username-error" : undefined}
              />
              <button type="submit" className="start-go" disabled={busy || !name.trim()}>
                {busy ? "Finding your games…" : "Review my games"}
              </button>
            </div>
            {error && (
              <p className="start-error" id="username-error" role="alert">
                {error}
              </p>
            )}
          </form>
          <p className="start-sample">
            No chess.com account?{" "}
            <button type="button" onClick={startSample}>
              Look around with a sample player
            </button>
          </p>
        </div>
        <div className="start-board" aria-hidden="true">
          <Board
            fen={DEMO_FEN}
            orientation="white"
            lastMove="d5c7"
            check
            arrows={[{ uci: "c7a8", brush: "threat" }, { uci: "c7e8", brush: "threat" }]}
            label="A knight forking king and rook"
            coordinates={false}
          />
        </div>
      </section>

      <ol className="start-steps">
        <li>
          <h2>Enter your username</h2>
          <p>Your recent games load straight from chess.com's public archive.</p>
        </li>
        <li>
          <h2>Get your first review in about a minute</h2>
          <p>Your latest game comes first. The rest are reviewed in the background while you read, newest first.</p>
        </li>
        <li>
          <h2>Add the Chrome extension, if you like</h2>
          <p>
            After every game on chess.com, the review opens beside the board. <a href={`${REPO}#the-chrome-extension`}>How to install it</a>
          </p>
        </li>
      </ol>

      <p className="start-note">
        Your games are public on chess.com already. Your analysis stays in this browser, and you can delete it at any time.
        Analysis of finished games only, never during play. <a href={REPO}>Open source</a>.
      </p>
    </div>
  );
}
