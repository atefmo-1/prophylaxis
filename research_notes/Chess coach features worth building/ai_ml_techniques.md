# AI/ML Techniques for a Free, In-Browser, Post-Game Chess Coach (state as of Nov 2026)

Constraints assumed throughout: $0 budget, no servers or paid APIs, inference in the user's browser, offline training on a laptop using free Lichess data, nothing uploaded, post-game analysis only.

## 1. Human-like move prediction (Maia, Maia-2, Maia-3, personalised Maia)

### Takeaway
Human-move prediction is the most mature, best-evidenced and most browser-feasible ML technique for amateur coaching. The state of the art is now **Maia-3** (2026), not Maia-2. It reaches 57.1% move-matching accuracy, against 52.0% for Maia-2 and 51.6% for Maia-1. Community ONNX exports already run in onnxruntime-web: the 5M model is 10.8 MB at fp16. **The licence is the main catch.** Maia-1 and the Maia platform are GPL-3.0, Maia-3 code and weights are AGPL-3.0, and Maia-2 is MIT, the most permissive.

### Cited Findings
**Maia-1 (KDD 2020)**
- "Aligning Superhuman AI with Human Behavior: Chess as a Model System" by McIlroy-Young, Sen, Kleinberg and Anderson (KDD 2020). Maia predicts human moves "at a much higher accuracy than existing engines" — [arXiv 2006.01855](https://arxiv.org/abs/2006.01855)
- Maia's peak move-matching accuracy is "over 52%" (Table 1 peaks are 50.8–52.9%). Depth-limited Stockfish matches 33–41% and Leela at most 46%, with Leela flat across skill levels. Each model peaks near its training bin, usually one rating range higher — [ar5iv 2006.01855](https://ar5iv.labs.arxiv.org/html/2006.01855)
- Architecture: 6 residual blocks with 64 channels, which is small. Training used nine rating bins from 1100 to 1900, about 12M games each — [ar5iv 2006.01855](https://ar5iv.labs.arxiv.org/html/2006.01855)
- Blunder prediction (will the human make a large mistake on the next move?): a residual CNN reached 67.7% accuracy from the board alone and 71.7% with board plus metadata — [ar5iv 2006.01855](https://ar5iv.labs.arxiv.org/html/2006.01855)
- The repo is **GPL-3.0**. Weights are lc0 `.pb.gz` files for 1100–1900 in 100-point steps. The Lichess bots are maia1, maia5 and maia9, and the README notes they play the same move every time — [GitHub CSSLab/maia-chess](https://github.com/CSSLab/maia-chess)

**Maia-2 (NeurIPS 2024)**
- "Maia-2: A Unified Model for Human-AI Alignment in Chess" by Tang, Jiao, McIlroy-Young, Kleinberg, Sen and Anderson (NeurIPS 2024). It is one model for all skill levels, using "skill-aware attention" that combines player strength with the position. It aims for coherent predictions as skill changes — [arXiv 2409.20553](https://arxiv.org/abs/2409.20553)
- **MIT License.** Install with `pip install maia2`. Rapid and blitz models load via `from_pretrained`. Inputs are FEN, the player's Elo and the opponent's Elo. Outputs are move probabilities plus a win-probability value. Supported back ends are CUDA, MPS or CPU. The README does not mention ONNX or a browser build, and now recommends Maia-3 for new projects — [GitHub CSSLab/maia2](https://github.com/CSSLab/maia2)
- Maia-2 has 23M parameters and 52.0% accuracy on the Allie test set — [Chessformer paper, arXiv 2605.19091](https://arxiv.org/html/2605.19091)

**Maia-3 / Chessformer (2026)**
- Move-matching accuracy by size: 79M = 57.1%, 23M = 56.6%, 5M = 55.4%, 3M = 54.8%. The 3M model beats Maia-2 by 2.8 points at about one-eighth of the parameters. Training data is Lichess blitz from January 2023 to July 2025, resampled to balance skill levels. The only auxiliary head is win/draw/loss value; there is no difficulty, blunder or personalisation head — [arXiv 2605.19091](https://arxiv.org/html/2605.19091)
- Maia-3 covers players from 600 to 2600 Elo (per the Lichess announcement, quoted in a search snippet; the page returned 403 when fetched directly) — [Lichess blog: Introducing Maia-3](https://lichess.org/@/ashtonanderson/blog/introducing-maia-3-free-and-open-source/vCPPRtX3)
- The repo is **AGPL-3.0**. Models are 5M ("First try, CPU, chess GUIs"), 23M, 79M and a 3M ablation, distributed as PyTorch checkpoints on Hugging Face — [GitHub CSSLab/maia3](https://github.com/CSSLab/maia3); [HF UofTCSSLab/Maia3-5M](https://huggingface.co/UofTCSSLab/Maia3-5M). The HF card says "see repo for code/weights license"
- **Browser-ready ONNX exports exist** (community repackaging, licence stated as AGPLv3 inherited from upstream):

  | Model | fp16 | fp32 |
  |---|---|---|
  | 3M | 6.7 MB | 12.8 MB |
  | 5M | 10.8 MB | 21.0 MB |
  | 23M | 45.8 MB | 91.0 MB |
  | 79M | 156.1 MB | 311.7 MB |

  Runs with onnxruntime-web (wasm or WebGPU). Inputs are `tokens` [B,64,12], `elo_self` and `elo_oppo`. Outputs are `logits_move` [B,4352] and `logits_value` [B,3] (loss/draw/win). The card advises `graphOptimizationLevel: 'basic'` because of a LayerNorm fp16 fusion bug, and gives no latency figures — [HF bqrio/maia3-onnx](https://huggingface.co/bqrio/maia3-onnx)
- A "maia3-js" package with an onnxruntime-web browser build caches models in Cache Storage (seen in a search snippet only, not verified) — [search result referencing HF listing](https://huggingface.co/cemoss17/maia3-onnx)

**Maia in the browser (existing practice)**
- maiachess.com's frontend runs Maia client-side with onnxruntime-web and Stockfish as WASM, "both Stockfish and Maia directly in the user's browser". The repo is GPL-3.0 — [GitHub CSSLab/maia-platform-frontend](https://github.com/CSSLab/maia-platform-frontend)
- onnxruntime-web is MIT-licensed, and Microsoft recommends WebGPU for performance — [npm onnxruntime-web](https://npmjs.com/package/onnxruntime-web)

**Personalised Maia**
- Earlier per-player work ("Learning Models of Individual Behavior in Chess", KDD 2022) needed about 5,000 games per player — [arXiv 2008.10086](https://arxiv.org/pdf/2008.10086v2.pdf), as characterised in [Maia4All, arXiv 2507.21488](https://arxiv.org/html/2507.21488v1)
- Maia4All (TMLR 2026) personalises from about 20 games. Accuracy rises from a 51.4% baseline to 53.2%, a gain comparable to the earlier 5,000-game approach. Plain Maia-2 fine-tuning gained almost nothing at 20 games — [arXiv 2507.21488](https://arxiv.org/html/2507.21488v1); [TMLR listing](https://mlanthology.org/tmlr/2026/tang2026tmlr-learning)
- The prototype pool behind this needs about 2,500 games per prototype, while the target player's fine-tuning needs about 20 — [arXiv 2605.11893](https://arxiv.org/pdf/2605.11893)
- Critics note that move-matching is a deterministic metric with a ceiling well below 100%, since humans vary their moves. Distributional evaluation has been proposed instead — [UCLouvain paper](https://research.dial.uclouvain.be/bitstreams/d07ec49b-8f07-408e-a0c9-bd79838760bc/download)

### Inferences
- **Coaching uses this enables in-browser.** All of these follow from what the models output (a move distribution conditioned on Elo, plus win/draw/loss) and run in post-game batch mode:
  - **"What would a player at your level play here?"** Show the top Maia move at the user's rating.
  - **"Natural-but-wrong" detection.** A user mistake that Maia rates as highly probable at their level is a typical mistake for their level, which is good for habit-building. An unlikely blunder looks more like a one-off oversight.
  - **Human difficulty of a position.** Measure the probability mass Maia puts on Stockfish's best move at the user's Elo. A low value means the best move is hard to find at that level.
  - **"Your opponent probably wouldn't have seen it" context.** Use Maia at the opponent's Elo.
  - **Rating-ladder view.** Show at which Elo Maia starts finding the best move.
- **Size and speed.** Maia-3-5M at fp16 (10.8 MB) is a reasonable lazy-loaded download. Maia-3-23M (45.8 MB) is borderline. 79M (156 MB) is too heavy for a casual web app. Maia-1 nets (6×64 residual) are tiny, but converting from lc0 format is needed. Per-position inference for a 5M transformer over about 80 positions of one game should be seconds on WASM. This is an estimate: no published latency figure was found.
- **Licence decision for a public repo.**
  - Maia-2 (MIT) is the only one usable without copyleft obligations.
  - Maia-3 (AGPL-3.0) and Maia-1 (GPL-3.0) are fine if the app itself is open-source under a compatible licence. A public GitHub repo plus a static site that serves the weights would need to comply. AGPL network clauses matter little for a static client-side app, but source must be offered.
  - Stockfish.js is GPL-3.0 already (see section 6), so the app is likely already under GPL obligations. That makes GPL/AGPL Maia much less of an incremental burden. Worth checking the repo's current licence.
- **Maia-2 has no ONNX export.** It is PyTorch-only per the README, so using it would mean exporting it yourself (torch.onnx) — feasible offline on a laptop.
- **Portfolio appeal is high.** "Ran a NeurIPS/ICLR-lineage human-behaviour model client-side via ONNX/WebGPU, with no server" is a strong AI-product story. So is using it to calibrate coaching to skill level.

### Gaps
- Exact Maia-2 checkpoint file sizes, and whether Maia-2 weights are on Hugging Face or fetched from Google Drive, were not verified.
- No published browser latency benchmarks for Maia-3 ONNX on WASM or WebGPU.
- The Maia-3 weight licence on Hugging Face model cards is not stated on the card itself. AGPL is inferred from the repo and the third-party ONNX card.
- Maia-3 is trained on blitz. Its accuracy for rapid and daily games (which chess.com players often play) was not checked.
- Accuracy specifically for sub-1000 chess.com players: chess.com ratings differ from Lichess ratings, so a rating mapping would be needed (not researched here).

## 2. Blunder/error prediction and position difficulty (incl. puzzle-difficulty competitions)

### Takeaway
Position difficulty, not player skill, is the strongest predictor of human error (Anderson et al., KDD 2016). Blunder prediction from the board reaches about 68–72% accuracy (Maia paper), which is clearly better than chance but far from reliable per position. Puzzle-rating prediction has become a competitive benchmark (IEEE BigData Cup 2024, about 100 teams; FedCSIS 2025). The winning recipe is Maia/Leela embeddings plus engine features feeding a gradient-boosted tree, which is a laptop-trainable approach.

### Cited Findings
- "Assessing Human Error Against a Benchmark of Perfection" by Anderson, Kleinberg and Mullainathan (KDD 2016). It uses tablebases as ground truth over millions of games. Features describing "the inherent difficulty of an instance" are considerably more predictive of errors than skill or time features — [arXiv 1606.04956](https://arxiv.org/abs/1606.04956)
- Maia blunder prediction reached 67.7% (board only) and 71.7% (board plus metadata) — [ar5iv 2006.01855](https://ar5iv.labs.arxiv.org/html/2006.01855)
- **IEEE BigData Cup 2024, "Predicting Chess Puzzle Difficulty"**
  - Almost 100 teams competed.
  - Winners: 1st "bread emoji" (Woodruff, Filatov, Cognetta); 2nd "anansch" (Schütt, Huber, André); 3rd "ousou" (Björkqvist).
  - Seven papers appeared in IEEE BigData 2024 proceedings.
  - Sources: [Lichess organiser blog (via search snippet; direct fetch 403)](https://lichess.org/@/frugofruit90/blog/ai-research-for-better-puzzles-competition-results-and-summary/ww03rPco); [2nd-place paper PDF](https://opus.bibliothek.uni-augsburg.de/opus4/files/127116/127116.pdf)
- GlickFormer (11th place, 2024) is a transformer (modified ChessFormer backbone plus factorized temporal attention over the solution moves). It predicts Glicko-2 puzzle ratings and was trained on more than 4M puzzles — [arXiv 2410.11078](https://arxiv.org/abs/2410.11078)
- **FedCSIS 2025, Part 2**
  - About 4.55M training puzzles.
  - Test-set ratings span roughly 800–3000.
  - First place (Björkqvist) combined a fine-tuned Maia-2 with hand-crafted features and Leela and Stockfish features, feeding a gradient-boosted decision tree that predicts the rating.
  - Sources: [FedCSIS 2025 paper 6497](https://annals-csis.org/Volume_43/drp/6497.html); [search summary of Annals CSIS Vol. 43](https://annals-csis.org/Volume_43/drp/pdf/5937.pdf)
- The bread emoji team's FedCSIS 2025 entry again used "the MAIA and LEELA neural chess engine family as our neural chess embedding backbone" — [researchr listing / Annals CSIS](https://researchr.org/publication/WoodruffIC25)
- 3rd place in FedCSIS 2025 was GlickFormer v2. Another team ranked 5th public and 6th final; another ranked 9th — [Annals CSIS Vol. 43](https://annals-csis.org/Volume_43/drp/pdf/5937.pdf)
- Lichess puzzle ratings come from Glicko-2: "each solve attempt is treated as a Glicko2 rated game between the player and the puzzle" — [database.lichess.org](https://database.lichess.org/)

### Inferences
- **Cheapest useful difficulty signal: no training needed.** Use Maia probability of the best move at the user's Elo, plus Stockfish eval gap, plus count of "only moves". This mirrors the winning competition features.
- **Trained difficulty model: feasible offline.**
  - Data: the CC0 puzzle CSV, which has ratings as labels.
  - Features: Maia/Stockfish, run offline.
  - Model: gradient-boosted trees.
  - Ship the trees as JSON or ONNX (kilobytes). At inference time you need Maia plus Stockfish in the browser anyway.
- **Coaching value.**
  - Rank a user's mistakes by "how hard was this for someone at your level". Missing an easy tactic gets priority; missing a 2400-level move is excusable.
  - Label user-game positions with an estimated puzzle rating, then turn missed moments into puzzles of known difficulty.
- **Accuracy caveat.** I could not get MSE/RMSE values. Error magnitude in rating points is unknown, so present difficulty as coarse bands (easy/medium/hard for you), not precise numbers.
- **Portfolio appeal.** Reproducing a competition-winning recipe on a public benchmark with a known leaderboard is a credible, quantifiable resume line ("my model's MSE vs the 2024 winners").

### Gaps
- Exact metric values (MSE of winners and baseline) for both competitions: the PDFs could not be parsed and the Lichess blog returned 403.
- No source found on how well puzzle-difficulty models transfer to positions from users' own games (as opposed to curated puzzles).
- The 2nd-place 2024 paper was unreachable (connection refused).

## 3. Tactic/motif classification and concept detection

### Takeaway
Lichess's roughly 6.19M CC0 puzzles carry theme tags generated automatically by a tagger and refined by player votes. They form a ready-made labelled dataset for training a position-to-motif classifier offline. Concept probing (McGrath et al., PNAS 2022) shows that engine networks encode human concepts linearly. That finding is correlational, and it is an interpretability result, not a coaching product.

### Cited Findings
- database.lichess.org lists **6,193,530 rated, tagged puzzles** (last updated 2026-11-11), released under **CC0**.
  - Fields: PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags.
  - Themes are "automatically tagged" by a tagger, then refined by player votes. The theme list lives in puzzleTheme.xml.
  - A separate Stockfish evaluations DB has 417,862,375 positions.
  - Source: [database.lichess.org](https://database.lichess.org/)
- The lichess-puzzler generator and tagger repo is **AGPL-3.0** (it contains a `tagger` directory) — [GitHub ornicar/lichess-puzzler](https://github.com/ornicar/lichess-puzzler)
- McGrath et al., "Acquisition of chess knowledge in AlphaZero" (PNAS 2022, with Kramnik):
  - Linear probes show that many human concepts, taken from Stockfish's evaluation terms, can be regressed from AlphaZero activations after training.
  - Opening knowledge develops rapidly around the time concepts become predictable.
  - The authors caution the analysis is correlational, not causal.
  - Sources: [PMC9704706](https://pmc.ncbi.nlm.nih.gov/articles/PMC9704706); [arXiv 2111.09259](https://arxiv.org/abs/2111.09259)
- Maia-3's paper includes transcoder and attention interpretability analyses, using 2019 blitz games — [arXiv 2605.19091](https://arxiv.org/html/2605.19091)

### Inferences
- **The Lichess tagger is a rule-based heuristic module** (my understanding of `cook.py`, not verified on this fetch). Its labels are therefore noisy but consistent, so a learned classifier will at best reproduce the tagger's rules.
  - For a browser app, porting rule-based motif detection (fork, pin, skewer, hanging piece, back-rank) to JS is cheaper, explainable and more faithful than an ML classifier. The ML route is mainly a portfolio exercise.
  - The project's own recent commit ("Tactic model: load only when needed, stop naming pins") suggests a learned tactic model already exists and has had precision problems with pins. That is consistent with this.
- **Theme labels describe the puzzle solution, not "what the user missed".** Applying a puzzle-trained classifier to arbitrary game positions is a domain shift: there may be no tactic at all. You need either an "is there a tactic?" gate (Stockfish eval swing) or a "none" class.
- **Concept probing.** Linear probes on Maia-3 activations for Stockfish-style concepts (king safety, mobility) are doable offline, but they would explain the model, not the user's play. Low direct user value; moderate research/portfolio value.

### Gaps
- No published accuracy figures were found for ML classifiers of Lichess puzzle themes.
- Not verified whether the Lichess tagger is purely rule-based; this needs a direct read of `tagger/cook.py`.
- Not verified whether the evaluations DB is CC0 under the same blanket statement. The page says the database exports generally are CC0.

## 4. Natural-language explanations: LLMs, grounding, and in-browser LLMs

### Takeaway
Ungrounded LLM chess commentary is unreliable. Even a 2026 frontier model (GPT-5.4) gets 22% of sub-claims wrong without tools, and smaller open-weight models exceed 40%. LLM-as-judge evaluation misses these errors. Grounding with engine and tool facts helps substantially but does not eliminate errors. In-browser LLMs are technically available:
- **Chrome Prompt API (Gemini Nano):** on web pages from Chrome 148, desktop only, with heavy hardware requirements.
- **WebLLM small models:** roughly 0.4–3.5 GB VRAM.

The safe pattern is: deterministic code computes the facts, and the LLM (if used at all) only rephrases them under a JSON schema, with a template fallback.

### Cited Findings
**Hallucination evidence**
- "Hallucinations on the Board: Tool-Augmented Evaluation of LLM Chess Commentary" by Hebbar, Sheng, Oh and Viswanath (arXiv, Aug 2026):
  - GPT-5.4 without tools produces incorrect sub-claims 22.0% of the time; smaller open-weight models exceed 40%.
  - Tool augmentation substantially improves factual correctness.
  - Standard reference-based and LLM-as-judge metrics "cannot reliably detect these hallucinations".
  - Coverage of expert strategic ideas stays limited even with tools.
  - Source: [arXiv 2608.04240](https://arxiv.org/abs/2608.04240)
- In that paper (per search summary), a hallucinated commentary scored 4.9/5 under GCC-Eval while 2 of its 3 main claims were factually wrong — [alphaXiv 2608.04240](https://www.alphaxiv.org/abs/2608.04240)
- Kim et al., "Concept-guided Chess Commentary" (NAACL 2025):
  - LLMs are fluent but "prone to hallucinations".
  - Their method feeds GPT-4o engine evaluations plus prioritised concept scores (concepts that change most before and after the move).
  - It also enumerates all existing attacks so the model doesn't mention non-existent pieces or illegal moves, and uses chain-of-thought and few-shot prompting.
  - Human judges rated the output accurate, informative and fluent.
  - Sources: [ACL Anthology 2025.naacl-long.481](https://aclanthology.org/2025.naacl-long.481); [arXiv 2410.20811](https://arxiv.org/abs/2410.20811)
- SPIN-Bench (2025): chess produced the most illegal moves of the games tested — [arXiv 2503.12349](https://arxiv.org/pdf/2503.12349)
- LLM CHESS benchmark (Dec 2025, 50+ models): o3 (low) reached only about 758 Elo — [arXiv 2512.01992](https://arxiv.org/html/2512.01992v1)
- A self-reported model card, "Second-1.0-2B" (based on Qwen3.5-2B), explains engine facts and does not calculate: "Stockfish supplies the ground truth". It warns that facts may miss deep variations if the engine depth is insufficient. No independent evaluation — [HF joebos/Second-1.0-2B](https://huggingface.co/joebos/Second-1.0-2B)
- A 4B "C1" model trained for grounded chess reasoning reaches 48.1% puzzle accuracy (search summary only) — [arXiv 2603.20510](https://arxiv.org/html/2603.20510v1)

**Chrome built-in AI (Prompt API, Gemini Nano)**
Source for everything in this list: [Chrome Prompt API docs](https://developer.chrome.com/docs/ai/prompt-api.md.txt)
- The doc was last updated 21 Oct 2026. The core Prompt API is available to **web pages from Chrome 148** (extensions from 138). `samplingMode` is in an origin trial.
- OS: Windows 10/11, macOS 13+, Linux, and Chromebook Plus. **Not Android, not iOS.**
- Hardware: GPU with strictly more than 4 GB VRAM, or CPU with 16 GB RAM and 4+ cores. **22 GB free disk** on the Chrome-profile volume; the model is deleted if free space later drops below 10 GB. Unmetered network for the initial download.
- The model size is not fixed (check chrome://on-device-internals). The context window is not fixed (`session.contextWindow`).
- Languages: en, ja, es, de, fr. Output is text only.
- `responseConstraint` accepts JSON Schema or regex.
- Not available in Web Workers. Cross-origin iframes need `allow="language-model"`.
- "No data is sent to Google or any third party."

**WebLLM / transformers.js**
- WebLLM uses WebGPU via MLC/TVM and retains up to 80% of native performance — [arXiv 2412.15803](https://arxiv.org/pdf/2412.15803)
- WebLLM prebuilt models (vram_required_MB, context 4096 unless noted):

  | Model | VRAM (MB) | Notes |
  |---|---|---|
  | SmolLM2-360M q4f16 | 376 | |
  | Llama-3.2-1B q4f16 | 879 | |
  | Qwen2.5-0.5B q4f16 | 945 | |
  | Qwen3-0.6B q4f16 | 1,403 | |
  | Qwen2.5-1.5B q4f16 | 1,630 | |
  | gemma-2-2b q4f16 | 1,895 | |
  | Qwen3-1.7B q4f16 | 2,037 | |
  | Llama-3.2-3B q4f16 | 2,264 | |
  | Qwen3-4B q4f16 | 3,432 | |
  | Phi-3.5-mini q4f16 | 3,672 | 1k-context variant: 2,520 |

  Source: [web-llm src/config.ts](https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts)
- LlamaWeb (May 2026), a llama.cpp WebGPU backend, reports WebLLM at +49% memory and -35% performance relative to its own engine. Tests used f16 Llama 3.2 1B — [arXiv 2605.20706](https://arxiv.org/html/2605.20706)

### Inferences
- **A small local model cannot reliably write explanations on its own.** If 40%+ of sub-claims are wrong for small open models, and roughly 1–4B models are all a browser can host, the LLM must not be the source of any chess fact.
- **Viable architecture:**
  1. Stockfish, Maia and rule-based detectors produce a structured fact list (move, eval delta, motif, piece attacked, Maia probability at your Elo).
  2. A template engine renders a guaranteed-correct sentence.
  3. Optionally, the Prompt API or a WebLLM model paraphrases it under a `responseConstraint` JSON schema.
  4. A validator rejects any output that mentions squares, pieces or moves not in the fact list, falling back to the template.

  This mirrors the "enumerate all attacks" grounding of Kim et al. and the tool-augmentation result of Hebbar et al.
- **Reach.** The Prompt API's hardware gate (more than 4 GB VRAM or 16 GB RAM, 22 GB free disk, desktop Chrome only) means many users won't have it. Treat it as progressive enhancement, never a dependency. A WebLLM model costs a 0.4–2 GB download, which is a heavy first-run cost for a coaching app. Template-first wins on reliability and reach.
- **Portfolio appeal is very high** if paired with an evaluation: a claim-level factuality check of the app's own explanations against engine facts, in the style of ACT-Eval. "I measured hallucination and built a validator" is more compelling to AI product hiring managers than "I added an LLM".

### Gaps
- No public figure for Gemini Nano's current download size or context window in tokens; both are device and version dependent per the docs.
- No independent evaluation found of small (2B or less) models producing chess explanations from engine facts. The Second-1.0-2B card is self-reported, and its licence was not checked.
- The "Do Chess Explanations Reflect Model Decisions?" paper ([arXiv 2609.22245](https://arxiv.org/pdf/2609.22245)) surfaced but was not read.
- Not verified whether the Prompt API ships on Edge or other Chromium browsers. It is not on Firefox or Safari (by omission from the docs).

## 5. Per-game rating estimation

### Takeaway
Single-game "estimated rating" is officially described by chess.com itself as noisy and not a measure of strength. It is a frequent source of user complaints. I found no rigorous public study quantifying single-game accuracy-to-rating variance. Anderson et al. (2016) show that error is driven more by position difficulty than by skill, which is a structural reason single-game estimates are noisy.

### Cited Findings
- Chess.com support says the game rating estimates how well you played in one game and is not your rating. It "may be much higher or lower than your actual playing strength in any individual game", can "fluctuate significantly", and is meant to average out close to your rating over time — [Chess.com support: How is Game Rating calculated](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review)
- Forum users claim the same moves get different estimates depending on player and opponent rating. This is a user claim, not confirmed by chess.com — [Chess.com forum: Game review rating](https://chess.com/forum/view/game-analysis/game-review-game-rating); [forum: "Estimated game rating is a LIE AND DECEIT"](https://www.chess.com/forum/view/general/game-review-estimated-game-rating-is-a-lie-and-deceit)
- Error is predicted more by the inherent difficulty of positions than by player skill — [Anderson et al. 2016, arXiv 1606.04956](https://arxiv.org/abs/1606.04956)

### Inferences
- Per-game accuracy depends heavily on which positions arose. A quiet game yields high accuracy at any level, so a per-game rating number will mislead amateurs. If shown at all, it should be:
  - aggregated over many games, with an uncertainty band; or
  - difficulty-adjusted, for example via Maia: compare the user's move-likelihood under Maia at different Elos and pick the best-fitting Elo across 20+ games. This is the same principle as the Maia4All result that about 20 games suffice to characterise a player.
- A "rating that best explains your moves across 25 games, ±X" computed with Maia is a defensible, novel feature. It requires calibration offline on Lichess games with known ratings, which is feasible on a laptop with the CC0 DB.

### Gaps
- No peer-reviewed or rigorous public quantification found of the variance of single-game ACPL or accuracy against rating, nor of chess.com's estimator algorithm.
- Lichess has no official single-game Elo estimator. A Lichess forum thread exists ([Lichess forum: elo estimator](https://lichess.org/forum/lichess-feedback/lichess-elo-estimator)) but was not read.

## 6. Personalised training: puzzle recommendation, spaced repetition (FSRS), knowledge tracing; plus browser engine baseline

### Takeaway
FSRS is the best-evidenced open scheduler, beating an adapted SM-2 on log loss in nearly all of about 10k Anki collections (benchmark, secondary sources). Its parameters are fittable offline, and it is trivially cheap in JS. However, I found no chess-specific evidence that spaced repetition or knowledge tracing improves rating. Puzzle recommendation can use Lichess puzzle rating and themes directly, with Maia-based difficulty for user-game positions.

### Cited Findings
- The srs-benchmark uses log loss (primary), AUC and RMSE (bins) — [Expertium benchmark write-up](https://expertium.github.io/Benchmark.html)
- FSRS vs SM-2 (secondary sources, figures vary by version): FSRS-6 mean log loss is about 0.344 and lower than SM-2 in 99.6% of collections; another source says FSRS-5 beats trainable SM-2 in 97.4% of cases. The SM-2 baseline was adapted with extra formulas because SM-2 doesn't natively predict probabilities — [Expertium benchmark](https://expertium.github.io/Benchmark.html); [LessWrong: history of FSRS](https://www.lesswrong.com/posts/G7fpGCi8r7nCKXsQk/the-history-of-fsrs-for-anki)
- SuperMemo disputes that log loss and AUC are appropriate for measuring scheduler calibration (vendor with a competing product) — [SuperMemo blog](https://supermemo.com/en/blog/supermemo-is-better-than-fsrs-by-far)
- Lichess puzzle CSV gives Glicko-2 Rating, RatingDeviation, Popularity, NbPlays, Themes and OpeningTags, which are all usable for recommendation without ML — [database.lichess.org](https://database.lichess.org/)
- **Browser engine baseline (Stockfish.js v19.0.1):**
  - Licence: engine GPL-3.0, wrapper code MIT.
  - Lite build is about 1.6–1.7 MB; full build is about 94 MB.
  - Multi-threaded builds need COOP/COEP cross-origin isolation.
  - The README recommends lite single-threaded for most projects.
  - Source: [GitHub nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js)

### Inferences
- **FSRS for "missed moments from your own games" as review cards** has strong general memory-science evidence but untested transfer to chess skill. Present it as "review", not as a proven rating booster.
  - Implementation cost is tiny: ts-fsrs, local storage only.
  - Default parameters are fine until a user has hundreds of reviews.
- **Knowledge tracing** (BKT/DKT over theme mastery) is feasible in JS with per-theme Elo or Glicko on the user's puzzle attempts. Simple per-theme Glicko likely matches complex DKT at this data scale; that is an inference, not tested.
- **Puzzle recommendation.** Pick themes where the user's own games show Maia-typical mistakes, at a puzzle rating near their estimated level. Filter by Popularity > 0. All of this runs offline-prepared plus in-browser.
- **Stockfish choice.** The lite single-threaded build (about 1.7 MB, no special headers) suits static hosting such as GitHub Pages, which cannot set COOP/COEP headers natively. That is an inference about hosting; verify against the project's host.
- **Portfolio appeal is moderate.** FSRS is well known in ed-tech, and an A/B-style self-evaluation (retention of missed motifs) would strengthen it.

### Gaps
- No chess-specific studies found on spaced repetition, knowledge tracing or puzzle recommendation improving player strength. This is the biggest evidence gap in this section.
- I did not view the live srs-benchmark repository; FSRS figures are from secondary write-ups.
- No study found on whether puzzle-solving volume or targeting causally improves amateur ratings.
