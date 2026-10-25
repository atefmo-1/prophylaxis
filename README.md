# Prophylaxis

In chess, *prophylaxis* means seeing a problem coming and stopping it before it happens. This does that for your own habits.

**Try it: [atefmo-1.github.io/prophylaxis](https://atefmo-1.github.io/prophylaxis/)**. Enter your chess.com username; nothing to install, no account.

A free chess coach for anyone who plays on chess.com. It covers what chess.com puts behind its paywall (game review, move grades, advanced stats), and it also looks across all your games to rank the habits that cost you the most.

- **Game review:** opens on a chess.com-style report card, then walks you through your key moments as puzzles ("find a better move"), accepting any move that holds your position. Every move is graded on chess.com's scale (brilliant, great, best … book … miss, blunder) with a scoresheet, eval bar, winning-chances graph and a plain-English explanation.
- **Habits:** your #1 habit with a position from your own games, six skill areas, and every habit ranked by how much it costs you, each linked to its positions.
- **Practice:** five positions a day from your own mistakes, with spaced repetition, plus Lichess puzzles of the exact tactic behind each habit, at your level.
- **Opening tree:** your first ten moves across all your games, merged into one tree, with how each line turned out.
- **Compare:** you against any chess.com player. Their last 30 games in your time control are reviewed in your browser like yours, then shown side by side with yours, with tips for beating them drawn from their numbers (their costliest habits, where and when they go wrong, how they convert, their openings), each with its evidence.
- **Honest numbers:** with a few dozen games, every rate is shown with a 90% interval, not as a falsely exact percentage.
- **Private:** everything runs in your browser. Your analysis is kept there and never uploaded; there is no server.

Only finished games are analysed. It never helps during a live game (chess.com Fair Play policy).

## How to use it

### The site

1. Open [the site](https://atefmo-1.github.io/prophylaxis/) on any device and enter your chess.com username.
2. Your games load from chess.com's public archive and Stockfish starts reading them, in your browser, on as many cores as your device can spare. Your latest game is reviewed first, in seconds on a laptop; your other recent games follow in the background, newest first, while you read. The first visit reviews as many games as your device gets through in about five minutes (at least 5, so Habits has something to show), and **Games** offers to review more. The top bar shows the time left and a pause button (on a phone, it's in the player menu), and reviewing pauses by itself when the battery is low and not charging. Close the tab and it picks up where it left off next time, then checks for new games whenever you come back.
3. Use the four pages:
   - **Review** opens on your latest game. The **Summary** tab is the report card. **Review key moments** turns your worst moves into puzzles: drag a piece to find a better move; **Hint**, **Show the answer** and **Skip** are there when you're stuck. The **Moves** tab steps through the game with an explanation for every move (arrow keys, the buttons under the graph, or **Next mistake**).
   - **Habits** shows your #1 habit with a real position, then skill areas and every habit ranked by what it costs. It fills in once 5 games are reviewed.
   - **Practice** gives you five positions a day from your own mistakes. Ones you miss come back sooner, ones you solve come back later. Each tactic habit also has **Puzzles**: Lichess puzzles of that tactic that start at your level and get harder as you solve them.
   - **Games** lists every reviewed game; filter by result and colour.
   - **Openings** merges your first ten moves into one tree: click a move to follow it, **Back** to step back.
   - **Compare** takes any chess.com username (or one of the players you've met most), reviews their last 30 games in your main time control (about 2–3 minutes, after your own games are done), and shows the two of you side by side, how to beat them, and their opening tree. Their reviews stay in your browser, so comparing again is instant, and deleting your data deletes them too.

Your name in the top bar opens a menu to switch to another player or to delete your reviews from this browser.

### The Chrome extension (optional)

It reviews each game the moment it ends, beside the board on chess.com.

1. **Install it.** Build it with `npm --prefix web install && npm --prefix web run build:extension`, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `web/dist-extension`. Pin it to the toolbar.
2. **Set it up.** Click the toolbar icon to open the side panel. The first time, it asks for your chess.com username (and suggests the one you use on the site, if you've opened it).
3. **Play.** When a game ends, the side panel opens and replays the game while Stockfish reads it (about 20 to 30 seconds), then shows the review. If Chrome doesn't open it by itself, click anywhere on the chess.com page. Keep the panel open and it follows every game you finish.
4. **The site and the extension share.** Games the extension reviewed appear on the site straight away, without being analysed again, and the site tells the extension your habits, so a review in the panel says which habit a mistake belongs to. If you open the site with the extension installed, it offers to continue as the extension's player.

## How it works

```
chess.com public API ──► your browser: Stockfish 19 Lite (WebAssembly, one Web Worker per spare core)
                                       └─► grading: win %, accuracy, move classes
                                       └─► tactic rules: hung pieces, forks, missed mates, clock
                                       └─► tactic classifier (ONNX, onnxruntime-web, its own Web Worker): names pins, skewers, …
                                       └─► stats: Jeffreys intervals, habit ranking
                                       └─► saved in IndexedDB ──► Review · Habits · Practice · Games
```

| Part | Where |
|---|---|
| Reading games from chess.com (CORS is open; one request at a time; past months fetched once) | `web/src/library/chesscom.ts` |
| Background review queue, newest first, within a time budget; pausing; the browser store | `web/src/library/Library.tsx`, `web/src/library/store.ts` |
| How many engines this device runs, a one-second speed check, time estimates; the engines sharing a game | `web/src/library/device.ts`, `web/src/analysis/pool.ts` |
| One game: engine lines, grades, tactic tags, puzzles for each mistake | `web/src/analysis/review.ts`, `motifs.ts`, `grading.ts` |
| The trained tactic classifier, and how its tags combine with the rules' | `web/src/analysis/tactics.ts`, `tactics.worker.ts`, `planes.ts` |
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

### The tactic classifier: `ml/`

A small CNN that names the tactic behind a mistake (fork, pin, skewer, discovered attack, trapped piece, back-rank mate and more) from the position and Stockfish's line. It is trained on 4.8 million Lichess puzzles (CC0) and checked on 10,000 real games between Lichess players rated 1300 or less. On held-out puzzles its macro F1 over 15 themes is 0.91, against 0.27 for the hand-written rules, which can name only 5 of them. On real beginner blunders it names pins (F1 0.81), discovered attacks (0.89), skewers (0.83) and trapped pieces (0.78), which the rules couldn't name at all. The rules still win on mates and still decide whether material was really lost; the model names what they leave generic, and only for themes where it beat them on both puzzles and real games. The name then drives the habit, the arrows on the board and the practice puzzles. It ships quantised to 0.98 MB. Data, split, metrics and limits: [ml/REPORT.md](ml/REPORT.md).

```bash
cd ml && uv run tactics all   # download, build the splits, train LightGBM and the CNN, export, score
```

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
- **Sharing with the site:** a small script on the site's pages (`extension/public/site-bridge.js`) passes messages between the page and the extension, all inside the browser. The site asks for the reviews the extension made (in the site's own format, with the facts its statistics need) and sends back the player's habits. Without the extension, the site's questions simply go unanswered after a moment.

Stockfish is GPLv3; its licence ships with the site and the extension in `engine/COPYING.txt`.

## Tests

```bash
uv run pytest                                      # grading (incl. Brilliant and Book), openings, intervals, tactic rules
(cd ml && uv run pytest)                           # tactic classifier: data, features, encoder parity with TypeScript
npm --prefix web run typecheck
node web/scripts/check-grading.ts                            # Brilliant and Book in TypeScript give Python's answers
node web/scripts/check-start.mjs <username>                  # the site end to end in Chrome, for any player
node web/scripts/check-device.mjs <username> [laptop|phone]   # engines, time budget, time left, pausing, as a laptop or a slow phone
node web/scripts/check-extension.mjs <username> <gameId>     # the extension's post-game review
node web/scripts/check-bridge.mjs <username>                 # extension and site together (dev server running)
```

## Roadmap

See [PLAN.md](PLAN.md): a blunder-risk model, grounded LLM move explanations and a coach chat.

## Licence

GPL-3.0-or-later (see [LICENSE](LICENSE)). Stockfish, which the site and extension run, is also GPLv3. The opening book is [Lichess's openings list](https://github.com/lichess-org/chess-openings) (CC0), in `web/public/openings/`.
