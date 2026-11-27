# Prophylaxis on a whiteboard

Eight decisions behind Prophylaxis, each the way I'd explain it standing at a whiteboard: what to draw, the
30-second answer, the numbers, and where a sharp interviewer would push. Every number links to the study it comes
from.

1. [Split the puzzles by game, not by puzzle](#1-split-the-puzzles-by-game-not-by-puzzle)
2. [Show the tactic model the engine's line](#2-show-the-tactic-model-the-engines-line)
3. [Shrink the models without changing their answers](#3-shrink-the-models-without-changing-their-answers)
4. [Check that "3 in 10 players find this" is true](#4-check-that-3-in-10-players-find-this-is-true)
5. [Rank habits with honest error bars](#5-rank-habits-with-honest-error-bars)
6. [Schedule practice with FSRS](#6-schedule-practice-with-fsrs)
7. [Run Stockfish on every spare core](#7-run-stockfish-on-every-spare-core)
8. [Add Lichess without touching the review](#8-add-lichess-without-touching-the-review)

---

## 1. Split the puzzles by game, not by puzzle

**Draw this**

```
one Lichess game ──► puzzle A (fork)    ┐
                 ──► puzzle B (fork)    ├── all go to the SAME split
                 ──► puzzle C (pin)     ┘

random split:   A → train, B → test     the model has seen B's position already
grouped split:  A, B, C → train         test only has games it never saw
```

**Say this.** Several puzzles come from the same game, often a few moves apart, with near-identical positions. If you
split puzzles at random, the test set is full of near-copies of training examples, and the score measures memory,
not skill. So the 80/10/10 split is grouped by source game, and stratified by each game's rarest theme so that rare
tactics like smothered mate show up in every split.

**Numbers.** 4.8 million puzzles: 3,845,004 train, 480,626 validation, 480,620 test. Every theme's share is within
0.05 points across the three splits, and a test checks it ([ml/REPORT.md](../ml/REPORT.md)).

**If they push.** *"How do you know the puzzle score transfers to real games?"* It doesn't fully, so there's a second
evaluation on mistakes from real chess.com games, also split by game: one half chooses which tactics the site may
name, the other half is scored once. Pins scored well on puzzles but a person accepted only about a third of them in
real games, so the site stopped naming pins.

---

## 2. Show the tactic model the engine's line

**Draw this**

```
v1 input: the position + the mistake                      32 planes of 8×8
v2 input: the position + the mistake + 4 moves of the     96 planes of 8×8
          engine's line, cut where the tactic is over
                         │
                         ▼
          ResNet, 8 blocks × 64 channels ──► 15 tactic scores, one threshold each
```

**Say this.** Lichess's own labeller reads the whole solution. A skewer or a mate in 2 often only becomes obvious a
move or two after the key move, so a model that sees one move is guessing. Version 2 adds the next four moves of the
engine's line, cut at mate or once one side is two points up. The site already has that line from Stockfish, so it
costs nothing at runtime.

**Numbers.** On the same 480,620 test puzzles, macro F1 across 15 themes: hand-written rules 0.27 (they can only name
5 of the 15), LightGBM on 84 handcrafted features 0.80, CNN v2 0.915. The browser version makes 0 of 7,209,300
decisions differently from Python ([ml/REPORT.md](../ml/REPORT.md)).

**If they push.** *"Isn't the rules baseline unfair?"* Yes, on all 15 it is. On the 5 themes the rules can name, they
score 0.80 and the CNN 0.96. The honest baseline is LightGBM. *"Where does the model lose?"* Hanging pieces: one
handcrafted feature, "the captured piece was undefended", gives LightGBM 0.876 against the CNN's 0.856.

---

## 3. Shrink the models without changing their answers

**Draw this**

```
Maia-3 fp32           21 MB   exact
dynamic int8         6.5 MB   int8 weights AND int8 arithmetic   ← drifted in the browser
w8 (weight-only)     5.8 MB   int8 weights, fp32 arithmetic       ← shipped

w8:  weight (int8) × scale per output channel ──DequantizeLinear──► fp32 weight ──► normal fp32 maths
```

**Say this.** The download is the cost users feel, so the weights are stored as int8, a quarter of the size. Dynamic
quantisation also does the arithmetic in int8, and the browser's WebAssembly kernels for that drifted from PyTorch.
Weight-only keeps int8 on disk and turns it back into fp32 when the model loads, so the arithmetic stays in fp32,
as in the original. One catch: the runtime's highest optimisation level fuses those weights straight back into int8 maths, so
the worker runs at the "basic" level.

**Numbers.** In the browser, the largest difference from PyTorch on 84 fixture positions is 0.014 in probability,
with the same top move in 83 of 84, and CI checks it on every push. Calibration is 0.7 points for w8 against 0.8 for
fp32 ([ml/results/maia.md](../ml/results/maia.md)). The tactic model's int8 version loses at most 0.005 F1 on any
theme.

**If they push.** *"Why not just ship fp32?"* 21 MB on a phone for one sentence per mistake isn't worth it. The site's
first visit is about 0.2 MB; models load only when a review needs them.

---

## 4. Check that "3 in 10 players find this" is true

**Draw this**

```
            Maia says   players actually found it
under 10%       4%            5%
20-35%         27%           26%
50-70%         60%           60%
over 90%       96%           95%
                 ╲  calibration: the two columns match
```

**Say this.** Maia-3 predicts how people at a given rating play. The review turns its probability into a sentence,
"about 3 in 10 players at your rating find this move", so the probability has to be calibrated: when it says 30%,
about 30% of real players must find it. Maia learned from Lichess, whose ratings run higher, so first I fitted a map
from chess.com ratings to Maia's scale on half the games, then measured everything on the other half.

**Numbers.** 284 chess.com games between players averaging under 1000. Calibration error 0.9 percentage points on
11,230 held-out moves. Maia predicts the move played 48% of the time, Stockfish's best move 33.5%. For the
opponent's punishing answer the error is 2.5 points, so the site rounds to "about N in 10"
([ml/results/maia.md](../ml/results/maia.md)).

**If they push.** *"Did you try recalibrating the 2.5?"* Yes: isotonic regression and Platt scaling, fitted on one
half and tested on the other. Neither helped on the held-out half, so neither shipped. *"Is it a prediction about this
player?"* No. It's a statement about players at that rating, and the copy says so.

---

## 5. Rank habits with honest error bars

**Draw this**

```
impact = (times per game) × (average winning chances lost each time)

"Left a piece hanging: 35% of games (27–44%)"
                              └── 90% Jeffreys interval: Beta(k + ½, n − k + ½)
```

**Say this.** A player has a few dozen games, so "35% of games" alone is falsely exact. Every rate carries a 90%
Jeffreys interval, which behaves well at small counts and at 0% or 100%, where the textbook normal interval breaks.
Habits are ranked by impact, how often it happens times how much it costs, so a rare blunder that loses the game
can outrank a frequent slip that costs little.

**Numbers.** The statistics are a port of the Python pipeline's `stats.py`, and both give the same shapes
([web/src/analysis/stats.ts](../web/src/analysis/stats.ts)). In Compare, one player's mistake rate counts as better only when
the two intervals don't overlap.

**If they push.** *"Why not a Bayesian model across players?"* There's no server and no other players' data, by
design. Per-player intervals are the most I can say honestly from one person's games.

---

## 6. Schedule practice with FSRS

**Draw this**

```
each position remembers:  stability S (days until recall drops to 90%)
                          difficulty D (1 to 10)

grade (again / hard / good / easy) ──► new S and D ──► next review when recall is expected to hit 90%
```

**Say this.** Practice positions come from your own mistakes. Instead of a fixed "see it again in 3 days", each one
has a small memory model, FSRS-5, the scheduler behind modern Anki. A clean first-try find brings the position back
in a few days, then at longer and longer gaps; a miss brings it back the next day. Positions that few players at
your rating would find come last, so the queue starts with what's worth fixing.

**Numbers.** FSRS-5's published default parameters, fitted by its authors on about 10,000 Anki collections. A check
replays 320 reviews over 40 histories against the reference implementation and finds 0 differences
([web/scripts/check-fsrs.ts](../web/scripts/check-fsrs.ts)).

**If they push.** *"Why not fit your own parameters?"* That needs hundreds of reviews per user. Defaults are the
right starting point; fitting is a later step once there's data.

---

## 7. Run Stockfish on every spare core

**Draw this**

```
cores − 1 (max 6; max 2 on phones)  ──►  N Stockfish Web Workers = N lanes
one game's positions ──► spread across lanes ──► each lane runs its searches in order

first visit: 1–2 s speed check ──► ms per move ──► "how many games fit in ~5 minutes?"
every finished game corrects the estimate
```

**Say this.** There's no server, so the user's device does the analysis. The pool runs one engine per spare core,
leaving one for the page, and reads a game's positions in parallel. Each lane runs its searches in a fixed order, so
the same game gets the same answers every time on the same device. A short speed check sets how many games to review
on the first visit; a slow device reviews fewer games at the same depth, never shallower ones, so quality doesn't
depend on the phone.

**Numbers.** Your latest game is reviewed in seconds on a laptop. The first visit reviews about five minutes' worth,
at least 5 games so Habits has something to show. Reviewing pauses on low battery when not charging.

**If they push.** *"Why not WebGPU or a bigger engine?"* Stockfish's search is CPU-bound and branchy; the Lite build
in WebAssembly is the portable choice. *"What about time measurements when the tab is hidden?"* Those games don't
update the speed estimate.

---

## 8. Add Lichess without touching the review

**Draw this**

```
chess.com API ──► chesscom.ts ─┐
                               ├──► one game shape ──► review · habits · practice · compare (unchanged)
Lichess API   ──► lichess.ts  ─┘
                                    player id:  "name"  or  "lichess:name"
```

**Say this.** Everything downstream of fetching was written against chess.com's game format, so Lichess games are
translated into that shape at the edge: results, time controls, openings, ratings. A Lichess player is stored as
`lichess:name`, so two people with the same username on the two sites never share stored games. Two things don't
translate and are handled explicitly: Maia reads Lichess ratings as they are, since it learned from Lichess, and the
Chrome extension stays chess.com-only.

**Numbers.** Three new files; the review and statistics code changed only to read the player's name and one new
draw code. A
returning visit asks Lichess only for games newer than the newest one kept.

**If they push.** *"Why translate instead of a shared internal format?"* A shared format is cleaner long-term, but it
would touch every file that reads a game. Translating at the edge shipped in a day with no risk to the review.
If a third site arrives, that's the time to introduce the neutral format.
