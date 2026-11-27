# Prophylaxis's accuracy against chess.com's

`python -m accuracy.validate` (ml/accuracy). Every random chess.com game in ml/rating's samples where chess.com shows an
accuracy for both players: **218 games, 436 player-games**, rapid and blitz, players rated from 100 to about 3000.
Stockfish 19 at 300k nodes reads every position; the reference pipeline's formula (`src/coach/grading.game_accuracy`,
which the site's TypeScript port matches) gives each side's accuracy. Intervals are 95%, from resampling whole games
2,000 times.

## Result

| | Value |
|---|---:|
| Pearson correlation | **0.71** (0.64 to 0.77) |
| Spearman (rank) correlation | **0.75** (0.69 to 0.80) |
| Mean difference (ours minus chess.com's) | +1.5 points |
| Mean absolute difference | 7.6 points |
| Within 5 points of chess.com | 44% |

The two scores rank players' games much the same way and agree on average, but a single game's number can differ
by several points. chess.com's formula (CAPS) is private; ours is Lichess's published one, so an exact match isn't
expected.

**This replaces an earlier figure**, r = 0.85 on 17 games: one player's games, all the pipeline's validation set
had. On 25 times as many games, from many players, the honest number is lower.

## By rating and time control

| | Player-games | Pearson | Spearman | Mean difference | Mean absolute difference |
|---|---:|---:|---:|---:|---:|
| Under 600 | 85 | 0.62 | 0.59 | +3.3 | 9.3 |
| 600 to 999 | 91 | 0.75 | 0.78 | +3.9 | 8.0 |
| 1000 to 1399 | 50 | 0.47 | 0.52 | -1.8 | 8.6 |
| 1400 and up | 210 | 0.64 | 0.74 | +0.6 | 6.5 |
| Blitz | 194 | 0.72 | 0.76 | +1.1 | 7.2 |
| Rapid | 242 | 0.69 | 0.72 | +1.9 | 7.9 |

Correlation within a band is lower than overall because each band spans a narrower range of accuracies. Under 1000,
ours runs about 3 to 4 points above chess.com's.

## Limits

- Players who run Game Review may not be typical players.
- 300k nodes per position, as in the other studies; the site's engine searches less deeply on most devices, and the
  Python reference more deeply (1 million nodes).
- Counts and summary statistics only. The games stay in ml/data, which git ignores.
