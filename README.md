# Chess Coach

A personal chess coach built around one player's real games ([atefmo-1 on chess.com](https://www.chess.com/member/atefmo-1)). It covers the features chess.com puts behind its paywall (game review, move grades, advanced stats), and it also looks across every game to rank the habits that cost the most.

- **Game review:** opens on a chess.com-style report card, then walks you through your key moments as retry puzzles ("find a better move"), accepting any move that holds your position. Every move is graded on chess.com's scale (great → miss → blunder) with a scoresheet, eval bar, winning-chances graph and a plain-English explanation.
- **Habits:** your #1 habit with a real position, six skill areas (last 20 games vs before), and every habit ranked by how much it costs you, each linked to its positions.
- **Practice:** five positions a day from your own mistakes, with spaced repetition kept in the browser.
- **Honest numbers:** with a few dozen games, every rate is shown with a 90% interval, not as a falsely exact percentage.
- **Validated:** our accuracy score correlates with chess.com's own (r = 0.83 on the 15 games where chess.com computed one).

Only finished games are analysed. The tool never helps during a live game (chess.com Fair Play policy).

## How it works

```
chess.com public API ──► sync ──► SQLite ──► Stockfish 19 (pool of engines, cached by position)
                                         └─► grading: win %, accuracy, move classes
                                         └─► tactic rules: hung pieces, forks, missed mates, clock
                                         └─► stats: Jeffreys intervals, weakness ranking
                                         └─► export: static JSON ──► React dashboard
```

| Part | Where |
|---|---|
| Sync from chess.com (sequential requests, ETag caching) | `src/coach/chesscom.py` |
| Stockfish pool and position cache | `src/coach/engine.py` |
| Win %, accuracy, move classes (Lichess formulas, chess.com thresholds) | `src/coach/grading.py` |
| Tactic detectors, checked against the engine's own lines | `src/coach/motifs.py` |
| Stats, intervals, weakness ranking | `src/coach/stats.py` |
| Dashboard (React + Vite + TypeScript, chessground board) | `web/` |

## Running it

Needs [uv](https://docs.astral.sh/uv/), Node 20+, and Stockfish on your `PATH` (or set `STOCKFISH_PATH`).

```bash
uv run coach sync        # download new games
uv run coach analyze     # Stockfish + grading (first run takes a few minutes)
uv run coach summary     # top weaknesses in the terminal
uv run coach export      # write web/public/data/*.json
npm --prefix web install
npm --prefix web run dev # http://localhost:5173
```

Another player: `COACH_USERNAME=<username> uv run coach sync` (use a separate `COACH_DATA_DIR` per player).

## Deploying

`npm --prefix web run build` produces a static site in `web/dist/` that runs from any path: Vercel, Netlify, GitHub Pages, or a sub-folder of a portfolio site. No server needed. Re-run `coach sync && coach analyze && coach export` and rebuild to publish new games.

## Tests

```bash
uv run pytest            # grading, openings, intervals, tactic detectors on hand-built positions
npm --prefix web run typecheck
```

## Roadmap

See [PLAN.md](PLAN.md): grounded LLM move explanations, a coach chat agent, spaced-repetition drills from your own mistakes, an ML tactic classifier trained on the Lichess puzzle database, and a Chrome extension for finished games.
