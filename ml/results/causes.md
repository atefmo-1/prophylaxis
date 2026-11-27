# Why beginners' mistakes go unexplained

`python -m causes.classify` (ml/causes). 284 random chess.com games where the two players average under 1000,
both sides, plus the 36 sample games (sample player only). Stockfish 300k nodes per position. A mistake is a move
that loses 10%+ winning chances, the site's own bar. Each mistake is tagged by the site's rules
(src/coach/motifs.py), then checked against causes that are facts in the engine's lines.

## Headline (chess.com beginners, 2,967 mistakes)

| | Mistakes | Share |
|---|---:|---:|
| The rules name a specific cause (hanging piece, fork, mate, missed free piece…) | 713 | 24% |
| The rules see material change hands but can't say how ("lost material", "missed tactic") | 486 | 16% |
| No reason at all | 1,768 | 60% |

**A bug found on the way.** Stockfish sometimes cuts its line to 2 moves, when a search ends on a hash-table hit.
The rules read material off the line, so a cut line hides the loss. With Stockfish's lines as given, 65% of
mistakes had no reason. Carrying a short line on with a second search from where it stops brings that to 60%: 173
mistakes (6%) get a named cause they should already have had. The site has the same issue. In its own sample
reviews, 39 of 165 mistakes have a 2-move reply line, and 33 of those have no tag.

**Fixed in the site (analysis version 6).** Around every move that loses 5%+, a main line shorter than 12 plies is
continued with searches at a quarter of the nodes, up to 4 rounds. Re-reviewing the sample games in the browser left
no 2-move reply lines (there were 32), and added about 5% to a review's engine work. For the two sample players, 8
mistakes gained a reason the cut line had hidden (a missed free piece, a missed tactic, lost material). 5 lost a reason
that only showed because the line stopped between a capture and the recapture. The engine's scores and the move
grades are unchanged. The Python reference (src/coach/engine.py) continues every short main line.

## What the unexplained 60% are

The first cause that applies, in this order: threat, then mate attack, long mate, slow material, promotion, king,
pawn, slip, endgame. "Hand-check" is the number of random examples I read where the label was right.

| Cause | Mistakes | Of unexplained | Hand-check | What it means |
|---|---:|---:|---:|---|
| Pawn | 409 | 23% | about 4 of 8 | One pawn lost or missed, under the rules' 2-pawn bar. The misses are mostly endgame races and structure. |
| Slip | 322 | 18% | n/a | The player was winning (70%+), lost 10%+, and lost no material. This says what happened, not why. |
| Slow material | 210 | 12% | about 5 of 8 | Material lost between plies 10 and 20 of the line, beyond the rules' 9-ply horizon. |
| Ignored threat | 175 | 10% | 11 of 12 | The opponent already threatened something and the move didn't stop it (see below). |
| Endgame, king checks, long mates, promotions | 167 | 9% | – | Small groups. |
| No concrete reason | 485 | 27% | 8 of 8 | Quiet moves with no tactic in either line: castling, a rook move, a pawn push. Over half lose under 15%. |

In 78% of the slips and unknown cases, the better move is a quiet move, not a capture or a check.

## Ignored threats, across all mistakes

Before 1,200 of the 2,967 mistakes (40%), the opponent already had a threat. The test is a null move: if the player
could pass, the opponent would win material within 4 plies or mate within 3. In 455 mistakes (15%), the move ignored
that threat and the opponent's best reply carries it out. 280 of these already get a tag (often "hanging piece",
for a piece that was attacked before the move). The other 175 have no reason today.

19% of all mistakes (577) were rushed: under 3 seconds with more than 2 minutes on the clock. 109 (4%) came in time
pressure.

## What this says to build, in order

1. **Fix the short lines (a bug fix).** When Stockfish's line is shorter than about 12 plies, search on from its
   end. This explains 6% more mistakes with the rules the site already has, and makes every shown line longer.
2. **"What were they threatening?"** Run the null-move check before each mistake. It's a fact from the engine
   (11 of 12 hand-checked labels were right). It covers 15% of all mistakes, and it teaches the habit coaches name
   first: look at what the opponent wants before you move.
3. **Pawn-level and slower material.** Name one-pawn losses and misses, and look 20 plies deep for material. Up to
   21% of mistakes, but only about half the labels were right in the hand-check. Each needs a fact-check (does the
   line really win that pawn, and is it the reason?) before the site says it.
4. **No templated reason for the rest.** About a quarter of all mistakes (slips and no-concrete-reason) have no fact
   to state. Show the better move and its line, and say nothing more. A free model would guess here, and these are
   the mistakes where a wrong guess is easiest to believe. A human-move model (Maia) could later say "most players
   at your level play X here", which is a fact about people, not a guessed reason.

With 1 to 3, the share of beginner mistakes the site gives a reason for goes from 35% (Stockfish's lines as given)
to between 55% and 67%, depending on how many pawn and slow-material labels pass the fact-check.

## Sample games

92 mistakes by the sample player. 74% have no reason: pawn 16, slip 16, no concrete reason 19, ignored threat 8, slow
material 7, king 2. 15 mistakes (16%) ignored a threat, and 24 (26%) were rushed.

Counts only. The chess.com games and per-mistake examples stay in ml/data, which git ignores.
