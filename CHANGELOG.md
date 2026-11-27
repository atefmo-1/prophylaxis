# What's new

The changes a player would notice, newest first. Each links to the study or report behind it.

## November 27, 2026

- **Moves written like a chess book:** piece symbols instead of letters (♘f3, ♕xd5, e8=♕) in the move list,
  explanations, practice and Compare. Screen readers still hear "N f3", and copied moves are ordinary notation.
- **Calmer pages:** the last 7 days read as one sentence, skill areas as a table, Practice leads with the task, and
  fewer boxes inside boxes. The theme switch lives in the player menu.
- **Lichess players too:** choose chess.com or Lichess on the first screen. Lichess games are reviewed the same
  way, Compare looks players up on your own site, and Maia reads Lichess ratings as they are (it learned from
  Lichess games). The Chrome extension stays chess.com-only.
- **Your last 7 days** at the top of Habits: games played, how many showed your #1 habit against the week before,
  and the practice you did.
- **Readable board coordinates** on every board, and a check of every page against WCAG 2.1 AA.
- **"Was this explanation right?"** and a feedback link in the player menu.
- **How hard was it, at your rating?** On each of your mistakes, the review says how many players at your rating
  find the better move ("about 3 in 10", "only about 1 in 20"), and when the move you played is a common mistake at
  your level. It comes from Maia-3, a model of how people play at each rating, and its numbers were checked against
  11,230 moves from real chess.com games ([ml/results/maia.md](ml/results/maia.md)).
- **Your opponent's answer:** when your move allowed something, the review says how many players at your opponent's
  rating find the punishing reply, and whether your opponent did.
- **Key moments and practice start with the ones worth fixing:** misses most players at your rating would find come
  first; very hard ones come last.
- **A word about time:** a quick move in a position that's hard at your rating, with time on the clock, gets a nudge to
  slow down there.
- **Accuracy checked against chess.com's on 218 games** instead of 17 ([ml/results/accuracy.md](ml/results/accuracy.md)).

## November 26, 2026

- **Practice on a real spaced-repetition schedule:** positions come back when you're about to forget them (FSRS, the
  model behind Anki), checked against the reference implementation.
- **More reasons:** "your opponent already threatened this, and your move didn't stop it", pawns lost and pawns
  missed, and reasons that only show a few moves past where the engine's line stopped. About half the mistakes that
  had no reason now have one ([reports/](reports/)).
- **The tactic model loads only when needed** and no longer names pins, which a person accepted only about a third
  of the time.

## November 25, 2026

- **A new look:** white and navy, a pawn mark, and decluttered pages.
- **Grades match chess.com more closely:** an only-move recapture counts as Great; Excellent also means giving up
  less than a third of a pawn.
- **The landing page shows the coach at work** instead of describing it.

## October 24 and 25, 2026

- **Prophylaxis works for any chess.com player, in the browser,** with a sample player to look around with.
- **Compare with any player,** with tips for beating them and an opening tree.
- **The Chrome extension** reviews each game when it ends, and shares reviews with the site.
- **A trained tactic model** names discovered attacks, skewers and trapped pieces the rules couldn't
  ([ml/REPORT.md](ml/REPORT.md)), with Lichess puzzles of each tactic to practise.
- **No estimated rating per game:** a study of 529 games showed it would be off by about 300 points
  ([ml/rating/REPORT.md](ml/rating/REPORT.md)).
