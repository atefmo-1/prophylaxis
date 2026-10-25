# Tactic classifier: report

PLAN.md §7.1. A model that looks at a position and a move and names the tactic: fork, pin, hanging piece,
back-rank mate and so on. It is measured against the hand-written motif rules the site already uses, and it is
put in the browser only for the themes where it beats them.

**Result.** A 730k-parameter ResNet on board planes, quantised to int8 (0.78 MB), reaches a macro F1 of 0.807
over 15 themes on 192,067 held-out Lichess puzzles. The rules score 0.245, because they can name only 5 of the 15
themes. On those 5 the CNN scores 0.920 and the rules 0.736. The rules still win on mate-in-2 (0.998 against
0.919) and tie on mate-in-1, so the site keeps the rules' tags for mates.

In the site, the model names the mistakes the rules could only call "lost material" or "missed tactic": pins,
skewers, discovered attacks and trapped pieces. It also decides back-rank mates, where the rule has a bug. It does
*not* overrule the rules' hanging-piece and fork tags, although its puzzle F1 is higher there. Most of the rules'
"errors" on those two themes come from a difference in definition: Lichess labels only undefended pieces as
hanging, and leaves out forks whose forking piece can be taken. They are not wrong calls. On the sample player,
letting the model veto those tags removed correct ones (see "Puzzles score a definition").

Everything here is Lichess puzzle data and the synthetic sample player. No chess.com games were used, and none of
the owner's.

## Reproduce

Needs [uv](https://docs.astral.sh/uv/), Node 22+ and `npm --prefix web install`. Node runs the TypeScript rules
and the browser runtime.

```bash
cd ml
uv sync
uv run tactics all     # fetch, data, rules, encode, lgbm, cnn, export, web, fixtures, report, analysis
uv run pytest
```

`all` runs each step in its own process. Each step reads the previous step's output from `ml/data/`, which git
ignores, so a single step can be re-run on its own (`uv run tactics cnn`). On an M5 MacBook the whole run takes
about 45 minutes: 5 min of data and encoding, 7 min of LightGBM, 23 min for the CNN on MPS, and 6 min to score the
model in onnxruntime-web. Seeds are fixed. LightGBM's macOS wheel links against Homebrew's OpenMP; if that is
missing, `tactics/gbm.py` re-runs the process with the copy that scikit-learn ships.

What gets committed: the code, the shipped model (`web/public/models/tactics.onnx` and `tactics.json`), the
summary numbers (`ml/results/`) and a small encoder fixture (`ml/tests/fixtures/planes.json`, 110 positions). The
raw database, the splits, the encoded arrays and the checkpoints all stay in `ml/data/` and `ml/models/`.

## Data

- **Source:** the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0), downloaded
  2026-10-24: 6,157,341 puzzles (`tactics/fetch.py`; resumes, and skips the download if the file is already
  complete).
- **Filter:** puzzle rating ≤ 2000 (beginner to intermediate; about 80% of the database), at least 20 plays, and
  popularity ≥ 0, which drops puzzles that players voted down.
- **Sample:** 40% of the eligible puzzles, chosen by a hash of the puzzle id (deterministic): **1,920,746
  puzzles**.
