# Maia-3 on chess.com beginners

`python -m maia.study` (ml/maia). Maia-3 5M, the authors' checkpoint run with their own code, on 284 random chess.com
games where the two players average under 1000: 21,651 moves, both sides. Stockfish (300k nodes) gives the best move
and the evaluation. The rating map is fitted on the even-numbered games; every other number is from the odd-numbered
games (11,230 moves), which the fit never saw.

## Rating map

Maia learned from Lichess, whose ratings run higher. The Maia rating that best predicts each chess.com band's moves:

| chess.com rating | Maia rating | Moves |
|---|---:|---:|
| Under 400 | 700 | 5,709 |
| 400 to 599 | 1000 | 5,123 |
| 600 to 799 | 1100 | 5,186 |
| 800 to 999 | 1300 | 5,259 |

## It predicts beginners' moves

| | Predicts the move played |
|---|---:|
| Maia at the mapped rating | 48.0% |
| Maia at a fixed 1500 | 46.9% |
| Stockfish's best move | 33.5% |

By band, Maia goes from 42.6% under 400 to 50.7% at 800 to 999. Stockfish goes from 28.5% to 36.7%. The paper
reports 55-57% on Lichess players, so beginners' moves are harder to predict, as expected.

## Its chances are honest

When Maia gives the best move a chance p at the player's mapped rating, players find it about p of the time:

| Maia's chance for the best move | Positions | Maia says | Players found it |
|---|---:|---:|---:|
| Under 10% | 3,150 | 4% | 5% |
| 10-20% | 1,725 | 15% | 15% |
| 20-35% | 1,924 | 27% | 26% |
| 35-50% | 1,339 | 42% | 44% |
| 50-70% | 1,447 | 60% | 60% |
| 70-90% | 1,053 | 80% | 78% |
| Over 90% | 592 | 96% | 95% |

Overall calibration error is 0.9 percentage points. By band it is 0.7 (under 400), 2.2 (400 to 599), 0.7 (600 to 799)
and 1.4 (800 to 999). So a sentence like "about 1 in 4 players at your level find this move" would be accurate across
many positions. It is a statement about players at that level, not a prediction for this one player.

## What it says about mistakes

1,483 mistakes (10%+ winning chances lost) in the test games:

- **21% are the move Maia expects most at that level.** That share rises from 18% under 400 to 24% at 800 to 999.
  These are typical mistakes: most players at that level would play the same move.
- **Findability of the better move:**
  - 17% of mistakes had a better move that over half of players at that level find. That is a slip worth a habit.
  - 50% had one that 10-50% of players find.
  - 33% had one that under 10% of players find. That is a hard position, and missing it says little about the player.

## What the site could say

All of this follows from Maia's move chances at the player's rating. None of it needs a server.

1. **On each mistake, how findable the better move was.** For example, "At your level, about 3 in 5 players find Nf3
   here" for an easy one, and "Only about 1 in 20 players at your level find this" for a hard one. The calibration
   above is what makes these sentences honest.
2. **Typical mistakes.** For example, "Most players at your level play this here too: it's a common trap." This
   applies to 1 in 5 mistakes.
3. **Practice ordering and habits.** Easy misses (over 50% findable) are the ones to drill first. Hard ones are fine to
   lose. A habit built from easy misses is a stronger signal than one built from hard ones.

## Licence decision: Maia-3 5M, under AGPL-3.0

What the sources say, checked on 2026-11-27:

- **The 5M card points to the repo, whose licence is AGPL-3.0.** The card says "see repo for code/weights license",
  and the repo's LICENSE is AGPL-3.0.
- **The lab's lead made the AGPL reading explicit.** On launch day, 2026-05-24, Ashton Anderson changed the 79M
  model's card from "see repo" to "License: AGPLv3" (Hugging Face commit a107d6ce).
- **The authors invite reuse.** The launch post on Lichess says "The models are completely free for you to download
  and use" and lists coaching aids among the uses.
