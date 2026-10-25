# Tactic classifier: report

PLAN.md §7.1. A model that looks at one of your mistakes and names the tactic behind it: a fork, a pin, a
skewer, a discovered attack, a hanging piece, a back-rank mate. It is measured against the hand-written rules
the site already used, first on Lichess puzzles and then on real beginner games. It is put in the browser only for
the themes where it beats the rules on both.

## What it is for

Stockfish says how much a move cost; the rules said why only for a few kinds of mistake, and filed the rest as
"you lost material" or "you missed a winning tactic". Those generic tags don't teach anything. The model names
them, and every name feeds the rest of the site:

- **Habits.** "Walking into pins: 3 of your last 10 games" becomes a ranked habit, with its own advice, and counts
  towards the piece-safety and spotting-tactics skills.
- **The board.** In a review, arrows show the tactic on your own board: the forking piece and both targets, or the
  pinning bishop through your knight to your king.
- **Practice.** Each habit links to Lichess puzzles of that tactic, at your level, getting harder as you solve them.
  The loop is: a review names your mistake, the Habits page counts how often you make it, and the puzzles train it.

## Result

| | Rules | LightGBM | CNN v1 | **CNN v2 (shipped)** |
|---|---:|---:|---:|---:|
| Input | engine line | position + move (84 features) | position + move (32 planes) | position + move + engine line (96 planes) |
| Puzzle test, macro F1 over 15 themes | 0.268 | 0.800 | 0.806 | **0.914** |
| Real beginner games, pin / discovered attack / skewer / trapped piece F1 | 0 / 0 / 0 / 0 | – | 0.65 / 0.69 / 0.56 / 0.64 | **0.81 / 0.89 / 0.83 / 0.78** |
| Real beginner games, fork F1 | 0.81 | – | 0.82 | **0.91** |

- **The shipped model:** a 915k-parameter ResNet, 0.98 MB as int8 ONNX. It runs in the browser in onnxruntime-web.
- **Where the rules still win:** mate-in-2 (puzzles 0.998 against 0.991; real games 1.00 against 0.90). The site
  keeps the rules for mates.
- **What changed from v1 to v2:** the model now also sees the next moves of the engine's line, which the site has
  anyway, and it trained on all 4.8M eligible puzzles instead of 40% of them.
- **Data:** everything here is Lichess data (puzzles and games, CC0) and the site's synthetic sample player. No
  chess.com games were used, and none of the owner's.

## Reproduce

