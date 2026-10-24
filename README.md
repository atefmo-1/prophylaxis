# Prophylaxis

In chess, *prophylaxis* means seeing a problem coming and stopping it before it happens. This does that for your own habits.

**Live site: [atefmo-1.github.io/prophylaxis](https://atefmo-1.github.io/prophylaxis/)**

A personal chess coach built around one player's real games. It covers the features chess.com puts behind its paywall (game review, move grades, advanced stats), and it also looks across every game to rank the habits that cost the most.

- **Game review:** opens on a chess.com-style report card, then walks you through your key moments as retry puzzles ("find a better move"), accepting any move that holds your position. Every move is graded on chess.com's scale (great → miss → blunder) with a scoresheet, eval bar, winning-chances graph and a plain-English explanation.
- **Habits:** your #1 habit with a real position, six skill areas (last 20 games vs before), and every habit ranked by how much it costs you, each linked to its positions.
- **Practice:** five positions a day from your own mistakes, with spaced repetition kept in the browser.
- **Honest numbers:** with a few dozen games, every rate is shown with a 90% interval, not as a falsely exact percentage.
- **Validated:** our accuracy score correlates with chess.com's own (r = 0.85 on the 17 games where chess.com computed one).

Only finished games are analysed. The tool never helps during a live game (chess.com Fair Play policy).

## How to use it

### The site

Open the [live site](https://atefmo-1.github.io/prophylaxis/) on any device. It updates itself with each new game (see [Staying up to date](#staying-up-to-date)). Switch between light and dark at the top right.

- **Review** opens on your latest game.
  1. The **Summary** tab is the report card: accuracy, move grades for both players, and how each phase went.
  2. **Review key moments** turns your worst moves into puzzles. Drag a piece to find a better move; any move that holds your position counts. **Hint** points at the piece to move, **Show the answer** reveals it, and **Skip** moves on.
  3. The **Moves** tab steps through the game with an explanation for every move. Use the arrow keys, the buttons under the graph, or **Next mistake**. Click the graph to jump anywhere.
- **Habits** shows your #1 habit with a real position from your games, then six skill areas and every habit ranked by how much it costs you. **Practise 5 of these** drills that habit.
- **Practice** gives you five positions a day from your own mistakes. Ones you miss come back sooner, and ones you solve come back later (kept in your browser).
- **Games** lists every game. Filter by result and colour, then open any game in Review.

### The Chrome extension

It reviews each game the moment it ends, right next to the board.

1. **Install it once.** Build it with `npm --prefix web install && npm --prefix web run build:extension`, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `web/dist-extension` folder. Pin it to the toolbar.
2. **Set it up.** Click the toolbar icon to open the side panel, then **Settings**: your chess.com username and your site's address.
3. **Play.** When the game ends, the side panel opens with a live replay while Stockfish reads the game (about 20–30 seconds), then the full review. If Chrome doesn't open it by itself, click anywhere on the chess.com page. Keep the panel open and it follows every game you finish.
4. **Go deeper.** **Habits**, **Practice** and **All games** at the top of the panel open your site.

With the panel closed, a small card in the corner shows your biggest moment instead, with **Retry it** and **Full review**. After you reload or update the extension, refresh your chess.com tabs.

### Get each game on the site right away (optional)

The site picks up new games within the hour on its own. To have it update as soon as a game ends, give the extension a GitHub token that can start the update:

1. On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Under **Repository access**, choose **Only select repositories** and pick your Prophylaxis repository.
3. Under **Permissions → Repository permissions**, set **Actions** to **Read and write**. Leave everything else as it is.
4. Generate the token and paste it into the extension's **Settings → GitHub token**, then **Save**.

The token stays on this computer (it is not synced). After each game, the panel shows "Adding this game to your site", then "On your site" with a link, usually within about 3 minutes.

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

## Running it locally

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

## Staying up to date

The [live site](https://atefmo-1.github.io/prophylaxis/) runs on GitHub Pages and keeps itself current:

- **Every hour, and right after each game when the extension has a token**, `.github/workflows/update.yml` downloads new games from chess.com, analyses them with Stockfish 19 at the same settings as the local pipeline, commits `web/public/data/` and redeploys. Hours with no new games change nothing. Run it now from the repo's **Actions → Update games → Run workflow**, or `gh workflow run update.yml`.
- The pipeline's database lives on the one-file `pipeline-db` branch, so each run only analyses games it hasn't seen. To work on it locally, fetch it first: `git fetch origin pipeline-db && git show FETCH_HEAD:chess.db > data/chess.db`. Stockfish builds for different CPUs can disagree by a fraction of a point, so let the workflow analyse new games rather than mixing in local runs.
- Every push to `main` also rebuilds the site (`.github/workflows/pages.yml`). GitHub pauses scheduled workflows after 60 days without any commits; re-enable it from the Actions tab.

`npm --prefix web run build` produces the same static site in `web/dist/`, which runs from any path (Vercel, Netlify, a sub-folder of a portfolio site). No server needed.

Using it for your own games: clone the repo, run the steps under **Running it** with `COACH_USERNAME=<your username>`, and deploy your fork (in the fork's settings, set Pages to deploy from GitHub Actions). In the extension's Settings, set your username and your site's address.

## How the extension works

- **Opening by itself:** the panel opens when chess.com shows its game-over card. Chrome only lets an extension open the panel within about 5 seconds of a click on the page. That usually holds when your own move ends the game. When it doesn't (your opponent resigned, a premove, a slow card), your next click anywhere on the page opens it, and the toolbar popup offers a one-click "Open review". Turn auto-open off in Settings.
- **Waiting for chess.com:** chess.com takes a few seconds, sometimes a couple of minutes, to list a finished game in its public archive. The background worker waits for it, so you can leave the game page, and the panel shows how long it has been waiting.

- Analysis runs in your browser with Stockfish 19 Lite (WebAssembly), using a TypeScript port of the pipeline's grading and tactic rules (`web/src/analysis/`). A game takes about 20–30 seconds. The lite engine is weaker than the full Stockfish used by the pipeline, so treat the extension as a quick review; the site stays the reference.
- **Fair play:** the extension never reads the live board. It acts only on finished-game pages, and only after chess.com's public archive lists the game, which happens once the game is over.
- **Habits and site updates:** habit links come from your site (`data/overview.json`). With a GitHub token, the worker starts the site's "Update games" workflow once per finished game, and the panel watches the site's game list until the game appears.

To check it end to end: `node web/scripts/check-extension.mjs <gameId>`, and `node web/scripts/check-waiting.mjs <gameId>` for the wait after a game ends.

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
