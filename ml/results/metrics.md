Test split: 192,067 puzzles. F1 at thresholds chosen on validation. Python and TypeScript rules disagree on 0 puzzles.

| Theme | Test n | Rules F1 | LightGBM F1 | CNN F1 | CNN int8 F1 (P / R) | In the browser F1 | Best | Model trusted |
|---|---:|---:|---:|---:|---:|---:|---|---|
| mateIn1 | 34,920 | 0.998 | 0.998 | 0.998 | 0.998 (1.00 / 1.00) | 0.998 | rules | no |
| mateIn2 | 30,968 | 0.998 | 0.854 | 0.919 | 0.919 (0.91 / 0.93) | 0.918 | rules | no |
| fork | 26,490 | 0.688 | 0.875 | 0.884 | 0.884 (0.93 / 0.84) | 0.884 | CNN | yes |
| pin | 10,537 | 0.000 | 0.771 | 0.757 | 0.758 (0.86 / 0.68) | 0.758 | LightGBM | yes |
| discoveredAttack | 9,877 | 0.000 | 0.786 | 0.780 | 0.779 (0.83 / 0.73) | 0.779 | LightGBM | yes |
| deflection | 8,077 | 0.000 | 0.587 | 0.670 | 0.669 (0.68 / 0.66) | 0.669 | CNN | yes |
| hangingPiece | 7,218 | 0.567 | 0.871 | 0.826 | 0.825 (0.77 / 0.89) | 0.825 | LightGBM | yes |
| attraction | 6,496 | 0.000 | 0.798 | 0.812 | 0.812 (0.86 / 0.77) | 0.812 | CNN | yes |
| backRankMate | 7,980 | 0.782 | 0.895 | 0.973 | 0.973 (0.97 / 0.97) | 0.973 | CNN | yes |
| promotion | 4,414 | 0.000 | 0.702 | 0.699 | 0.699 (0.68 / 0.72) | 0.699 | LightGBM | yes |
| skewer | 4,632 | 0.000 | 0.675 | 0.744 | 0.747 (0.79 / 0.71) | 0.747 | CNN | yes |
| trappedPiece | 2,071 | 0.000 | 0.686 | 0.679 | 0.678 (0.64 / 0.72) | 0.678 | LightGBM | yes |
| capturingDefender | 1,253 | 0.000 | 0.518 | 0.484 | 0.484 (0.50 / 0.47) | 0.484 | LightGBM | yes |
| doubleCheck | 982 | 0.000 | 0.876 | 0.889 | 0.889 (0.97 / 0.82) | 0.889 | CNN | yes |
| smotheredMate | 959 | 0.000 | 0.974 | 0.982 | 0.984 (0.98 / 0.99) | 0.984 | CNN | yes |
| **Macro F1, all 15** | | 0.269 | 0.791 | 0.806 | 0.807 | 0.807 | | |
| **Macro F1, the 5 the rules can name** | | 0.807 | 0.899 | 0.920 | 0.920 | 0.920 | | |

CNN: 729,775 parameters; ONNX fp32 2.92 MB, int8 0.78 MB.

In the browser (TypeScript planes + onnxruntime-web) the int8 model makes 9 of 2,881,005 theme decisions differently from native onnxruntime.
