# Competitive landscape: chess game-review and coaching products (as of Nov 2026)

Research scope note: ~17 tool calls. Primary sources were used where reachable (chess.com changelog and help center, aimchess.com, decodechess.com, Lichess blog, maiachess/arXiv). Many pricing figures for smaller products come only from aggregators or vendor comparison pages and conflict; these are flagged. Products I could not verify in this pass are listed under Gaps rather than described.

## 1. chess.com: Game Review, Coach, Insights, puzzles, lessons, AI/LLM features, free vs paid

### Takeaway
chess.com is the feature benchmark: Stockfish-based Game Review with move classifications and an animated, voiced "Coach" (celebrity voices via ElevenLabs), an AI opponent (Play Coach, June 2025), and in 2026 a layer of aggregate weakness reporting (Skills, Takeaways, Report Card, Advanced Stats) that is largely gated to Diamond. Free users get 1 full review/day, 3 puzzles/day, 1 lesson/day and 1 Play Coach game/month; the most "coaching-like" features (explanations on every move, Advanced Stats, full Takeaways) are top-tier only. Recurring user criticism targets inconsistent "Brilliant" labels and coach comments that don't make sense.

### Cited Findings
**Game Review core and evolution**
- Game Review v2 added a suggestion arrow (feedback on moves "on the fly" without a full review, Premium) and "adjusted accuracy" which lets you retry mistakes in key moves and see what accuracy would have been — [chess.com news: Game Review v2](https://www.chess.com/news/view/chesscom-launches-game-review-v2) (via search summary)
- Game Review flags when you deviate from lines in your chess.com Courses and shows the course line ("Course Check") — [chess.com news](https://www.chess.com/news/view/announcing-game-review-course-check)
- chess.com says it "fine-tuned" brilliant-move recognition "to better understand what humans identify as a brilliant move," acknowledging Brilliants were too rare/sometimes not brilliant — [chess.com Game Review update](https://www.chess.com/news/view/game-review-design-update); [support article on how Game Report works](https://support.chess.com/article/364-how-does-the-game-report-analysis-work)

**2026 changelog (official, Jan–Nov 2026)** — [chess.com "What's new"](https://www.chess.com/blog/Product/whats-new-on-chess-com)
- Oct 16, 2026: "Skills" added to Game Review and Play Coach — points across five skill categories as games are played and reviewed (web/iOS/Android)
- Jul 2, 2026: "Takeaways and an updated Report Card" in Game Review recapping strengths/weaknesses across openings, tactics, strategy, endgames — "full set for Diamond members"
- Jun 15, 2026: "Advanced Stats" — deeper insight into openings, tactics, strategy, endgames, for Diamond
- May 25, 2026: Game Review can pause on chosen move types (e.g., every blunder or brilliant); May 24: Coach can be turned off on the game-over screen
- Mar 9, 2026: Coach audio commentary during puzzles (iOS); Jul 7, 2026: animated Coach rolling out in Puzzles and Lessons
- Sep 3, 2026: puzzle themes revamped "with a more accurate algorithm"; Oct 1, 2026: puzzle library passed 1,000,000 puzzles; Aug 24, 2026: new Daily Puzzle with five-lives system and shareable results; Jun 8, 2026: percentile indicator in puzzle stats
- Nov 23, 2026: All Games Explorer and Master Games Explorer made free for all members
- Jun 2026: ML system blocks abusive Game Chat messages before sending (only ML item explicitly labelled as such in the changelog); Apr 19, 2026: analysis prefers forced mate over winning material
- Note: the changelog page does not mention LLMs/generative text anywhere for 2026.

**Coach / AI features**
- Play Coach (June 2025): first chess.com AI opponent that teaches while you play — hints, takebacks/retry, four selectable coaches — [chess.com: Announcing Play Coach](https://www.chess.com/news/view/announcing-play-coach)
- "Choose your coach": coaches modelled on chess celebrities who provide sample voices; chess.com uses ElevenLabs generative AI to produce the voices — [GamesBeat](https://gamesbeat.com/chess-com-will-let-you-choose-your-ai-coach-based-on-celebrity-voices/); [chess.com news](https://www.chess.com/news/view/choose-your-coach-on-chesscom)
- A third-party guide reports a Voice option for Coach (real-time evaluations during practice or review) and that GM Judit Polgar joined the coach roster — [user blog: Latest chess.com update guide](https://www.chess.com/blog/TheChessPhilospher/latest-chess-com-update-guide) (unofficial; not confirmed in official changelog)

**Free vs paid (official help center; prices not listed there)** — [chess.com support: Premium plans](https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me)
- Basic (free): "1 full game review analysis per day"; puzzles "3 per day"; "New to Chess" lessons + "one additional Lesson of your choice per day"; 20+ bots; "One game against the Coach per month"
- Gold: unlimited puzzles, lessons, 100+ bots, unlimited Play Coach games. Unlimited Game Review was removed from Gold in the Sept 2022 plan change — [chess.com support: Sept 1 plan changes](https://support.chess.com/en/articles/8609584-september-1st-plan-changes)
- Platinum: "UNLIMITED game review and analysis"
- Diamond: "coach explanations on all of your moves" and "Access to Advanced Stats and Brilliant Moves"
- Prices (dated, third-party, conflicting — VERIFY): Gold $29/yr, Platinum $49/yr, Diamond $99/yr per a user blog — [chess.com blog](https://www.chess.com/blog/Pipercody/the-new-prices-and-memberships); another 2024-updated article cites Platinum at $6.67/month — [chess.com blog](https://www.chess.com/blog/speedyg2/is-a-premium-chess-com-membership-worth-it-2021). Official price changes for new members took effect Sept 1 (year per [chess.com article](https://www.chess.com/article/view/prices-changing)).

**User reception / criticism**
- Many forum threads complain of wrong or missing "Brilliant" labels, pop-up summary claiming brilliants the full review doesn't show, and coach praise for weak moves (e.g., a bishop-hanging move called "solid") — [forum: Wrongly given brilliant](https://www.chess.com/forum/view/help-support/wrongly-given-brilliant-in-game-review); [forum: Fake Review Summary Showing Brilliant moves](https://www.chess.com/forum/view/game-analysis/fake-review-summary-showing-brilliant-moves); [forum: game review makes no sense sometimes](https://chess.com/forum/view/community/anybody-find-that-the-game-review-makes-no-sense-sometimes); [blog: Why the Game Review is Not Very Helpful](https://chess.com/blog/DSTirana1/why-the-game-review-is-not-very-helpful)
- Engine assumes perfect opponent replies, which makes reviews seem harsh/irrelevant at low ratings (user comment) — [forum: Chess Engine Lying?](https://www.chess.com/forum/view/game-analysis/chess-engine-lying)
- Third-party comparison: daily review cap is "a pain point for heavy reviewers"; deeper coaching paywalled — [Chessiro comparison (competitor-authored)](https://chessiro.com/blog/best-chess-analysis-tools)

### Inferences
- chess.com is moving from per-move feedback toward per-player aggregate diagnosis (Skills, Takeaways, Report Card, Advanced Stats) but gates the useful version at Diamond — the highest tier. A free tool that gives aggregate weakness diagnosis across all games directly undercuts the most expensive tier.
- The "Coach" is primarily a templated/rule-based explanation layer with generated voices; I found no official evidence of free-form LLM chat about a game. Its credibility problem is classification noise (Brilliant/Great labels), not a lack of polish.
- The "estimated rating / you played like" figure was not covered in sources I found this pass (see Gaps).

### Gaps
- Current official USD prices for Gold/Platinum/Diamond in 2026 (help center omits them; blog figures are dated and conflict).
- Official details of "Key Moments," "Retry" and the "estimated game rating" in 2026, and whether any LLM chat feature exists — not found in official 2026 changelog.
- Whether chess.com "Insights" still exists as a separate Diamond feature or has been absorbed into Advanced Stats (one third-party post says Insights requires Diamond).

## 2. Lichess: computer analysis, Learn from your mistakes, Insights, puzzles, explorer, ML (Maia)

### Takeaway
Lichess gives free, unlimited, ad-free Stockfish analysis, "Learn from your mistakes," Chess Insights, a puzzle dashboard with themes and replay of failures, and an opening explorer — the free-tier benchmark. Its weakness is explanation: engine lines and centipawn swings with no plain-language "why," and no automatic training plan from your own games. ML on Lichess mostly comes via the Maia human-like engines (U Toronto / CSSLab) offered as bots.

### Cited Findings
- "Learn from your mistakes" walks players back through their own game mistakes; free, unlimited, no ads; later called one of the best-received features — [Lichess blog: Learn from your mistakes](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes); [Lichess: Recent improvements](https://lichess.org/@/lichess/blog/recent-improvements/WJEdvicA)
- Chess Insights: tool for understanding playing style, strengths and weaknesses (free) — [Lichess blog: Chess Insights](https://lichess.org/blog/VmZbaigAABACtXQC/chess-insights); a third-party post contrasts this with chess.com requiring Diamond for insights — [chess.com user blog, 2026](https://www.chess.com/blog/Alexander-PC/stop-paying-for-chess-analysis-the-4-best-free-tools-in-2026)
- Puzzle Dashboard shows strengths/weaknesses by theme, performance and solve percentages, review of recent puzzles, replay of failed puzzles — [Lichess blog: Some Puzzling Analysis](https://lichess.org/blog/YAMFfhUAAGjN49-C/some-puzzling-analysis)
- Users still request "Learn from your mistakes across all games" and personalized puzzles from own analysis — i.e., cross-game training from own errors isn't built in — [Lichess forum](https://lichess.org/forum/lichess-feedback/create-learn-from-your-mistakes-across-all-games); [Lichess forum: personalized puzzles](https://lichess.org/forum/lichess-feedback/personalized-puzzles--turning-game-analysis-into-active-growth)
- Comparison: Lichess gives "engine lines and centipawn swings but no plain-language explanation, and nothing turns your mistakes into practice" — [Chessiro (competitor-authored)](https://chessiro.com/blog/best-chess-analysis-tools)
- Maia bots on Lichess: maia1, maia5, maia9 trained for ~1100/1500/1900; playing Maia 1100 is "like playing a committee of 1100-rated players" — [Lichess blog: Introducing Maia](https://lichess.org/blog/X9PUixUAANCqFRSh/introducing-maia-a-human-like-neural-network-chess-engine)
- Maia-2 (NeurIPS 2024): single unified model simulating any skill level; most accurate human move predictor, ~2 pp better than original Maia — [arXiv 2409.20553](https://arxiv.org/abs/2409.20553); [GitHub CSSLab/maia2](https://github.com/CSSLab/maia2)
- Maia-3: newer generation supporting ratings 600–2600 (Lichess blitz), pitched as enabling "human evaluation bars," human-like bots, new puzzle types, coaching aids, and position-difficulty measurement; Maia-2 repo recommends Maia-3 for new projects — [maiachess.com](https://maiachess.com/); [Lichess blog: Announcing maiachess.com](https://lichess.org/@/ashtonanderson/blog/announcing-maiachesscom/DWhVq7m0)

### Inferences
- Lichess sets user expectations that analysis should be free and unlimited; a new product cannot charge for raw engine review.
- Maia models (open, rating-conditioned) are the most credible ML for "what would a human at my level play" and "how hard is this position for me" — a browser-only coach could use them (if size/licensing permit) to explain mistakes relative to rating rather than to perfect play.

### Gaps
- Exact Maia-3 release date and license, and whether Maia weights are small enough to run in-browser — not verified.
- Whether Lichess uses ML for puzzle theme tagging (I believe themes are largely tagged by a rule-based generator, but found no source this pass).
- No 2026 Lichess announcements found confirming changes to these features.

## 3. Other products: Aimchess, DecodeChess, Chessable, Noctie, Chessiverse, Chessigma/Chessiro, LLM coach apps, others

### Takeaway
Specialists each own one slice: Aimchess = aggregate weakness reports + training from your games; DecodeChess = "explainable AI" prose explanations; Noctie and Chessiverse = human-like bots; Chessigma/Chessiro = free browser review plus paid AI coach; a long tail of LLM-wrapper "AI coach" apps (IQChess, "Chess Coach – AI Chess Tutor") launched 2025–2026. Pricing clusters around $8–16/month. Independent reviews of the small players are sparse; many listings are vendor- or aggregator-written.

### Cited Findings
**Aimchess** (Play Magnus brand — [playmagnusgroup.com](https://playmagnusgroup.com/brands/aimchess); Play Magnus was acquired by chess.com, from my background knowledge, not verified this pass)
- Analyzes recent games across six areas: tactics, endgame, advantage capitalization, resourcefulness, time management, opening performance; compares you with players at your rating; aggregate (not per-move) analysis — [aimchess.com](https://aimchess.com/)
- Training: personalized lessons from your mistakes plus GM/coach lessons (Blunder Preventer, Intuition Trainer, Blindfold Tactics, Checkmate Patterns); weekly personalized study plan; Premium adds statistics, coach sharing, multi-account tracking (chess.com, Lichess, Chess24) — [aimchess.com](https://aimchess.com/)
- Pricing: free tier = one 40-game report/month + one daily training session; Premium $7.99/month or $57.99/year ($4.85/mo) — [aimchess.com](https://aimchess.com/)
- Reception: "priced pretty fair" (user review) — [chess.com blog: Aimchess review](https://www.chess.com/blog/SheldonOfOsaka/aimchess-a-review); aggregator reports ~3.5/5 app rating with complaints of authentication failures and Lichess sync issues in mid-2026 (thin, possibly AI-generated source) — [stork.ai](https://www.stork.ai/en/aimchess); App Store listing — [Apple](https://apps.apple.com/us/app/aimchess-learn-chess-online/id1524941307)

**DecodeChess**
- Explains moves in plain language: threats, good moves, plans, function of each piece, key concepts; also a human-like adaptive opponent — [decodechess.com](https://decodechess.com/)
- Describes itself as "Explainable AI (XAI)" combining chess-master insight with Stockfish NNUE; no mention of LLMs — [decodechess.com](https://decodechess.com/)
- Pricing: freemium with subscriptions and pay-as-you-go credit packs (aggregator, Aug 2026) — [stork.ai](https://www.stork.ai/en/decodechess); "from $8/month" per a comparison page — [comparison](https://d8uzp82hd82jh.cloudfront.net/comparison/decodechess/vs/chessable) (unverified)

**Noctie (noctie.ai)**
- Human-like AI opponent that adapts to skill level and mirrors human decision-making and timing — [G2](https://www.g2.com/products/noctie-ai/reviews); opening practice where the AI "plays the most common human responses"; vendor-side claim of training on >1 billion human games (unverified) — [skywork.ai deep dive](https://skywork.ai/skypage/en/Noctie.ai:-A-Deep-Dive-into-Your-Human-like-AI-Chess-Coach/1976112012280393728)
- Pricing: ~$15–16.09/month per aggregators — [AlternativeTo](https://alternativeto.net/software/noctie-ai/about); [theresanaiforthat](https://theresanaiforthat.com/ai/noctie/); App Store: free with IAP — [Apple](https://apps.apple.com/app/id6444289077)
- No independent in-depth reviews found.

**Chessiverse**
- 600+ human-like AI bots (user review) — [chess.com blog: Chessiverse review](https://www.chess.com/blog/vitualis/chessiverse-review-amazing-600-human-like-chess-ai-bots)
- Pricing conflicts on its own pages: Premium "$9.99/month unlocks everything" vs "$15/month" (April 2026); free tier includes playable bots — [Chessiverse vs Chess.com](https://chessiverse.com/compare/chessiverse-vs-chess-com); [Best app for practicing openings](https://chessiverse.com/compare/best-app-for-practicing-chess-openings)

**Chessigma / Chessiro (free browser review + paid AI coach)**
- Chessigma: web analyzer running Stockfish in the browser, no signup, depth-50 claim, moves graded "Sigma to Clown," "no login, no paywall" (vendor claim) — [chessigma.com: how analysis works](https://www.chessigma.com/blog/how-chessigma-analysis-works); paid plans add "Froggy" AI coach, daily plan, "Chess DNA" report — [Chessiro comparison](https://chessiro.com/blog/best-chess-analysis-tools); Google Play ~711 reviews, complaints of slow game loading — [Google Play](https://play.google.com/store/apps/details?id=com.chessigma.app)
- Chessiro: Stockfish 19 review, accuracy, eval graph, opening detection, "Smart Shuffle" puzzles built from your mistakes, AI coach explaining mistakes in plain English; free tier unlimited review + monthly AI allowance; paid = coach credits — [Chessiro (self-authored)](https://chessiro.com/blog/best-chess-analysis-tools)
- Conflict: Chessiro says Chessigma runs Stockfish "in the cloud"; Chessigma says in-browser — same sources as above.

**LLM "AI chess coach" apps (2025–2026)**
- IQChess — "ChatGPT Chess Coach," Montreal company, launched 2025, iPhone/Android/web; AI explains moves while an engine checks every move — [iqchess.org](https://www.iqchess.org/) (vendor page; usage figures self-reported)
- "Chess Coach – AI Chess Tutor" (Android) — lists Gemini, GPT, Claude, DeepSeek and Qwen as backends; 5 free AI analyses — [Google Play](https://play.google.com/store/apps/details?id=com.app.cheescoach&hl=en_US)
- Hobby/capstone builds: LangChain + Stockfish + OpenRouter tutors (2025) — [Medium: agentic chess tutor](https://medium.com/@nehaprasad25/what-i-learned-building-an-agentic-chess-tutor-with-ai-65b3e5d4ac3a); [Medium: Chess Coach using Gen AI](https://medium.com/@bilge.yilmazar/a-chess-coach-using-gen-ai-419256307f46); an LLM-opponent site (Jan 2026) where the model sees only PGN, no board/search — [Lichess forum](https://lichess.org/forum/general-chess-discussion/i-made-a-website-where-you-can-play-chess-against-an-llm-thoughts)
- Chessvision.ai exists but is a position scanner (diagram/screen-to-board, video lookup), not a game reviewer — [App Store](https://apps.apple.com/app/id1574933453)

### Inferences
- The credible LLM pattern is "engine decides, LLM narrates"; pure-LLM analysis is not credible (LLMs hallucinate moves). The common business model is credits/limits because LLM calls cost money — a browser-only coach with no server LLM can offer unlimited explanations only if explanations are generated locally (templates over engine + motif detection, or a small on-device model).
- Aimchess is the closest analogue to an aggregate weakness coach; its free tier (1 report/month) is the gap a free tool can fill.
- Human-like opponents (Maia/Noctie/Chessiverse) are a crowded differentiator; human-likeness for *explanation* (rating-relative mistake severity) is less exploited.

### Gaps
- Not verified this pass (do not describe without checking): Chessable MoveTrainer details and 2026 pricing (Chessable is chess.com-owned per my background knowledge), ChessBase 26 / Fritz 20 features, Listudy, ChessTempo, Chess Steps apps, "Chesscoach.ai", "ChessGPT"-branded apps. A ChatGPT app "Openings, puzzles, game facts" appeared in search results but its owner wasn't confirmed.
- No Reddit threads surfaced for Aimchess/Noctie sentiment; reception data for small players is from aggregators.
- No adoption numbers for Aimchess, DecodeChess, Noctie, Chessiverse, IQChess.

## 4. Table stakes vs differentiators vs unmet needs

### Takeaway
Table stakes: free Stockfish review with accuracy, eval graph and move classifications; puzzles with themes; opening explorer; importing chess.com/Lichess games. Differentiators: plain-language explanations, aggregate cross-game weakness reports, personalised training from own mistakes, human-like (rating-aware) opponents, voiced/animated coaches. Unmet: these differentiators are paywalled, rationed by credits, or unreliable — nobody offers all of them free, unlimited and private.

### Cited Findings
- Free unlimited engine review is standard (Lichess, Chessigma, Chessiro free tier) — [Chessiro comparison](https://chessiro.com/blog/best-chess-analysis-tools); [chess.com user blog: 4 best free tools 2026](https://www.chess.com/blog/Alexander-PC/stop-paying-for-chess-analysis-the-4-best-free-tools-in-2026)
- chess.com free review capped at 1/day; per-move coach explanations and Advanced Stats Diamond-only — [chess.com support](https://support.chess.com/en/articles/8562418-what-does-each-level-of-premium-membership-get-me)
- chess.com Takeaways/Report Card full set Diamond-only (Jul 2026) — [chess.com changelog](https://www.chess.com/blog/Product/whats-new-on-chess-com)
- Aimchess free = 1 report/month — [aimchess.com](https://aimchess.com/)
- LLM coach apps ration explanations via credits (5 free analyses; Chessiro coach credits; Chessigma paid Froggy) — [Google Play](https://play.google.com/store/apps/details?id=com.app.cheescoach&hl=en_US); [Chessiro](https://chessiro.com/blog/best-chess-analysis-tools)
- Lichess users ask for cross-game "learn from mistakes" and personalised puzzles from own games — [Lichess forum](https://lichess.org/forum/lichess-feedback/create-learn-from-your-mistakes-across-all-games)
- Classification trust issues at chess.com (Brilliant labels, coach praise of bad moves) — [chess.com forum](https://www.chess.com/forum/view/help-support/wrongly-given-brilliant-in-game-review)

### Inferences
- Gaps a free, private, browser-only coach can credibly fill:
  1. Aggregate weakness diagnosis across all recent games (what chess.com sells at Diamond and Aimchess rations to 1/month), computed locally.
  2. Mistake-to-drill loop: turn own blunders into spaced-repetition puzzles across all games (requested on Lichess; Chessiro paywalls "unlimited Smart Shuffle").
  3. Rating-relative judgement: "a 1200 would usually find this / this was hard" using Maia-style human models, addressing the "engine assumes perfect play" complaint.
  4. Trustworthy, conservative labels and explanations grounded in engine lines (avoid Brilliant inflation and LLM hallucination).
  5. Privacy: no account, no upload — none of the reviewed products markets this explicitly (Chessigma's "no signup" is closest).
- Weak areas to avoid competing on: celebrity voices/animation, giant puzzle libraries (chess.com 1M+), human-like bot catalogues (Chessiverse 600+).

### Gaps
- No quantitative user research found comparing which features drive retention or improvement.

## 5. Adoption, users and revenue data

### Takeaway
chess.com dominates by scale (267M+ members, 10.2M DAU, ~2M paying, revenue roughly $150–200M); no adoption data was found for the specialist coaching products.

### Cited Findings
- 267M+ members as of June 30, 2026; 10.2M daily active users; 2.5B games in Q2 2026; 14.2M new accounts in the quarter — [chess.com Q2 2026 board report](https://www.chess.com/board-reports/2026-q2)
- 252M+ members at Mar 31, 2026 (250M milestone) — [chess.com Q1 2026 board report](https://www.chess.com/board-reports/2026-q1); [chess.com news: 250M members](https://www.chess.com/news/view/chesscom-reaches-250-million-members)
- ~2M paying members and ~$150M revenue (ads ~10%), per Adweek via — [Pulse.bot](https://www.pulse.bot/digital-marketing/news/chesscom-surpassed-250-million-users-and-is-launching-a-new-advertising-gambit-e8af1591-21c3-4e7b-abff-3eb21dc09ca1/); earlier 1.5M paying at 200M members — [TechCrunch](https://techcrunch.com/?p=2998565); ~$200M expected for the year per — [Dealroom](https://dealroom.co/news/145021-chess-com-s-founder-on-a-56-000-domain-no-vc-and-a-billion-player-missio/) (revenue figures conflict; no official number)
- CVC Capital Partners invested in chess.com (June 2026, undisclosed amount) — [PocketGamer.biz](https://www.pocketgamer.biz/cvc-capital-partners-invests-in-chesscom-to-support-global-growth)
- Chessigma: ~711 Google Play reviews (proxy only) — [Google Play](https://play.google.com/store/apps/details?id=com.chessigma.app)

### Inferences
- Only ~0.75% of chess.com members pay (2M / 267M), so the vast majority of players use the free tier with 1 review/day and no aggregate diagnosis — the addressable audience for a free coach is large.

### Gaps
- Lichess user/traffic numbers for 2026, and any user counts or revenue for Aimchess, DecodeChess, Chessable, Noctie, Chessiverse, IQChess.
