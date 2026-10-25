Test half: 5,161 blunders with one clear punishment, from 3,090 Lichess rapid games between players rated 1300 or less. F1 with a 90% interval (games resampled).

| Theme | Blunders | Rules F1 | Model F1; precision, recall | Site F1 |
|---|---:|---:|---:|---:|
| mateIn1 | 277 | 1.00 (1.00–1.00) | 1.00 (1.00–1.00); P 1.00, R 1.00 | 1.00 (1.00–1.00) |
| mateIn2 | 86 | 1.00 (1.00–1.00) | 0.90 (0.86–0.94); P 0.82, R 1.00 | 1.00 (1.00–1.00) |
| fork | 582 | 0.81 (0.79–0.83) | 0.91 (0.89–0.92); P 0.87, R 0.95 | 0.87 (0.85–0.88) |
| pin | 214 | 0.00 (0.00–0.00) | 0.81 (0.77–0.84); P 0.84, R 0.78 | 0.81 (0.77–0.84) |
| discoveredAttack | 152 | 0.00 (0.00–0.00) | 0.89 (0.85–0.92); P 0.90, R 0.87 | 0.89 (0.85–0.92) |
| deflection | 57 | 0.00 (0.00–0.00) | 0.86 (0.80–0.92); P 0.89, R 0.84 | not shown |
| hangingPiece | 1894 | 0.86 (0.84–0.87) | 0.93 (0.92–0.93); P 0.97, R 0.89 | 0.86 (0.85–0.87) |
| attraction | 24 | 0.00 (0.00–0.00) | 0.79 (0.67–0.88); P 0.72, R 0.88 | not shown |
| backRankMate | 29 | 0.74 (0.64–0.83) | 0.92 (0.86–0.97); P 0.85, R 1.00 | 0.92 (0.86–0.97) |
| promotion | 60 | 0.00 (0.00–0.00) | 0.95 (0.91–0.98); P 0.95, R 0.95 | not shown |
| skewer | 53 | 0.00 (0.00–0.00) | 0.83 (0.76–0.89); P 0.78, R 0.89 | 0.83 (0.76–0.89) |
| trappedPiece | 197 | 0.00 (0.00–0.00) | 0.78 (0.73–0.81); P 0.79, R 0.77 | 0.78 (0.73–0.81) |
| capturingDefender | 23 | 0.00 (0.00–0.00) | 0.67 (0.52–0.78); P 0.61, R 0.74 | not shown |
| doubleCheck | 5 | 0.00 (0.00–0.00) | 0.67 (0.25–1.00); P 0.75, R 0.60 | not shown |

What ships, decided on the other half (5,163 blunders):

- fork: shipped: F1 0.93 (rules 0.81), precision 0.89
- pin: shipped: F1 0.83 (rules 0.00), precision 0.83
- discoveredAttack: shipped: F1 0.86 (rules 0.00), precision 0.87
- deflection: shipped: F1 0.88 (rules 0.00), precision 0.86
- hangingPiece: shipped: F1 0.92 (rules 0.85), precision 0.98
- attraction: not shipped: only 14 real blunders to judge it on
- backRankMate: shipped: F1 0.87 (rules 0.71), precision 0.77
- promotion: shipped: F1 0.85 (rules 0.00), precision 0.88
- skewer: shipped: F1 0.82 (rules 0.00), precision 0.76
- trappedPiece: shipped: F1 0.74 (rules 0.00), precision 0.78
- capturingDefender: shipped: F1 0.75 (rules 0.00), precision 0.70
- doubleCheck: not shipped: only 14 real blunders to judge it on
- smotheredMate: not shipped: only 1 real blunders to judge it on
