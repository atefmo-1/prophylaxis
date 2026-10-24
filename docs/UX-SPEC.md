# UX research & spec: how Prophylaxis should present each feature

Written 2026-10-24 after the first two designs missed. Both invented their own layouts instead of starting from what chess players already know. This spec starts from the conventions of chess.com and Lichess, keeps everything players expect, and puts our own effort only where we can do better than they do.

**How it was researched:** chess.com help-centre and news posts; Lichess's own pages and open-source code (`lila`), which gives exact UI wording and thresholds; Aimchess, Noctie, DecodeChess, Chessigma and existing Chrome extensions; coach articles on reviewing games. A real beginner's game was also loaded on Lichess's analysis board and on its chess.com game page and studied directly.com game page and studied directly. Sources are linked inline.

---

## 1. What went wrong in our versions

| Problem | Convention it broke |
|---|---|
| "Every move" rendered as wrapping text | Every chess site uses a **two-column scoresheet**: move number, White, Black ([Lichess column view](https://github.com/lichess-org/lila/blob/master/ui/analyse/src/treeView/columnView.ts)) |
| Board pushed below the fold by a hero section | Lichess and chess.com size the **board to the viewport height**; analysis lives beside it, not above it |
| Verdict, lesson card and accuracy in a marketing-style hero | chess.com shows the **summary in the side panel**, next to the board, then starts the review there |
| Class colours and names invented per design | Players already know chess.com's names and its **green → yellow → orange → red** ramp |
| Explanation panel detached from the move list | chess.com's coach feedback sits **directly above/beside the moves** and updates on every step |
| No "try it yourself" | Both leading tools make you **retry the mistake before revealing the answer** |
| Wood, plaques, broadcast styling | Visual identity was carrying the design. In a review tool the board and the moves have to carry it |

---

## 2. Principles

1. **Board first, always visible.** On desktop the review never scrolls; the board, the panel and the controls fit in one viewport.
2. **Familiar where it matters:** scoresheet, classification names and colours, eval bar, arrow keys. A chess.com user should know where everything is in two seconds.
3. **One lesson per game.** A beginner learns more from one critical position than from a full report ([Belenkaya: find "the first mistake that started the slide"](https://www.chess.com/article/view/how-to-analyze-your-chess-games)).
4. **Try before you're told.** Every key mistake is a retry puzzle first and an explanation second.
5. **Facts, not prose.** Each explanation sentence comes from the engine and our tactic rules, names the piece and square, and lights up an arrow. chess.com loses trust when its text is wrong ([forum](https://www.chess.com/forum/view/general/chesscoms-new-game-review-what-the-heck-happened?lc=1)).
6. **Connect every game to the habits.** This is the one thing chess.com doesn't do, and it's our reason to exist.

---

## 3. Game review (the first screen)

### 3.1 Layout (desktop ≥ 1100px), one viewport, no page scroll

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Prophylaxis   Review · Habits · Practice · Games              you · 312      │
├───┬───────────────────────────────────────────┬──────────────────────────────┤
│ E │ ▢ opponent       298          61.2 acc     │ ┌ COACH ────────────────────┐ │
│ V │ ┌─────────────────────────────────────┐   │ │ 9… g5  ?? Blunder          │ │
│ A │ │                                     │   │ │ Your chances 71% → 18%.    │ │
│ L │ │                                     │   │ │ It opened the e8–h5 diag-  │ │
│   │ │               BOARD                 │   │ │ onal: Qh5+ wins.           │ │
│ B │ │   (height = viewport − 2 strips)    │   │ │ ↳ 3rd time in your last 10 │ │
│ A │ │   class badge on the moved piece    │   │ │   games  [Habits →]        │ │
│ R │ │   arrows: green best, red threat    │   │ │ [Retry move] [Show best]   │ │
│   │ └─────────────────────────────────────┘   │ └───────────────────────────┘ │
│   │ ▢ you             312 +8       58.4 acc    │  1  e4      e5             │
│   │                                           │  2  f4 ?!   exf4           │
│   │                                           │  …  (two-column scoresheet,│
│   │                                           │      scrolls inside panel) │
│   │                                           │  8  Nxe5 ?  f6 ??  ◀ current│
│   │                                           │ ─────────────────────────── │
│   │                                           │ ▁▂▅▇▆▂▁▃▇██▇  chances graph│
│   │                                           │ |◀  ◀  ▶  ▶|   Next mistake ▶ │
└───┴───────────────────────────────────────────┴──────────────────────────────┘
```

- **Eval bar** to the left of the board, as on chess.com and Lichess: White fills from the bottom when you play White, and it flips with the board. It's a winning-chances bar, so no numbers by default, with the percentage on hover ([chess.com treats the bar as optional](https://support.chess.com/en/articles/10473022-how-do-i-use-game-analysis-on-the-app)).
- **Player strips** above and below the board: name, rating, rating change and accuracy, the way chess.com's game page shows them. The opponent is on top and you are at the bottom.
- **Class badge on the board:** a small icon on the destination square of the current move (chess.com's "Show Move Classification On Board").
- **Right panel (fixed ~380px, board height):** the coach card on top, the scoresheet in the middle (scrolls internally), and the graph and controls pinned at the bottom.
- **Arrows:** green for the best move, red for the threat our move allowed. Only on graded mistakes, never more than two.

### 3.2 States of the panel

1. **Summary (on open)**, the way chess.com Game Review opens on its highlights:
   - One coach sentence: *"Won by checkmate. It turned on 9… g5 (71% → 18%); your opponent didn't punish it."*
   - **You vs them:** accuracy side by side, then a **class-count table** with one icon row per class and two aligned number columns. This is chess.com's report card, which players recognise.
   - **Phases:** Opening / Middlegame / Endgame, each with its accuracy and the class icon of its worst move.
   - Primary button **"Review the 3 key moments"**; secondary: "Step through every move".
2. **Key-moment review** (the coach-first mode): steps only through your costliest moves, at most 3, ordered as the game went.
   - **Retry first.** Wording follows Lichess *Learn from your mistakes* ([retroView.ts](https://github.com/lichess-org/lila/blob/master/ui/analyse/src/retrospect/retroView.ts)): *"You played f6. Find a better move for black."* The board becomes playable.
   - Wrong: ✗ *"Not quite: that still loses material. Try another move."* Any move that keeps the winning chances within ~4 points of the best is accepted, as Lichess does (not only the engine's top move).
   - Right: ✓ *"Good move. That keeps your chances at 86%."*
   - Escape hatches: **"Show a hint"** (names the piece to move), **"Show solution"**, **"Skip"**.
   - Then the explanation: one or two fact sentences, plus a tactic-named reveal such as **"Show fork"**, **"Show lost piece"** or **"Show mate"** ([chess.com button names](https://support.chess.com/en/articles/8584089-how-does-game-review-work)).
   - **Habit link:** *"Leaving pieces hanging, your #1 habit: 3rd time in your last 10 games."* Links to Habits.
   - At the end: *"Done: 2 of 3 found."* Unsolved positions go into **Practice**.
3. **Every-move review:** normal stepping with arrow keys; the coach card shows the current move's grade and its one-line reason.

### 3.3 Classification system

Use chess.com's names, and keep our engine thresholds (already chess.com's expected-points bands, [help](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-move)).

| Class | Glyph | Colour (community reading of chess.com) |
|---|---|---|
| Great | `!` | blue `#5b8baf` |
| Best | ★ icon | green `#81b64c` |
| Excellent | 👍-shape icon | green `#98bc49` |
| Good | ✓ icon | muted green `#97af8b` |
| Inaccuracy | `?!` | yellow `#f4bf44` |
| Mistake | `?` | orange `#e28c28` |
| **Miss** (new) | `✕` | red-orange; "you missed a win": our `missed_*` tags already detect it |
| Blunder | `??` | red `#c93230` |

The icons will be drawn as SVG badges (a circle with a glyph), never emoji. They appear in three places: the board square, the scoresheet and the summary table.

**New: "game already decided".** Once your chances stay above 95% or below 5%, grades from that point are muted: shown in grey with the note *"The game was already decided"*. Players have asked chess.com for this ([forum](https://www.chess.com/forum/view/general/chesscoms-new-game-review-what-the-heck-happened?lc=1)).

### 3.4 Graph

- "Your winning chances", with the axis labelled in words: *Winning / Equal / Losing*.
- **Phase dividers** for opening/middlegame/endgame, as on Lichess's advantage chart ([division.ts](https://github.com/lichess-org/lila/blob/master/ui/chart/src/division.ts)).
- Key moments are numbered dots in their class colour. Click to jump. A cursor shows the current move.

### 3.5 Mobile (< 760px)

Board full width with both player strips, then a thin eval bar above the board instead of beside it, then the coach card, a **horizontal scrolling scoresheet strip**, and controls pinned to the bottom of the screen (thumb reach). The summary and key moments work the same way.

---

## 4. Habits (replaces "Patterns")

Players want one thing to work on, not a library ([Aimchess App Store reviews](https://apps.apple.com/us/app/aimchess-learn-chess-online/id1524941307)). Order:

1. **Your #1 habit:** a large card. *"You leave pieces hanging: in 6 of your last 10 games (it was 4 of 10 before)."* Show one real position from your games, and a primary button **"Practise 5 of these"**.
2. **Skill areas** (Aimchess's framing, built on our data): Opening · Tactics (found vs missed) · Defence (allowed vs avoided) · Endgame · Converting winning positions · Time management. Each has a 0–100 score from your own rates, and a trend arrow against your previous 20 games. Click into its positions.
3. **All habits:** a compact list with the rate in the last 10 games, the trend, and "see positions".
4. **Details** (collapsed tabs, for the data-curious and portfolio visitors): Phases · Clock · Openings · Results & endings · Method & validation. The interval charts move here.

Every number links to the games and positions behind it. chess.com Insights doesn't do this, and it's Diamond-only ([help](https://support.chess.com/en/articles/8708925-what-is-insights-on-chess-com)).

## 5. Practice (new)

- A queue of your own mistake positions: retries you failed, plus positions from your top habits.
- The same retry interaction as the review (§3.2). Spaced repetition: a miss comes back tomorrow, a hit in 3 days, then a week ([Noctie](https://noctie.ai/) shows this deck model works).
- **One session-sized goal:** *"Today: 5 positions, about 4 minutes."* No library.
- Progress is stored in the browser, so it works on a static site.

## 6. Games

A table with: date, colour, opponent (rating), result, accuracy, mistakes/blunders, and **the habit that cost the most in that game**. Filters for result and colour. Clicking a row opens the review on its summary.

## 7. Chrome extension (post-game)

- **Trigger:** chess.com's game-over card ("Black Won · By Checkmate · Game Review") or a finished-game URL `/game/live/<id>`. The extension stays completely inert during play (Fair Play).
- **Entry point:** a small card injected under chess.com's own Game Review button. It doesn't compete with chess.com and never uses "unlocker" framing.
- **The card shows three lines:**
  - *Biggest moment: 14. Nxb5, hung your knight*
  - *That's your #1 habit (6 of last 10 games)*
  - **[Retry it]** **[Full review →]**
- **Side panel (expands from the card):** the summary state of §3.2 with the key-moment retry, analysed in the browser with Stockfish WASM. "Full review" opens the website on that game.

## 8. Visual direction (after layout is right)

Layout and interaction first, styling second. The recommendation is to keep the chrome quiet and close to the category so the board and the classification colours do the work:
- one neutral surface family (light or dark, picked from the use scene)
- one sans for everything, with tabular numbers in tables
- a conventional board palette
- colour reserved for classifications and the current move

Identity can come from details, not costume: the coach card, the graph, and the habit links.

## 9. What exists vs. what's new

| Feature | Data today | New work |
|---|---|---|
| Scoresheet, classes, graph, arrows | ✓ | badges on the board, Miss class, decided-game muting, phase dividers |
| Coach sentences | ✓ (fact templates) | tie phrases to arrows; "Show fork/lost piece/mate" reveals |
| Retry | positions + best lines ✓ | playable board + move validation (`chessops`); acceptance by eval needs engine lines for alternative moves → in-browser Stockfish (also needed by the extension) |
| Habit link per moment | tags ✓, overview ✓ | rolling last-10 counts per habit in the export |
| Skill areas | rates ✓ | scoring formula + trend |
| Practice queue | positions ✓ | spaced-repetition store (localStorage) |
| Extension | | MV3 content script + side panel + Stockfish WASM |
