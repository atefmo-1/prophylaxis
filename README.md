# Prophylaxis

In chess, *prophylaxis* means seeing a problem coming and stopping it before it happens. This does that for your own habits.

A personal chess coach built around one player's real games ([atefmo-1 on chess.com](https://www.chess.com/member/atefmo-1)). It covers the features chess.com puts behind its paywall (game review, move grades, advanced stats), and it also looks across every game to rank the habits that cost the most.

- **Game review:** opens on a chess.com-style report card, then walks you through your key moments as retry puzzles ("find a better move"), accepting any move that holds your position. Every move is graded on chess.com's scale (great → miss → blunder) with a scoresheet, eval bar, winning-chances graph and a plain-English explanation.
- **Habits:** your #1 habit with a real position, six skill areas (last 20 games vs before), and every habit ranked by how much it costs you, each linked to its positions.
- **Practice:** five positions a day from your own mistakes, with spaced repetition kept in the browser.
- **Honest numbers:** with a few dozen games, every rate is shown with a 90% interval, not as a falsely exact percentage.
- **Validated:** our accuracy score correlates with chess.com's own (r = 0.85 on the 17 games where chess.com computed one).

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

Live: **[atefmo-1.github.io/prophylaxis](https://atefmo-1.github.io/prophylaxis/)**. It keeps itself up to date:

- **Every hour**, `.github/workflows/update.yml` downloads new games from chess.com, analyses them with Stockfish 19 (same settings as locally, so the grades match), commits `web/public/data/` and redeploys. Hours with no new games change nothing. Run it now from the repo's **Actions → Update games → Run workflow**, or `gh workflow run update.yml`.
- The pipeline's database lives on the one-file `pipeline-db` branch, so each run only analyses games it hasn't seen. To work on it locally, fetch it first: `git fetch origin pipeline-db && git show FETCH_HEAD:chess.db > data/chess.db`.
- Every push to `main` also rebuilds the site (`.github/workflows/pages.yml`). GitHub pauses scheduled workflows after 60 days without any commits; re-enable it from the Actions tab.

`npm --prefix web run build` produces the same static site in `web/dist/`, which runs from any path (Vercel, Netlify, a sub-folder of a portfolio site). No server needed.

Using it for your own games: clone the repo, run the steps under **Running it** with `COACH_USERNAME=<your username>`, and deploy your fork (in the fork's settings, set Pages to deploy from GitHub Actions). In the extension's Settings, set your username and your site's address.

## Chrome extension

When chess.com shows its game-over card, the side panel opens and replays the analysis live, then shows the review (turn this off in the panel's Settings). Chrome only lets an extension open the panel within about 5 seconds of a click on the page: that usually holds when your own move ends the game, and opens it by itself. When it doesn't (your opponent resigned, a premove, a slow card), your next click anywhere on the page opens it, such as closing chess.com's card, and the toolbar popup offers a one-click "Open review". Once open, the panel stays open and follows every game you finish. chess.com takes a few seconds (sometimes a couple of minutes) to list a finished game in its public archive; the extension's background worker waits for it, so you can leave the game page, and the panel shows how long it has been waiting. With the panel closed, a small card shows your biggest moment, whether it's one of your habits, and buttons to **retry it** or open the **full review** in Chrome's side panel (the same review screen as the site).

- Analysis runs in your browser with Stockfish 19 Lite (WebAssembly), using a TypeScript port of the pipeline's grading and tactic rules (`web/src/analysis/`). A game takes about 20–30 seconds. The lite engine is weaker than the full Stockfish used by the pipeline, so treat the extension as a quick review; the site stays the reference.
- **Fair play:** the extension never reads the live board. It acts only on finished-game pages, and only after chess.com's public archive lists the game, which happens once the game is over.
- Habit links come from your Prophylaxis site (`data/overview.json`). Set your username and site address under **Settings** in the side panel.

```bash
npm --prefix web run build:extension
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `web/dist-extension`. To check it end to end: `node web/scripts/check-extension.mjs <gameId>`, and `node web/scripts/check-waiting.mjs <gameId>` for the wait after a game ends.

Stockfish is GPLv3; its licence ships with the extension in `engine/COPYING.txt`.

## Tests

```bash
uv run pytest            # grading, openings, intervals, tactic detectors on hand-built positions
npm --prefix web run typecheck
```

## Roadmap

See [PLAN.md](PLAN.md): grounded LLM move explanations, a coach chat agent, spaced-repetition drills from your own mistakes, an ML tactic classifier trained on the Lichess puzzle database, and a Chrome extension for finished games.

## Licence

GPL-3.0-or-later (see [LICENSE](LICENSE)). The extension bundles Stockfish, which is also GPLv3.
