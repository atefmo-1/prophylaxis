# The tactic model on chess.com beginners

385 blunders with one clear punishment, from 196 chess.com games where the two players average under 1000. Labels: Lichess's puzzle tagger. F1 with a 90% interval from resampling whole games.

| Theme | Blunders | Rules | Model (P / R) | What the site shows |
|---|---:|---:|---:|---:|
| mateIn1 | 10 | 1.00 (1.00–1.00) | 1.00 (1.00–1.00) (1.00 / 1.00) | 1.00 (1.00–1.00) |
| mateIn2 | 9 | 1.00 (1.00–1.00) | 0.86 (0.67–0.97) (0.75 / 1.00) | 1.00 (1.00–1.00) |
| fork | 58 | 0.85 (0.79–0.90) | 0.90 (0.85–0.94) (0.88 / 0.91) | 0.88 (0.83–0.93) |
| pin | 12 | 0.00 (0.00–0.00) | 0.78 (0.59–0.92) (0.82 / 0.75) | not shown |
| discoveredAttack | 13 | 0.00 (0.00–0.00) | 1.00 (1.00–1.00) (1.00 / 1.00) | 1.00 (1.00–1.00) |
| deflection | 5 | 0.00 (0.00–0.00) | 0.89 (0.57–1.00) (1.00 / 0.80) | not shown |
| hangingPiece | 137 | 0.86 (0.82–0.89) | 0.90 (0.87–0.93) (0.97 / 0.84) | 0.86 (0.83–0.90) |
| attraction | 5 | 0.00 (0.00–0.00) | 0.83 (0.57–1.00) (0.71 / 1.00) | not shown |
| backRankMate | 2 | 0.67 (0.00–1.00) | 0.80 (0.00–1.00) (0.67 / 1.00) | 0.80 (0.00–1.00) |
| promotion | 8 | 0.00 (0.00–0.00) | 0.89 (0.70–1.00) (0.80 / 1.00) | not shown |
| skewer | 6 | 0.00 (0.00–0.00) | 0.91 (0.67–1.00) (1.00 / 0.83) | 0.91 (0.67–1.00) |
| trappedPiece | 7 | 0.00 (0.00–0.00) | 0.80 (0.57–0.96) (0.75 / 0.86) | 0.80 (0.57–0.96) |
| capturingDefender | 1 | 0.00 (0.00–0.00) | 1.00 (0.00–1.00) (1.00 / 1.00) | not shown |

By rating band (average of the two players), F1 of what the site shows:

| Band | Blunders | hangingPiece | fork | discoveredAttack | pin | skewer | trappedPiece |
|---|---:|---:|---:|---:|---:|---:|---:|
| Under 600 | 218 | 0.84 (79) | 0.86 (34) | 1.00 (10) | – | 1.00 (2) | 0.75 (4) |
| 600 to 999 | 167 | 0.90 (58) | 0.92 (24) | 1.00 (3) | – | 0.86 (4) | 0.86 (3) |
| 1000 and up | 305 | 0.83 (89) | 0.84 (38) | 0.92 (13) | – | 1.00 (3) | 0.80 (9) |
