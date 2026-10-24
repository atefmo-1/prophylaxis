# Prophylaxis

In chess, *prophylaxis* means seeing a problem coming and stopping it before it happens. This does that for your own habits.

**Try it: [atefmo-1.github.io/prophylaxis](https://atefmo-1.github.io/prophylaxis/)**. Enter your chess.com username; nothing to install, no account.

A free chess coach for anyone who plays on chess.com. It covers what chess.com puts behind its paywall (game review, move grades, advanced stats), and it also looks across all your games to rank the habits that cost you the most.

- **Game review:** opens on a chess.com-style report card, then walks you through your key moments as puzzles ("find a better move"), accepting any move that holds your position. Every move is graded on chess.com's scale (great → miss → blunder) with a scoresheet, eval bar, winning-chances graph and a plain-English explanation.
- **Habits:** your #1 habit with a position from your own games, six skill areas, and every habit ranked by how much it costs you, each linked to its positions.
- **Practice:** five positions a day from your own mistakes, with spaced repetition.
- **Honest numbers:** with a few dozen games, every rate is shown with a 90% interval, not as a falsely exact percentage.
- **Private:** everything runs in your browser. Your analysis is kept there and never uploaded; there is no server.

Only finished games are analysed. It never helps during a live game (chess.com Fair Play policy).

## How to use it

### The site

1. Open [the site](https://atefmo-1.github.io/prophylaxis/) on any device and enter your chess.com username.
2. Your games load from chess.com's public archive and Stockfish starts reading them, in your browser. Your latest game is reviewed first, in about a minute; your other recent games (up to 100) follow in the background, newest first, while you read. Close the tab and it picks up where it left off next time, then checks for new games whenever you come back.
3. Use the four pages:
   - **Review** opens on your latest game. The **Summary** tab is the report card. **Review key moments** turns your worst moves into puzzles: drag a piece to find a better move; **Hint**, **Show the answer** and **Skip** are there when you're stuck. The **Moves** tab steps through the game with an explanation for every move (arrow keys, the buttons under the graph, or **Next mistake**).
   - **Habits** shows your #1 habit with a real position, then skill areas and every habit ranked by what it costs. It fills in once 5 games are reviewed.
   - **Practice** gives you five positions a day from your own mistakes. Ones you miss come back sooner, ones you solve come back later.
   - **Games** lists every reviewed game; filter by result and colour.

Your name in the top bar opens a menu to switch to another player or to delete your reviews from this browser.

### The Chrome extension (optional)

It reviews each game the moment it ends, beside the board on chess.com.

1. **Install it.** Build it with `npm --prefix web install && npm --prefix web run build:extension`, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `web/dist-extension`. Pin it to the toolbar.
2. **Set it up.** Click the toolbar icon to open the side panel, then **Settings**, and enter your chess.com username.
3. **Play.** When a game ends, the side panel opens and replays the game while Stockfish reads it (about 20 to 30 seconds), then shows the review. If Chrome doesn't open it by itself, click anywhere on the chess.com page. Keep the panel open and it follows every game you finish.

## How it works

```
chess.com public API ──► your browser: Stockfish 19 Lite (WebAssembly, in a Web Worker)
                                       └─► grading: win %, accuracy, move classes
                                       └─► tactic rules: hung pieces, forks, missed mates, clock
                                       └─► stats: Jeffreys intervals, habit ranking
                                       └─► saved in IndexedDB ──► Review · Habits · Practice · Games
```

| Part | Where |
|---|---|
| Reading games from chess.com (CORS is open; one request at a time; past months fetched once) | `web/src/library/chesscom.ts` |
| Background review queue, newest first, and the browser store | `web/src/library/Library.tsx`, `web/src/library/store.ts` |
| One game: engine lines, grades, tactic tags, puzzles for each mistake | `web/src/analysis/review.ts`, `motifs.ts`, `grading.ts` |
| Statistics across games: intervals, habits, skills, practice positions | `web/src/analysis/stats.ts` |
| Pages (React + Vite + TypeScript, chessground board) | `web/src/` |

### The Python pipeline: the reference

`src/coach/` is the original pipeline, kept as the reference and the lab: full Stockfish 19 at 1 million nodes, SQLite, and the same grading, tactic rules and statistics. The browser's statistics are a port of `stats.py`, checked against it: on the same graded games, the two produce identical numbers. Our accuracy also correlates with chess.com's own (r = 0.85 on the 17 games where chess.com computed one, in the pipeline's validation set).

```bash
uv run coach sync --username <chess.com username>   # download games into data/chess.db
uv run coach analyze                                 # Stockfish + grading
uv run coach summary                                 # top weaknesses in the terminal
uv run coach export                                  # JSON into data/export/
```

Needs [uv](https://docs.astral.sh/uv/) and Stockfish on your `PATH` (or `STOCKFISH_PATH`). Everything it writes stays in `data/`, which git ignores.

## Running the site locally

```bash
npm --prefix web install
npm --prefix web run dev   # http://localhost:5173
```

Every push to `main` deploys the site to GitHub Pages (`.github/workflows/pages.yml`). It's a static site with no data in it, so it also runs from any other host or sub-folder (`npm --prefix web run build` → `web/dist/`).

## How the extension works

- **Opening by itself:** the panel opens when chess.com shows its game-over card. Chrome only lets an extension open the panel within about 5 seconds of a click on the page. That usually holds when your own move ends the game. When it doesn't (your opponent resigned, a premove, a slow card), your next click anywhere on the page opens it, and the toolbar popup offers a one-click "Open review". Turn auto-open off in Settings.
- **Waiting for chess.com:** chess.com takes a few seconds, sometimes a couple of minutes, to list a finished game in its public archive. The background worker waits for it, so you can leave the game page, and the panel shows how long it has been waiting.
- **Fair play:** the extension never reads the live board. It acts only after chess.com's public archive lists the game, which happens once the game is over.

Stockfish is GPLv3; its licence ships with the site and the extension in `engine/COPYING.txt`.

## Tests

```bash
uv run pytest                                      # grading, openings, intervals, tactic rules
npm --prefix web run typecheck
node web/scripts/check-start.mjs <username>        # the site end to end in Chrome, for any player
node web/scripts/check-extension.mjs <gameId>      # the extension's post-game review
```

## Roadmap

See [PLAN.md](PLAN.md): an ML tactic classifier trained on the Lichess puzzle database, a blunder-risk model, grounded LLM move explanations and a coach chat.

## Licence

GPL-3.0-or-later (see [LICENSE](LICENSE)). Stockfish, which the site and extension run, is also GPLv3.