- **The authors already ship Maia-3 to every visitor's browser.** Their own app (maiachess.com, repo
  CSSLab/maia-platform-frontend) is GPL-3.0. It sends a Maia-3 ONNX file, a JavaScript board encoder and the
  4,352-move list to the browser.
- **GPLv3 allows the combination.** Its section 13 explicitly allows combining GPLv3 code with AGPLv3 code: each part
  keeps its licence, and the AGPL network clause applies to the whole.

Alternatives, and why they lose:

- **Maia-2 (MIT).** It puts every player under Lichess 1100 into one rating bucket, which covers most of the people
  this site is for. It is also a 93 MB model.
- **Maia-1 (GPL).** It starts at 1100 and needs nine separate networks.
- **Neither.** That gives up the one model that fits these players.

So Prophylaxis will use **Maia-3 5M under AGPL-3.0**. Its obligations, all small for a project that is already open
source:

1. **Licence text.** Add the AGPL-3.0 text to the repo.
2. **File notices.** Mark the model file and the board-encoding and move-list code as AGPL-3.0, credit CSSLab, and
   cite the paper. Say that the file was exported from the official checkpoint, with the date.
3. **Rebuildable export.** Export the ONNX file from the official checkpoint
   (huggingface.co/UofTCSSLab/Maia3-5M, sha256 `ba14208b…524f`), not from a community copy. Commit the export
   script, so the deployed file can be rebuilt from its source.
4. **Source link.** Keep a visible link to the source in the app. The landing page already links the GitHub repo;
   the app needs one too.
5. **Licence notes.** Prophylaxis's own code stays GPL-3.0-or-later. The repo notes that the combined site is also
   subject to AGPL section 13, and so are forks of it.

All five are done. The text is in `LICENSES/AGPL-3.0.txt`, and the site serves a copy beside the model. The AGPL files
carry SPDX headers. `maia3.json` records the checkpoint's sha256, the export date and the paper. `ml/maia/export.py`
rebuilds the file. The app's player menu links "Source code and licences", and the README's Licence section explains
the combination.

## What shipped

- **The sentences.** On each of your mistakes, misses and blunders, the review now says how many players at your
  rating find the better move ("about 3 in 10", "only about 1 in 20", "almost every player"). When the move you played
  is the one players at your rating play most, and at least about 3 in 10 do, it says it's a common mistake. Practice
  and the key-moment quiz say how findable the answer was. Maia's rating comes from the map above: linear between the
  band centres, and the last offset above them.
- **The file.** `maia3.onnx` is 5.8 MB. Its weights are stored as int8, one scale per output channel, and turned back
  into fp32 when the model loads, so the arithmetic is fp32. Three exports were compared with PyTorch on 2,000 real
  positions:

  | Export | Size | Largest difference | Mean difference | Same top move |
  |---|---:|---:|---:|---:|
  | fp32 | 20.9 MB | 0.000004 | 0.0000001 | 100% |
  | Dynamic int8 (int8 arithmetic) | 6.5 MB | 0.042 | 0.0009 | 97.7% |
  | **Int8 weights, fp32 arithmetic (shipped)** | **5.8 MB** | **0.029** | **0.0006** | **98.9%** |

  Dynamic int8 also drifted further in the browser's runtime (onnxruntime-web): it agreed with fp32 on the top move in
  94% of test positions, against 97.7% in Python. The shipped file runs the same in both. On the held-out games its
  calibration error is 0.7 points (fp32: 0.8), and its top-1 accuracy is the same, 50.6%. `web/scripts/check-maia.ts`
  checks the browser's encoding and move numbering against the authors' code (84 of 84 positions identical), and its
  chances against PyTorch (largest difference 0.014, mean 0.0004).
- **Loading.** Like the tactic model, it loads only when a review has a mistake to look at. Reviews made before it
  get annotated from the positions they kept, with no new engine search. The Chrome extension doesn't include it.
- **Time control.** Maia-3 learned from Lichess blitz, and these chess.com games are mostly rapid. The rating map absorbs
  some of that difference, and the calibration above was measured on these games.

Counts only. The games, the checkpoint and the authors' code stay in ml/data, which git ignores.
