Test split: 480,620 puzzles. F1 at thresholds chosen on validation. Python and TypeScript rules disagree on 0 puzzles.

| Theme | Test n | Rules F1 | LightGBM F1 | CNN F1 | CNN int8 F1 (P / R) | In the browser F1 | Best | Model trusted |
|---|---:|---:|---:|---:|---:|---:|---|---|
| mateIn1 | 87,720 | 0.998 | 0.998 | 0.998 | 0.998 (1.00 / 1.00) | 0.998 | rules | no |
| mateIn2 | 77,620 | 0.998 | 0.859 | 0.992 | 0.991 (0.99 / 0.99) | 0.991 | rules | no |
| fork | 66,332 | 0.685 | 0.875 | 0.956 | 0.955 (0.97 / 0.94) | 0.955 | CNN | yes |
| pin | 26,296 | 0.000 | 0.776 | 0.835 | 0.834 (0.90 / 0.78) | 0.834 | CNN | yes |
| discoveredAttack | 24,733 | 0.000 | 0.797 | 0.930 | 0.930 (0.96 / 0.91) | 0.930 | CNN | yes |
| deflection | 20,218 | 0.000 | 0.610 | 0.898 | 0.898 (0.93 / 0.87) | 0.898 | CNN | yes |
| hangingPiece | 18,137 | 0.557 | 0.876 | 0.856 | 0.855 (0.82 / 0.90) | 0.855 | LightGBM | yes |
| attraction | 16,276 | 0.000 | 0.802 | 0.921 | 0.921 (0.95 / 0.90) | 0.921 | CNN | yes |
| backRankMate | 19,973 | 0.780 | 0.900 | 0.988 | 0.988 (0.99 / 0.99) | 0.988 | CNN | yes |
| promotion | 11,080 | 0.000 | 0.698 | 0.906 | 0.906 (0.94 / 0.87) | 0.906 | CNN | yes |
| skewer | 11,549 | 0.000 | 0.698 | 0.938 | 0.938 (0.96 / 0.92) | 0.938 | CNN | yes |
| trappedPiece | 5,210 | 0.000 | 0.706 | 0.790 | 0.790 (0.78 / 0.80) | 0.790 | CNN | yes |
| capturingDefender | 3,161 | 0.000 | 0.568 | 0.796 | 0.791 (0.84 / 0.75) | 0.791 | CNN | yes |
| doubleCheck | 2,412 | 0.000 | 0.869 | 0.928 | 0.929 (0.97 / 0.89) | 0.929 | CNN | yes |
| smotheredMate | 2,406 | 0.000 | 0.972 | 0.991 | 0.991 (0.99 / 0.99) | 0.991 | CNN | yes |
| **Macro F1, all 15** | | 0.268 | 0.800 | 0.915 | 0.914 | 0.914 | | |
| **Macro F1, the 5 the rules can name** | | 0.804 | 0.901 | 0.958 | 0.958 | 0.958 | | |

CNN: 914,607 parameters; ONNX fp32 3.66 MB, int8 0.98 MB.

In the browser (TypeScript planes + onnxruntime-web) the int8 model makes 0 of 7,209,300 theme decisions differently from native onnxruntime.