- **Example:** a puzzle's FEN is the position *before* the opponent's move. Its first move is that opponent's
  mistake, and the rest is the solution. Each example is the position after the first move (the puzzle
  position) plus the key move (the solution's first move). The labels are the puzzle's themes.
- **Themes (15):** mateIn1, mateIn2, fork, pin, discoveredAttack, deflection, hangingPiece, attraction,
  backRankMate, promotion, skewer, trappedPiece, capturingDefender, doubleCheck, smotheredMate. These are chosen
  for beginner and intermediate players. Lichess's other tags were left out: phase (endgame, middlegame), length
  (short, long), evaluation (crushing, advantage), and themes that are rare or advanced (xRayAttack,
  interference, zugzwang, and the named mates beyond smothered). 25% of the puzzles carry none of the 15 themes
  and stay in the data as all-negative examples.

### Split

80 / 10 / 10, **grouped by source game** and **stratified by theme**. Every puzzle from one Lichess game lands in
the same split, so positions from one game can't leak between train and test. Each game's stratum is the rarest
of the 15 themes among its puzzles ("none" if it has none). Games are shuffled within each stratum and dealt out
by puzzle count (`tactics/dataset.py`, tested in `tests/test_dataset.py`).

| Split | Puzzles | mateIn1 | fork | pin | hangingPiece | backRankMate | skewer | smotheredMate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| train | 1,536,603 | 18.2% | 13.8% | 5.5% | 3.8% | 4.2% | 2.4% | 0.50% |
| val | 192,076 | 18.2% | 13.8% | 5.5% | 3.8% | 4.2% | 2.4% | 0.50% |
| test | 192,067 | 18.2% | 13.8% | 5.5% | 3.8% | 4.2% | 2.4% | 0.50% |

All 15 themes are within 0.05 percentage points across the three splits (`results/metrics.json` has the counts).

## The three approaches

### 1. Rules: the baseline

These are the existing detectors, `src/coach/motifs.py`, and their TypeScript port in
`web/src/analysis/motifs.ts`, unchanged. The detectors work from engine lines, and a puzzle supplies one: the
opponent's first move is "my move" and the solution is "the engine's reply". So each puzzle goes through
`motifs.detect` exactly as a blundered game move goes through its "what the move allowed" branch. The mate score
is taken from the solution: if the line ends in mate, it is mate in ⌈plies / 2⌉. The win-% loss is set high
enough that every detector runs (`tactics/rules.py`). Tags map to themes as follows:

- `hanging_piece` → hangingPiece
- `allowed_fork` → fork
- `allowed_mate` {in: 1 or 2} → mateIn1 or mateIn2
- `back_rank_mate` → backRankMate

The rules cannot name the other 10 themes, so their F1 there is 0.

`web/scripts/rules-on-puzzles.ts` runs the TypeScript rules over the same split. **The Python and TypeScript
rules agree on all 192,067 test puzzles.**

### 2. LightGBM on handcrafted features

84 features of the position and the move, computed with python-chess (`tactics/features.py`):

- material and the move: what moved, what it captured, check, mate, double and discovered check;
- whether the captured piece was loose and what it defended;
- the safety of the moved piece;
- what it attacks afterwards: the count, the value, how many could be won, and the king;
- discovered attacks by my other sliders;
- pin- and skewer-shaped lines and x-rays;
- pinned pieces before and after;
- loose enemy material before and after;
- trapped pieces;
- both kings: escape squares, back rank, shield, pressure, sealed back rank;
- reply counts, and pawns about to promote.

There is one binary booster per theme, with early stopping on validation (`tactics/gbm.py`). The most important
features by gain are what you would hope for:
- **fork:** `hits_winnable`, `threat_after_best`, `to_attackers`, `hits_king`;
- **pin:** `their_pinned_after`, `pin_lines`;
- **hangingPiece:** `captured_loose`, `captured_value`.

### 3. CNN on board planes

The input is 32 planes of 8×8, seen from the side to move. Ranks are flipped and colours swapped when black is
to move, so a tactic looks the same for either colour (`tactics/planes.py`):

- 12 piece planes before the move, and 12 after it;
- the from-square and the to-square;
- per-square attack counts for each side, before and after the move;
- two constant planes: the move gives check, and the move is mate.

The network is a ResNet with a 3×3 stem, 6 residual blocks of 64 channels, and a head that keeps the board layout
(1×1 conv to 16 channels, then flatten, 256, 15), because tactics happen on particular squares. Training uses
multi-label BCE, AdamW and a one-cycle learning rate: 10 epochs at batch size 1024 on MPS, about 2.3 minutes per
epoch. Positions are mirrored left to right at random; the planes carry no castling rights, so a mirrored tactic
is the same tactic. On the first run (720k puzzles, no mirroring) the model overfitted after epoch 9 and scored
a macro F1 of 0.769. More data and mirroring removed the overfitting: validation loss fell every epoch, to 0.038.

All three predictors use per-theme thresholds that maximise F1 on **validation**; the test split is scored once
at those thresholds.

## Results (test split, 192,067 puzzles)

| Theme | Test n | Rules F1 | LightGBM F1 | CNN F1 | CNN int8 F1 (P / R) | In the browser F1 | Best | Site uses |
|---|---:|---:|---:|---:|---:|---:|---|---|
| mateIn1 | 34,920 | 0.998 | 0.998 | 0.998 | 0.998 (1.00 / 1.00) | 0.998 | rules (tie) | rules |
| mateIn2 | 30,968 | **0.998** | 0.854 | 0.919 | 0.919 (0.91 / 0.93) | 0.918 | rules | rules |
| fork | 26,490 | 0.688 | 0.875 | **0.884** | 0.884 (0.93 / 0.84) | 0.884 | CNN | rules' tag, model adds |
| pin | 10,537 | 0.000 | **0.771** | 0.757 | 0.758 (0.86 / 0.68) | 0.758 | LightGBM | model |
| discoveredAttack | 9,877 | 0.000 | **0.786** | 0.780 | 0.779 (0.83 / 0.73) | 0.779 | LightGBM | model |
| deflection | 8,077 | 0.000 | 0.587 | **0.670** | 0.669 (0.68 / 0.66) | 0.669 | CNN | not shown |
| hangingPiece | 7,218 | 0.567 | **0.871** | 0.826 | 0.825 (0.77 / 0.89) | 0.825 | LightGBM | rules' tag, model adds |
| attraction | 6,496 | 0.000 | 0.798 | **0.812** | 0.812 (0.86 / 0.77) | 0.812 | CNN | not shown |
| backRankMate | 7,980 | 0.430 | 0.895 | **0.973** | 0.973 (0.97 / 0.97) | 0.973 | CNN | model |
| promotion | 4,414 | 0.000 | **0.702** | 0.699 | 0.699 (0.68 / 0.72) | 0.699 | LightGBM | not shown |
| skewer | 4,632 | 0.000 | 0.675 | **0.744** | 0.747 (0.79 / 0.71) | 0.747 | CNN | model |
| trappedPiece | 2,071 | 0.000 | **0.686** | 0.679 | 0.678 (0.64 / 0.72) | 0.678 | LightGBM | model |
| capturingDefender | 1,253 | 0.000 | **0.518** | 0.484 | 0.484 (0.50 / 0.47) | 0.484 | LightGBM | not shown |
| doubleCheck | 982 | 0.000 | 0.876 | **0.889** | 0.889 (0.97 / 0.82) | 0.889 | CNN | not shown |
| smotheredMate | 959 | 0.000 | 0.974 | **0.982** | 0.984 (0.98 / 0.99) | 0.984 | CNN | not shown |
| **Macro F1, all 15** | | 0.245 | 0.791 | 0.806 | 0.807 | 0.807 | | |
| **Macro F1, the 5 the rules can name** | | 0.736 | 0.899 | 0.920 | 0.920 | 0.920 | | |

`uv run tactics report` regenerates this table as `results/metrics.md`. There, the last column records which
themes the model beat the rules on ("Model trusted"). Here it says what the site does with each theme (see "In the
browser").

- **CNN int8** is the shipped ONNX model under Python's onnxruntime, with thresholds re-chosen on validation for
  the quantised model. **In the browser** is the same file run the way the site runs it: TypeScript planes
  (`web/src/analysis/planes.ts`) and onnxruntime-web on WebAssembly (`web/scripts/tactics-on-puzzles.ts`).
  The two make 9 of 2,881,005 theme decisions differently.
- **Trusted** themes are decided by test F1, as the task asked: the model is trusted for a theme only if it beats
  the rules there, which it does for 13 of the 15. Deciding on validation picks exactly the same 13. For fork and
  hanging piece, the site uses the model only to *add* a name; it never overrules the rule (next section). On
  puzzles this combination scores 0.816 on fork and 0.716 on hanging piece. That is below the model alone, by
  design, and still above the rules (0.688 and 0.567).

### By puzzle rating

Rules F1 → shipped model F1 on the test split, by Lichess puzzle rating:

| Rating | Puzzles | fork | hangingPiece | backRankMate | mateIn2 | pin | skewer | Model macro F1 |
|---|---:|---|---|---|---|---|---|---:|
| < 1000 | 54,433 | 0.848 → 0.976 | 0.319 → 0.825 | 0.496 → 0.987 | 0.998 → 0.980 | 0 → 0.881 | 0 → 0.912 | 0.875 |
| 1000–1399 | 62,164 | 0.704 → 0.909 | 0.622 → 0.842 | 0.356 → 0.955 | 0.997 → 0.919 | 0 → 0.829 | 0 → 0.798 | 0.848 |
| 1400–2000 | 75,470 | 0.521 → 0.779 | 0.649 → 0.814 | 0.194 → 0.848 | 0.998 → 0.793 | 0 → 0.689 | 0 → 0.539 | 0.725 |

The model is at its best on the easiest puzzles, which are the closest to the tactics a beginner meets.

### Where the model loses, and why the rules lose where they do

- **Mate in 2: the rules win (0.998 against 0.919).** The rules are told the length of the forced mate: here it
  comes from the solution, in a game from Stockfish's score. The model sees only the position and the first
  move, and has to judge for itself whether mate follows a move later. The site keeps the rules for mates.
- **Mate in 1: a tie (0.998).** "The move is mate" is one of the model's input planes, so this is no test of
  either.
- **CNN against LightGBM.** LightGBM is better on hangingPiece (0.871 against 0.826), pin, discoveredAttack,
  trappedPiece, promotion and capturingDefender. For those themes a well-chosen handcrafted feature ("the
  captured piece was undefended", "a piece is pinned after the move") carries most of the signal. The CNN is
  better on mates, deflection, attraction and skewer. Overall the CNN's macro F1 is 0.806 against 0.791. It ships
  because it is the better model overall, and because porting 84 python-chess features to the browser would be
  far more code to keep in step than a 32-plane encoder.
- **Why the rules miss forks** (recall 0.62): most of the forks they miss come on the solver's *second* move.
  Lichess tags a puzzle "fork" if any move in the solution forks, but the rule checks only the first move of the
  reply. The model sees only the first move too, but it learns the positions in which a fork is coming.
- **Why the rules over-call back-rank mates** (precision 0.28): the rule's docstring says the king is "boxed in
  by its own pawns", but its code only checks that the mate is given by a rook or queen along the king's back
  rank. Lichess requires the king to be trapped by its own pieces. That is a real bug in the rule, independent
  of the model, and worth fixing in `motifs.py` and `motifs.ts` (left alone here, since they are the baseline).
- **The weakest themes** are capturingDefender (0.48), trappedPiece (0.68) and deflection (0.67). These are
  ideas about what a piece *was doing* before it was removed, and the site does not surface them (below).

### Puzzles score a definition

A puzzle label is Lichess's definition of a theme, and for two themes that definition is narrower than what the
site's tag means (`uv run tactics analysis`, `results/analysis.json`):

- **Hanging piece.** The site's tag means a piece "could be taken for free or by a cheaper piece". Lichess's
  tagger calls a piece hanging only when it is undefended. Of the 3,905 test puzzles where the rules say
  hangingPiece and Lichess doesn't, 2,325 (60%) are a defended piece taken by a cheaper one.
- **Fork.** Lichess leaves out a fork if the forking piece can itself be won. Of the 4,982 puzzles where the rules
  see a fork and Lichess doesn't, 3,661 (73%) are exactly that. A knight that checks the king and attacks the
  queen is still a fork to a beginner, even if a rook can take the knight afterwards.

The sample player showed what this does in practice. A first version let the model overrule the rules on every
trusted theme. It removed 8 of the 14 hanging-piece tags, and all 8 were defended pieces taken by a cheaper piece:
a queen taken by a pawn, a knight by a pawn, a rook by a bishop. It also turned a royal knight fork (Nd4+ against
king and queen, with the knight then taken) into a "pin". So on these two themes the site keeps the rules' tag,
which the engine's line has already confirmed. The model only names what the rules left generic.

The same check supports letting the model decide **back-rank mate**. Lichess's definition (the king trapped on its
back rank by its own pieces) is the one the site's own text gives. The rule fails it: its code never checks the
king's neighbours, which is why its precision is 0.28.

## In the browser

- **Export** (`tactics/export.py`). The model is exported to ONNX (opset 17) with the sigmoid included. It is then
  statically quantised to int8 (QDQ, per-channel weights, 2,048 validation positions for calibration). The final
  sigmoid stays in float, because a quantised output would snap probabilities to steps of 1/255. The int8 file
  is **0.78 MB** (fp32: 2.92 MB), and quantising cost at most 0.003 F1 on any theme.
- **Runtime.** `web/src/analysis/tactics.worker.ts` runs onnxruntime-web 1.30.0 (WebAssembly, one thread, since
  the pages are not cross-origin isolated) in its own Web Worker, next to Stockfish's. The worker and the model
  load once, on the first game reviewed. The ORT wasm file is 14 MB, 3.7 MB gzipped. Single-threaded wasm takes
  about 1.8 ms per position, and a review asks about at most two positions per mistake, and only for mistakes the rules left generic. If anything fails to load, the
  review falls back to the rules alone. The Chrome extension's offscreen page uses the same worker; it was checked
  to load and run under the extension's CSP (`'wasm-unsafe-eval'`).
- **How tags change** (`web/src/analysis/tactics.ts`). The rules still decide *whether* a move lost or missed
  material, and how much, from Stockfish's lines, with the same gates as before. Only where they could not say
  how, with `lost_material` ("what you allowed") or `missed_tactic` ("what you missed"), is the model asked about
  one position:
  - for what you allowed: the position after your move, with the opponent's best reply;
  - for what you missed: the position before your move, with your best move.

  The first trusted theme it sees names the tag, in the order hanging piece, fork, discovered attack, pin,
  skewer, trapped piece. With none, the tag stays generic. This adds eight tags (`allowed_pin`, `missed_pin`,
  `allowed_skewer`, `missed_skewer`, `allowed_discovered_attack`, `missed_discovered_attack`, `trapped_piece`,
  `missed_trapped_piece`), each with its own habit text in `catalog.ts` and `stats.py`, and they count towards
  the "piece safety" and "spotting tactics" skills. A model-named tag says which idea it was, not which piece: the
  first move of the line may not be the one that pins or forks. For allowed mates, the model decides
  `back_rank_mate` both ways.

  Themes the model is trusted for but which the site does not name (deflection, attraction, promotion,
  capturingDefender, doubleCheck, smotheredMate) leave the tags alone. They are advanced, rare, or not something
  a beginner can act on.
- **Checks.**
  - `ml/tests/test_planes.py` checks that the TypeScript encoder matches the Python one on 110 fixture positions
    (castling both ways, en passant and promotions included).
  - `web/scripts/check-tactics.ts` checks that onnxruntime-web reaches the same decisions as Python's runtime on
    them.
  - The `web` step scores the whole test split through the browser stack (the table's "In the browser" column).

## Honest limits

- **The labels come from Lichess's own tagger.** Lichess themes are computed by a hand-written program
  (lichess-puzzler), and it reads the *whole* solution. So the model learns to imitate another rule set, from
  less information than that rule set had. "F1 against Lichess themes" is not the same as "a coach would agree".
- **Puzzles are not games.** Every puzzle has a winning tactic by construction. In a real game most mistakes are
  quieter, so base rates differ, and precision on real blunders will be lower than on puzzles. On the 61,084 test
  puzzles with none of the 15 themes, the model still names some theme for 16.6% of them (the rules: 11.5%). The
  site limits the damage by asking only when Stockfish's line shows material really changing hands.
- **No evaluation on real blunders yet.** PLAN.md asks for ~100 of the owner's own blunders, labelled by hand. That
  is the evaluation that matters, but those games must not enter this repo, so it is left for the owner to run
  locally. The only chess.com-like data used here is the synthetic sample player, and its reviews were
  re-generated with the model (below), with no ground truth for them.
- **Position plus one move.** The model doesn't see the engine line, so it can't know that a mate is forced or
  that a fork wins material two moves later. In the site, the engine line still gates every tag.
- **Thresholds and the trusted list were chosen on puzzle splits**, and the trusted list on test (as asked).
  Validation picks the same list, so this didn't matter here.
- **Reviews already stored in a browser keep their rule-only tags.** `ANALYSIS_VERSION` was not bumped, because
  bumping it would re-analyse every game of every user. New reviews get the model's tags.
- **The Python pipeline (`src/coach/`) still uses only the rules.** It knows the new tags' wording but never
  emits them.

## Effect on the sample player

The sample player's reviews (`web/public/sample/reviews.json`) were re-built with `web/scripts/make-sample-reviews.mjs`,
the same in-browser Stockfish and the model. Every engine value and move grade came out identical to the previous
file (Stockfish at a fixed node count is deterministic when the games run in the same order with one engine).
Exactly 4 tags changed, all of them generic tags the model named:

| Game, ply | Move | Before | After | The engine's line |
|---|---|---|---|---|
| s09, 45 | c4 | `lost_material` | `allowed_discovered_attack` | Nxd2 cxd5 Nxf3+ |
| s13, 17 | Ne1 | `missed_tactic` | `missed_fork` | best was hxg4 |
| s20, 60 | Ra6 | `missed_tactic` | `missed_discovered_attack` | best was Nc4+ |
| s27, 25 | Nc2 | `missed_tactic` | `missed_pin` | best was exf5 |

The other 3 `lost_material` and 7 `missed_tactic` tags stayed generic, and all 14 hanging-piece, 12 free-piece
and 3 fork tags from the rules are unchanged. These are synthetic games with no ground truth, so this shows that
the model behaves as intended, not that it is right. (The version that let the model veto rule tags changed 13
tags here, including the 8 hanging pieces described above.)
