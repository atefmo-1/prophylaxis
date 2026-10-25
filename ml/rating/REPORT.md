# Estimating a rating from one game: a study, and why the site doesn't

chess.com's Game Review says "you played like a 1200" for every game. Before showing anything like it, I checked
whether one game's accuracy can place a player that well. It can't, so Prophylaxis doesn't show an estimated rating.
A player's real rating comes from chess.com, and accuracy already says how well a game went.

## Data

- **Players:** chess.com's public API only, one request at a time, from usernames picked at random from country
  player lists (`collect.py`). 2,761 players were tried; one rated rapid or blitz game of at least 20 moves was
  kept per player, so no one player dominates.
- **Games:** 529 games, so 1,058 player-sides (616 rapid, 442 blitz). Ratings run from about 100 to 2,300; the
  median is about 680, which matches who plays on chess.com.
- **Analysis:** each game was reviewed with the site's own browser analysis (Stockfish 19 Lite, the same settings,
  `web/scripts/analyse-games.mjs`), so the accuracy is exactly what a player sees.
- **Privacy:** raw games and usernames stayed in `ml/data/rating/`, which git ignores. Only aggregates are committed
  (`results.json`).
- **Stopped early:** the study was stopped once the answer was clear. The planned second part, averaging over a
  player's last 5–20 games, wasn't finished.

## Results

10-fold cross-validation, grouped by game (`fit.py`). Errors are in rating points, over all player-sides:

| Model | Mean absolute error | 80% prediction interval |
|---|---:|---:|
| No model: always the median rating | 327 | 1,048 wide |
| Accuracy, monotone spline per time control | 329 | 1,020 wide |
| Accuracy + game length + mistakes and blunders | 297 | 954 wide |
| Gradient boosting on all of these | 319 | 976 wide |

- **Accuracy hardly moves with rating:** the correlation is 0.38 in blitz and 0.34 in rapid. Average accuracy goes
  from about 67 for players rated 0–400 to about 80 at 1,600, but within any one band it varies by about ±13 (one
  standard deviation). A 75 is typical of every rating.
- **The best model barely beats guessing:** about 30 points better than always guessing the median. An honest range
  for one game would be about 950 points wide: "somewhere between 250 and 1,200".
- **chess.com's own accuracy does no better:** on the 242 player-sides where chess.com published its accuracy, it
  correlates with ours (Pearson 0.75), and a model built on it misses by 405 (rapid) and 540 (blitz) points.

## Decision

No estimated rating per game. A single number would look precise and be wrong by about 300 points on average, which
goes against the site's rule that numbers come with honest ranges. Averaging over many games might narrow it; that
part wasn't measured.

## Reproduce

```bash
cd ml
uv run python -m rating.collect sample      # one game per random player, cached under data/rating
node ../web/scripts/analyse-games.mjs data/rating/games.jsonl data/rating/reviewed.jsonl --url http://localhost:5173
uv run python -m rating.fit                 # results.json
```