Needs [uv](https://docs.astral.sh/uv/), Stockfish, Node 22+ and `npm --prefix web install`.

```bash
cd ml
uv sync
uv run tactics all     # every step below, in order, each in its own process
uv run pytest
```

| Step | Does | Time (M5 MacBook) |
|---|---|---|
| `fetch` | downloads the Lichess puzzle database (293 MB) | 1 min |
| `data` | builds the train/val/test split | 3 min |
| `rules` | scores the Python and TypeScript rules | 1 min |
| `encode` | handcrafted features and bit-packed board planes | 20 min |
| `lgbm` | LightGBM, one booster per theme | 35 min |
| `cnn` | the CNN on the GPU (MPS) | 55 min |
| `export` | int8 ONNX into `web/public/models/` | 2 min |
| `web` | scores the model as the browser runs it | 20 min |
| `fixtures`, `report`, `analysis` | parity fixtures, `results/metrics.md`, `results/analysis.json` | 5 min |
| `games`, `blunders` | 10,000 real games; Stockfish finds the blunders | 3 h on 7 cores |
| `real` | scores the real blunders and decides what ships | 3 min |
| `bundle` | practice puzzles into `web/public/puzzles/` | 1 min |

- **Resuming.** Each step reads the previous one's output from `ml/data/` (ignored by git), so any step can be
  re-run alone. The Stockfish scan caches every game, so an interrupted run resumes.
- **Seeds** are fixed.
- **OpenMP on macOS.** LightGBM's macOS wheel links against Homebrew's OpenMP; without it, `tactics/gbm.py` re-runs
  itself with the copy scikit-learn ships.
- **What gets committed:** the code; the shipped model and its `tactics.json`; the practice puzzles; the summary
  numbers in `ml/results/`; and a small encoder fixture.

## Data

- **Source:** the [Lichess puzzle database](https://database.lichess.org/#puzzles), downloaded 2026-10-24:
  6,157,341 puzzles.
- **Filter:** puzzle rating ≤ 2000 (beginner to intermediate), at least 20 plays, popularity ≥ 0. That leaves
  **4,806,250 puzzles**, all of them used.
- **Example:** a puzzle's FEN is the position *before* the opponent's move. Its first move is that opponent's
  mistake. Each example is the position after that move, plus the solution, plus the puzzle's themes.
- **Themes (15):** mateIn1, mateIn2, fork, pin, discoveredAttack, deflection, hangingPiece, attraction,
  backRankMate, promotion, skewer, trappedPiece, capturingDefender, doubleCheck, smotheredMate. 25% of puzzles have
  none of them and stay in as all-negative examples.
- **Split:** 80 / 10 / 10, **grouped by source game** (all puzzles from one game land in the same split) and
  **stratified by theme** (each game is stratified by the rarest theme among its puzzles). That gives 3,845,004 /
  480,626 / 480,620 puzzles, with every theme's share within 0.05 points across splits (`tests/test_dataset.py`).

## The approaches

### Rules: the baseline

These are `src/coach/motifs.py` and its TypeScript port, `web/src/analysis/motifs.ts`. A puzzle goes through
`motifs.detect` exactly as a blunder does in a game: the opponent's first move is the mistake, and the solution
plays the part of the engine's reply. Tags map to themes (`hanging_piece` → hangingPiece, and so on), and the rules
can name 5 of the 15. On all 480,620 test puzzles, **the Python and TypeScript rules agree on every one.**

**A bug the baseline found.** The back-rank rule's docstring said the king is "boxed in by its own pawns", but its
code never checked it. Its precision against Lichess was 0.28. It now requires every square in front of the king to
hold one of its own pieces, with tests, which raises its F1 from 0.43 to 0.78. Almost all the false positives left
are mates where a boxing piece is also attacked; Lichess's labels exclude that case, and the site's text doesn't.

### LightGBM on 84 handcrafted features

What a coach looks at, computed with python-chess (`tactics/features.py`):
- material and the move itself;
- whether the captured piece was loose and what it defended;
- the safety of the moved piece and what it now attacks;
- discovered attacks, pin- and skewer-shaped lines, x-rays, pinned pieces;
- loose material before and after the move, and trapped pieces;
- both kings' escape squares and back ranks, replies, and pawns about to promote.

There is one booster per theme. The top features by gain are the ones you would hope for (fork: `hits_winnable`,
`hits_king`; pin: `their_pinned_after`, `pin_lines`; hangingPiece: `captured_loose`).

### CNN v1: the position and the move

32 planes of 8×8, seen from the side to move: pieces before and after the move, the from-square and to-square,
both sides' attack counts before and after, and whether the move gives check or mate. The network is a ResNet with
6 residual blocks of 64 channels and a head that keeps the board layout. It was trained on 40% of the puzzles. This
is the model the previous version of this report shipped.

### CNN v2: the position, the move and the engine line (shipped)

Lichess's labeller reads the whole solution. A skewer or a mate-in-2 is often only clear one or two moves after
the key move. So v2 adds 16 planes for each of the **next 4 moves of the line**: the pieces after it, its from- and
to-squares, a "move present" plane and a "checkmate" plane. That makes 96 planes in all (`tactics/planes.py`).

- **Which line.** The line is cut where the tactic is over: at mate, or at the first move after which the side to
  move is at least 2 points up and still is after the reply. Where the line has no such point, only the first move
  is used. Training puzzles, the site and the real-game evaluation all cut lines the same way. The TypeScript port
  in `web/src/analysis/planes.ts` is identical on all 114 fixture positions.
- **Network:** 8 residual blocks of 64 channels. Trained on all 3.8M training puzzles for 6 epochs (9 minutes each
  on MPS), with left–right mirroring. The planes are stored bit-packed, about 1 KB per example.
- **Thresholds:** per theme, chosen to maximise F1 on the validation split. The test split is scored once.

## Results on puzzles (test split, 480,620 puzzles)

| Theme | Test n | Rules | LightGBM | CNN v2 | CNN v2 int8 (P / R) | In the browser |
|---|---:|---:|---:|---:|---:|---:|
| mateIn1 | 87,720 | 0.998 | 0.998 | 0.998 | 0.998 (1.00 / 1.00) | 0.998 |
| mateIn2 | 77,620 | **0.998** | 0.859 | 0.992 | 0.991 (0.99 / 0.99) | 0.991 |
| fork | 66,332 | 0.685 | 0.875 | **0.956** | 0.955 (0.97 / 0.94) | 0.955 |
| pin | 26,296 | 0 | 0.776 | **0.835** | 0.834 (0.90 / 0.78) | 0.834 |
| discoveredAttack | 24,733 | 0 | 0.797 | **0.930** | 0.930 (0.96 / 0.91) | 0.930 |
| deflection | 20,218 | 0 | 0.610 | **0.898** | 0.898 (0.93 / 0.87) | 0.898 |
| hangingPiece | 18,137 | 0.557 | **0.876** | 0.856 | 0.855 (0.82 / 0.90) | 0.855 |
| attraction | 16,276 | 0 | 0.802 | **0.921** | 0.921 (0.95 / 0.90) | 0.921 |
| backRankMate | 19,973 | 0.780 | 0.900 | **0.988** | 0.988 (0.99 / 0.99) | 0.988 |
| promotion | 11,080 | 0 | 0.698 | **0.906** | 0.906 (0.94 / 0.87) | 0.906 |
| skewer | 11,549 | 0 | 0.698 | **0.938** | 0.938 (0.96 / 0.92) | 0.938 |
| trappedPiece | 5,210 | 0 | 0.706 | **0.790** | 0.790 (0.78 / 0.80) | 0.790 |
| capturingDefender | 3,161 | 0 | 0.568 | **0.796** | 0.791 (0.84 / 0.75) | 0.791 |
| doubleCheck | 2,412 | 0 | 0.869 | **0.928** | 0.929 (0.97 / 0.89) | 0.929 |
| smotheredMate | 2,406 | 0 | 0.972 | **0.991** | 0.991 (0.99 / 0.99) | 0.991 |
| **Macro F1, all 15** | | 0.268 | 0.800 | 0.915 | 0.914 | 0.914 |
| **Macro F1, the 5 the rules can name** | | 0.804 | 0.901 | 0.958 | 0.958 | 0.958 |

`uv run tactics report` regenerates this table as `results/metrics.md`.

- **The int8 model loses at most 0.005 F1** on any theme to the full-precision one.
- **In the browser** means the same file run the way the site runs it: TypeScript planes and onnxruntime-web on
  WebAssembly. It makes **0 of 7,209,300 theme decisions** differently from Python's onnxruntime.
- **CNN v1 can't be shown in this table,** because it was trained on a different 40% sample, and some of this test
  split was in its training data. On its own 192,067-puzzle test split it scored 0.807 macro F1, against 0.791 for
  LightGBM. The fair comparison with v2 is on real games, below, which neither model saw.
- **Where LightGBM still wins:** hangingPiece. One handcrafted feature, "the captured piece was undefended", carries
  almost all of that theme.

**By puzzle rating** (rules → v2, test split): the model is best on the easiest puzzles, which are the closest to
what beginners meet.

| Rating | Puzzles | fork | hangingPiece | backRankMate | pin | skewer | Macro F1 |
|---|---:|---|---|---|---|---|---:|
| < 1000 | 137,592 | 0.85 → 0.99 | 0.32 → 0.85 | 0.80 → 0.99 | 0 → 0.92 | 0 → 0.98 | 0.935 |
| 1000–1399 | 154,200 | 0.70 → 0.97 | 0.60 → 0.87 | 0.76 → 0.98 | 0 → 0.89 | 0 → 0.96 | 0.935 |
| 1400–2000 | 188,828 | 0.51 → 0.91 | 0.64 → 0.85 | 0.62 → 0.94 | 0 → 0.79 | 0 → 0.88 | 0.884 |

## Results on real beginner games

Puzzles are curated. To check that the model works on the mistakes beginners actually make, it was also scored on
real games (`tactics/games.py`; `results/games.md`, `results/games.json`).

- **Games:** the first 10,000 games in the September 2026 Lichess database that are rated rapid, between two
  players rated 1300 or less, and ended normally or on time. Any game that produced a training puzzle was dropped
  first. That is roughly chess.com 600–1000; the blunders' games average 1011.
- **Blunders:** Stockfish 19 read every position at 50,000 nodes. A blunder loses at least 20 points of winning
  chances and leaves the opponent at 70% or better. Each one then got a 1M-node search with two lines, and was kept
  only if the best punishment beats the second best by 15 points, and its line wins material or mates within 7
  plies. Lichess builds its puzzles the same way. That gives **10,324 blunders from 6,181 games**. 59% are punished
  in a single move, mostly by taking a free piece.
- **Labels:** Lichess's own puzzle tagger (`cook.py` from lichess-puzzler, AGPL). It is downloaded at a pinned commit
  (the last one before a 2026-10-23 change to how forks are tagged), checked against pinned hashes, and never
  committed. On 5,000 of our test puzzles it gives back the database's themes in all but 1 of 4,107 cases, so these
  labels mean what the training labels meant.
- **Two halves, split by game.** The *val* half (5,163 blunders) decides which themes the site may use. The *test*
  half (5,161 blunders, 3,090 games) is only reported.

**Test half** (F1 with a 90% interval from resampling whole games):

| Theme | Blunders | Rules | CNN v1 | CNN v2 (P / R) | What the site shows |
|---|---:|---:|---:|---:|---:|
| hangingPiece | 1,894 | 0.86 (0.84–0.87) | 0.93 | 0.93 (0.97 / 0.89) | 0.86 (0.85–0.87) |
| fork | 582 | 0.81 (0.79–0.83) | 0.82 | **0.91** (0.87 / 0.95) | 0.87 (0.85–0.88) |
| mateIn1 | 277 | 1.00 | 1.00 | 1.00 | 1.00 |
| pin | 214 | 0 | 0.65 | **0.81** (0.84 / 0.78) | 0.81 (0.77–0.84) |
| trappedPiece | 197 | 0 | 0.64 | **0.78** (0.79 / 0.77) | 0.78 (0.73–0.81) |
| discoveredAttack | 152 | 0 | 0.69 | **0.89** (0.90 / 0.87) | 0.89 (0.85–0.92) |
| mateIn2 | 86 | **1.00** | 0.75 | 0.90 (0.82 / 1.00) | 1.00 |
| promotion | 60 | 0 | 0.68 | 0.95 (0.95 / 0.95) | not shown |
| deflection | 57 | 0 | 0.52 | 0.86 (0.89 / 0.84) | not shown |
| skewer | 53 | 0 | 0.56 | **0.83** (0.78 / 0.89) | 0.83 (0.76–0.89) |
| backRankMate | 29 | 0.74 (0.64–0.83) | 0.95 | 0.92 (0.85 / 1.00) | 0.92 (0.86–0.97) |
| attraction | 24 | 0 | 0.38 | 0.79 (0.72 / 0.88) | not shown |
| capturingDefender | 23 | 0 | 0.39 | 0.67 (0.61 / 0.74) | not shown |

The CNN v1 column is the previous shipped model, run once on the same blunders.

- **The line input is what made the difference on real games.** From v1 to v2: pin 0.65 → 0.81, discovered attack
  0.69 → 0.89, skewer 0.56 → 0.83, trapped piece 0.64 → 0.78, fork 0.82 → 0.91. v1's skewers were wrong about
  half the time, and the site stopped naming them; v2's pass the bar.
- **Back-rank mate dips slightly** (0.95 → 0.92), on 29 cases; the intervals overlap.
- **Real games are a little harder than puzzles** for the same model (pin 0.83 → 0.81, trapped piece 0.79 → 0.78,
  fork 0.96 → 0.91), but not by much.
- **The rules stay perfect on mates.**
- **When there's nothing to name:** on the 1,712 test-half blunders with none of the 15 themes, the model names one
  for 9.9% of them. On puzzles with none, it does so for 6.5% (v1: 16.6%; the rules: 9.7%).

**What ships**, decided on the val half (`real` step). A theme the model beat the rules on in the puzzle test must
also beat them on real blunders, with **precision of at least 0.6, on at least 20 cases**:

- **Shipped**, with val-half F1 (rules' F1 in brackets where they can name it) and precision:
  - fork 0.93 (0.81), 0.89
  - hangingPiece 0.92 (0.85), 0.98
  - pin 0.83, 0.83
  - discoveredAttack 0.86, 0.87
  - skewer 0.82, 0.76
  - trappedPiece 0.74, 0.78
  - backRankMate 0.87 (0.71), 0.77
  - deflection 0.88, 0.86
  - promotion 0.85, 0.88
  - capturingDefender 0.75, 0.70

  The site names only the first seven; the last three it doesn't show.
- **Not shipped:** attraction, doubleCheck, smotheredMate, each with fewer than 20 real cases to judge them on.

### Puzzles score a definition

A label is Lichess's definition of a theme, and for two themes that definition is narrower than the site's tag:

- **Hanging piece.** The site's tag means a piece "could be taken for free or by a cheaper piece". Lichess calls a
  piece hanging only when it is undefended. Of the test puzzles where the rules say hangingPiece and Lichess
  doesn't, 59% are a defended piece taken by a cheaper one.
- **Fork.** Lichess leaves out a fork when the forking piece can itself be won. Of the puzzles where the rules see
  a fork and Lichess doesn't, 72% are exactly that. A knight that checks the king and attacks the queen is still a
  fork to a beginner.

An earlier version let the model overrule the rules on these two themes. On the sample player it removed 8 correct
hanging-piece tags and called a royal knight fork a "pin". So for forks and hanging pieces the site keeps the
rules' tag, which the engine's line has confirmed, and the model only adds the name where the rules had none. On
real games that combination scores 0.87 on fork and 0.86 on hanging piece. That is below the model alone (which
matches Lichess's definition), by design, and still above the rules alone.

## In the browser

- **Export** (`tactics/export.py`). The model goes to ONNX (opset 17, sigmoid included) and is statically quantised
  to int8: QDQ, per-channel weights, 2,048 calibration positions. The sigmoid stays in float, so probabilities
  don't snap to steps of 1/255. The result is **0.98 MB**; fp32 is 3.66 MB. `tactics.json` holds the themes,
  thresholds, the shipped themes and a version (a hash of the model).
- **Runtime.**
  - `web/src/analysis/tactics.worker.ts` runs onnxruntime-web 1.30.0, WebAssembly on one thread, in its own Web
    Worker. It loads on the first review: a 14 MB runtime (3.7 MB gzipped) plus the model. The extension's offscreen
    page uses the same worker, and runs under the extension's security policy.
  - If the model can't load within 30 s, or the worker fails, reviews use the rules alone.
- **How tags change** (`web/src/analysis/tactics.ts`).
  - The rules still decide *whether* a move lost or missed material, and how much, from Stockfish's lines.
  - Only where they could not say how (`lost_material`, `missed_tactic`) is the model asked. It sees the position
    after your move with the opponent's best line, or the position before it with your best line.
  - The first shipped theme it sees names the tag, in the order hanging piece, fork, discovered attack, pin, skewer,
    trapped piece. For allowed mates, the model decides `back_rank_mate`.
  - There are eight model-named tags (pin, skewer, discovered attack and trapped piece, each allowed or missed),
    each with its own habit text in `catalog.ts` and `stats.py`.
- **Older reviews are re-tagged.**
  - Each saved review records the model version that tagged it.
  - When the site opens, reviews from an older model, or from none, are re-tagged from the engine lines they stored.
    No Stockfish search is needed: the sample player's 36 games take 37 ms.
- **Practice puzzles** (`tactics/bundle.py`, `web/src/lib/puzzles.ts`, `web/src/pages/Puzzles.tsx`).
  - For each tactic: well-liked Lichess puzzles with settled ratings, 400–1700, at most three moves to find, 50 per
    100 rating points. That is about 5,400 puzzles, 0.5 MB.
  - They start near the player's level (chess.com rating + 400), and move 40 points up after a first-time solve and
    40 down otherwise, per habit.
- **The tactic on the board** (`web/src/lib/shapes.ts`).
  - Next to the move's arrow, thin arrows go to every piece it newly attacks, from the moved piece or a piece it
    uncovers. For a long-range piece, the arrow continues to a second piece behind.
  - This is geometry, not the model, so it can't be wrong about what is attacked. It also only shows attacks, not
    the full idea.

## Effect on the sample player

The sample player's reviews were rebuilt with `web/scripts/make-sample-reviews.mjs`. Every engine value and move
grade is identical to the rules-only version. Two tags changed, both generic tags the model named: s20 move 30
(Ra6; the best move Nc4+ was a discovered attack) and s27 move 13 (Nc2; exf5 started a pin). The sample is a weak
engine's games, with few tactics, so this shows the model is careful, not that it is right; the real-game test
above is the evidence for that.

## Honest limits

- **The labels come from a program.** Lichess's tagger is itself a set of hand-written rules. So the model learned
  to agree with another rule set, and on real games it does (pin 0.81, discovered attack 0.89). "Agrees with
  Lichess's tagger" is not the same as "a coach would agree". A small check by a person would still add something,
  and it can be done with yes/no questions about the board.
- **The model sees the line that defines the label.** On puzzles, the line is the solution the tagger labelled;
  on real games, it is Stockfish's line, cut the same way, and the labels come from that same line. That is by
  design, since the site has the engine's line, but it makes the task easier than "name the tactic from the
  position alone". v1 did that harder task and scored 0.81 on puzzles.
- **Rare themes have little real evidence.** Attraction, double check and smothered mate had fewer than 20 real
  blunders in the deciding half, so the site doesn't use them. Back-rank mate shipped on 29 test cases; its
  interval is wide (0.86–0.97).
- **Lichess, not chess.com.** The real games are Lichess rapid games, rated 1300 or less. A chess.com 225 player is
  weaker than most of them.
- **The puzzle split for v2 is not v1's.** Comparisons between the two models are made on real games, which neither
  trained on.
- **The Python pipeline (`src/coach/`) uses only the rules.** It knows the new tags' wording but never emits them.
