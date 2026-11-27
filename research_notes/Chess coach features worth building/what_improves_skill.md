# What Measurably Improves Chess Skill for Beginner and Improving Players (about 200-1500)

Evidence grading used throughout:
- **[STUDY]**: peer-reviewed or controlled or large-sample research.
- **[PLATFORM]**: observational data from platform users or vendors. No control group, so selection bias is likely.
- **[EXPERT]**: coaching opinion or books.
- **[ANECDOTE]**: forum posts and personal reports.

Caveat on the whole field: nearly all chess-expertise research uses tournament players, often club-level to grandmaster. I found **no controlled trial of any training method on adult or teen players rated 200-1500**. Findings below on deliberate practice come mostly from rated over-the-board players and are retrospective and correlational.

Research ran on 2026-11-26. Several Lichess blog pages returned HTTP 403, so some platform numbers come from search-result snippets rather than full pages. Each such item is flagged.

---

## 1. Deliberate practice in chess: which activities predict rating?

### Takeaway
Across studies of rated players, accumulated **serious study alone** is the strongest single predictor of rating. Tournament play and formal instruction also correlate. But practice explains only about a third of the variance in skill, and the hours needed to reach a given level vary 8-fold between players. Cognitive ability matters too, and **matters most at lower skill levels and in younger players**, which is this product's audience.

### Cited Findings
- **[STUDY] Charness, Tuffiash, Krampe, Reingold & Vasyukova (2005), *Applied Cognitive Psychology* 19:151-165.**
  - Accumulated hours of serious study alone, tournament play and formal instruction were all significant bivariate correlates of tournament rating.
  - In multivariate regression, "serious study alone was the strongest predictor of chess skill in both samples."
  - Grandmasters reported about 5,000 hours of serious solo study in their first decade of serious play, roughly 5x the average for intermediate players.
  - Data are retrospective self-reports. In a validation check, diary and recalled weekly solo-study hours correlated at about .6, and recall ran higher (4.38 h vs 3.7 h per week).
  - Sources: [Burgoyne et al. 2019 reanalysis (PDF)](https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf); [Burgoyne 2019, Purdue copy](https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/Burgoyne-ImpactDomainSpecificExperience-2019.pdf); [MPG record](https://pure.mpg.de/pubman/item/item_2101081_4)
- **[STUDY] Burgoyne et al. (2019), *American Journal of Psychology*.** This reanalysed the Charness data with structural equation modelling. After correcting for measurement error, deliberate practice estimates "accounted for 34% of the variance in chess expertise." Tournament play (competition) is treated as domain-specific experience distinct from deliberate practice. — [Burgoyne et al. 2019 (PDF)](https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf)
- **[STUDY] Hambrick et al. (2014), as summarised secondarily.** Deliberate practice explained about 34% of the reliable variance in chess performance, leaving about 66% unexplained. The authors conclude practice is "not sufficient." — [BPS Research Digest](https://www.bps.org.uk/research-digest/exploding-10000-hours-myth-its-no-guarantee-greatness); [Chang & Lane 2018, Journal of Expertise](https://www.journalofexpertise.org/articles/volume1_issue1/JoE_2018_1_1_Chang_Lane.pdf)
- **[STUDY] Gobet & Campitelli (2007), *Developmental Psychology*.**
  - Sample: 104 Argentine players, from weak amateurs to grandmasters.
  - Average practice to reach master level was about 11,053 h. The range ran from 3,016 h (fastest) to 23,608 h (slowest), about 8x.
  - Some players with more than 25,000 h of practice never reached master level.
  - Group practice predicted high-level skill better than individual practice in this sample.
  - Sources: [core.ac.uk PDF](https://core.ac.uk/download/334665.pdf); [APS press release](https://www.psychologicalscience.org/news/releases/deliberate-practice-necessary-but-not-sufficient.html); [ChessBase summary](https://en.chessbase.com/post/handedne-practice-and-talent-in-che)
- **[STUDY] Reanalysis of the Gobet & Campitelli sample.** Mean hours of practice were 10,530 for masters (SD 7,414), 5,673 for experts (SD 4,654) and 3,179 for intermediates (SD 4,615). The groups overlap heavily. — [Chang & Lane 2018](https://www.journalofexpertise.org/articles/volume1_issue1/JoE_2018_1_1_Chang_Lane.pdf)
- **[STUDY] ChessBase summary of the same Argentine research.** Stronger players tended to own more chess books. — [ChessBase](https://en.chessbase.com/post/handedne-practice-and-talent-in-che)
- **[STUDY] Burgoyne et al. (2016), *Intelligence*, meta-analysis of cognitive ability and chess skill.**
  - Coverage: 19 studies and about 1,800 participants, screened from about 2,300 articles. Skill was measured mainly by Elo.
  - Chess skill correlated with fluid reasoning (r = .24), comprehension-knowledge (r = .22), short-term memory (r = .25) and processing speed (r = .24).
  - **The link was stronger in young players and at lower skill levels.**
  - Sources: [Burgoyne 2016 PDF (UZH)](https://www.psychologie.uzh.ch/dam/jcr:4b13cd49-3e58-409f-988e-1e73693e1e0b/Burgoyne.Intelligence.2016.pdf); [ScienceDaily](https://www.sciencedaily.com/releases/2016/09/160913124722.htm); [MSU Today](https://msutoday.msu.edu/news/2016/study-links-intelligence-and-chess-skill)
- **[STUDY] Ericsson's framing.** Ericsson's framework treats deliberate practice (effortful activity designed to improve current performance, with feedback) as the main source of individual differences. In chess, the closest match is serious solitary study, not tournament play. — [Burgoyne et al. 2019](https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf); [Chang & Lane 2018](https://www.journalofexpertise.org/articles/volume1_issue1/JoE_2018_1_1_Chang_Lane.pdf)

### Inferences
- An app that turns casual play into structured, effortful study (working through one's own mistakes and solving positions) targets the single activity most associated with skill. Unlike "play more games," this is something software can scaffold.
- Practice explains only about a third of variance, and players need 8x different hours to reach the same level. So progress messaging should avoid promising fixed timelines ("X puzzles = +Y rating").
- Cognitive ability matters most at low ratings. That suggests working-memory-friendly design for beginners: short explanations and one idea at a time (see section 4).
- Group practice predicted skill in the Argentine sample. A social or club component (shared lessons, coach, study groups) may have value, though this is one sample of 104 players.

### Gaps
- None of these studies isolate specific activities within "serious study." Puzzles, own-game analysis, book study and opening work are all lumped together, so the literature cannot rank them.
- The studies are retrospective and correlational, with samples skewed toward club players and above. No sub-1000 samples were found.
- I could not open the Charness 2005 full text to report sample sizes per country or exact regression coefficients.
- I could not verify the specific claim, often attributed to Ericsson, that "predicting the master's move" or "analysing your own games" was singled out as deliberate practice. The search did not surface the primary text.

---

## 2. Tactics, puzzles, spaced repetition, and reviewing your own games

### Takeaway
Puzzle and game ratings correlate strongly on Lichess (r around 0.7-0.86). But **no controlled study shows that puzzle training causes rating gains**. The best causal-ish data is a vendor's observational analysis reporting about +35 Elo, with smaller gains above 1600 and larger gains for repeated cycles.

Spaced repetition has strong general learning-science support, but **no peer-reviewed evidence specific to chess (including Chessable's MoveTrainer)** was found.

No study comparing reviewing your own games with studying others' games was found. Support for own-game review rests on expert consensus plus general feedback research.

### Cited Findings
**Puzzles and tactics**
- **[PLATFORM, from snippet]** A Lichess blog analysis of about 24,000 players found that higher puzzle ratings go with higher game ratings. The author explicitly says "we only looked at correlation, not causation." — [Lichess blog: "Do puzzles matter? A data analysis"](https://lichess.org/@/ggSayItBack/blog/do-puzzles-matter-a-data-analysis/twAyjQDX)
- **[PLATFORM, from snippet]** A forum post reported a correlation of 0.74 between puzzle rating and classical rating. The sample was 71,820 Lichess players with at least 100 classical games and at least 100 puzzles. — [Lichess forum](https://lichess.org/forum/general-chess-discussion/low-correlation-between-puzzle-proficiency--rating-implications-for-chess-improvement)
- **[PLATFORM, from snippet]** A Puzzle Storm (speed-tactics) score analysis found correlations of about 0.863 with blitz and bullet ratings, but only 0.684 with puzzle rating. This suggests fast pattern recognition tracks fast-chess strength. — [Lichess blog (capibarazul)](https://lichess.org/@/capibarazul/blog/how-does-lichess-puzzle-storm-relates-to-blitzbullet-rating/YHjkeKJl)
- **[PLATFORM, vendor, from snippet]** Disco Chess analysed 431,000 Woodpecker-method puzzles and 60,000 rated games.
  - Users gained about +35 Elo.
  - Gains were smaller above 1600.
  - Multi-cycle users gained more than single-cycle users.
  - The vendor itself notes the correlation "is consistent with causation but does not prove it."
  - Source: [Lichess blog (DiscoChessApp)](https://lichess.org/@/DiscoChessApp/blog/woodpecker-method-training-431000-puzzles-60000-rated-games-and-35-elo/yrWsFF1N)
- **[STUDY, small]** A study of 1,256 Lichess players found starting rating strongly influences subsequent rating change. Any "gain" metric must control for regression to the mean and starting level. — [Journal of Emerging Investigators (PDF)](https://emerginginvestigators.org/articles/25-024/pdf)
- **[EXPERT] de la Maza, *Rapid Chess Improvement* (2002).**
  - Method: go through one set of tactics problems seven times in shrinking time (the "seven circles"). Nunn describes it as about 1,000 problems x 7.
  - The method grew out of the author's article "400 points in 400 days," in which he went from about 1321.
  - Reception is mixed. Silman's review is harshly critical. De la Maza quit chess after reaching about 2000 USCF and later said he doesn't agree with everything in the book.
  - n = 1, so this is anecdote.
  - Sources: [Chess.com: The Michael de la Maza Story](https://www.chess.com/article/the-michael-de-la-maza-story); [Silman review](https://www.jeremysilman.com/book-review/rapid-chess-improvement/); [High Ground Chess](https://highgroundchess.substack.com/p/rapid-chess-improvement); ["400 Points" PDF](https://stochasticgeometry.ie/~mdennehy/400Points.pdf)

**Spaced repetition (Chessable and similar)**
- **[STUDY, general learning science]** Dunlosky et al. (2013) rated **distributed practice** and **practice testing** the only two "high utility" techniques of the 10 reviewed. — [APS press release](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html); [Duke Scholars](https://scholars.duke.edu/publication/954654)
- **[PLATFORM / marketing]** Chessable's app listing says MoveTrainer is based on cognitive research, but it cites no studies and reports no rating outcomes. — [App Store listing](https://apps.apple.com/us/app/chessable/id1523279049)
- **[EXPERT]** Andy Matuschak, a learning-tools researcher, argues MoveTrainer drills move recall and has no mechanism for reinforcing conceptual knowledge. — [Matuschak notes](https://notes.andymatuschak.org/zDr94hP6bG3jJYrdYy8B5hx)
- **[ANECDOTE / PLATFORM]** A Lichess blog reports "modest improvement in tactical awareness" among Woodpecker users and argues some parts of chess suit spaced repetition and others don't. — [Lichess blog (zig_zag_zug_zwang)](https://lichess.org/@/zig_zag_zug_zwang/blog/a-data-driven-approach-to-chess-improvement-part-1-srs--woodpecker-method/i2k8ZqAn)

**Own games vs others' games**
- **[STUDY, general]** Feedback has a medium average effect on learning: d = 0.48 across 435 studies (k = 994, N > 61,000), with large heterogeneity. Hattie & Timperley (2007) found inconsistent results on immediate vs delayed feedback. — [Wisniewski, Zierer & Hattie 2020, Frontiers in Psychology](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.03087/full)

### Inferences
- Puzzle and rating correlations are strong, but they are confounded: stronger players solve better puzzles. The vendor data is the only longitudinal signal, and it is small (+35) and biased.
- The most defensible claim is "tactics drilling is associated with modest gains, largest below about 1600." That fits the product's 200-1500 band.
- **Repeating the same positions** (Woodpecker cycles, de la Maza circles) is the common thread in both the vendor data and the expert method. Combined with spaced-practice science, it suggests resurfacing **the user's own missed positions** at spaced intervals.
- Spaced repetition suits pattern and move recall (tactical motifs, mates, basic endings) better than conceptual understanding. Keep it to concrete "find the move" items.
- Own-game review gives personally relevant feedback. That is the strongest general lever (feedback, d around 0.5), but there is no chess-specific comparison against studying master games.

### Gaps
- No RCT on puzzle training and rating at any level was found. Chess-in-schools research exists, but it measures transfer to maths and IQ, not chess rating. It was not covered here.
- No peer-reviewed study of Chessable or MoveTrainer outcomes was found.
- No study comparing own-game analysis with master-game study was found.
- Full Lichess blog texts could not be fetched (403), so sample filters and rating-band breakdowns are unverified.

---

## 3. Blunder checks, slowing down, slower time controls, openings

### Takeaway
There is **no empirical study** on blunder-check routines, time-control choice for learning, or opening study at low ratings. These rest on **expert consensus**.
- Below club level, games are decided by hanging pieces and missed forcing moves.
- A "checks, captures, threats" scan of both sides (Heisman) is the standard prescription.
- Coaches broadly put tactics and basic endings ahead of openings. The real disagreement is between "learn principles plus the first 3-5 moves" and "ignore openings entirely," not over whether openings deserve heavy study.

### Cited Findings
- **[EXPERT] Dan Heisman (NM), *Is Your Move Safe?* and *Looking for Trouble*.**
  - Safety check: consider the opponent's checks, captures and threats (forcing moves) on their next move.
  - In tactical positions, consider all forcing moves for both sides, "usually in that order."
  - His tactics hierarchy starts with en prise (unguarded, capturable) pieces.
  - Sources: [New in Chess excerpt PDF](https://www.newinchess.com/media/wysiwyg/product_pdf/7631.pdf); [Looking for Trouble (Everand)](https://www.everand.com/book/257703670/Looking-for-Trouble-Recognizing-and-Meeting-Threats-in-Chess); [Heisman's chess.com guide](https://www.chess.com/blog/danheisman/a-guide-to-using-nm-heismans-chess-improvement-video-channel)
- **[EXPERT] IM Daniel Rensch (ChessKid).** Beginners focus only on their own ideas and threats and neglect the opponent's. — [ChessKid](https://www.chesskid.com/learn/articles/checks-captures-queen-attacks)
- **[EXPERT, secondary]** "At beginner level, games are usually decided by blunders, loose pieces, and missed checks rather than subtle long-term plans." — [Chessworld beginner guide](https://www.chessworld.net/chessclubs/openingguide/howtoplaychess.asp)
- **[ANECDOTE / EXPERT] Openings.**
  - Coach Darko Polimac: openings are "not important for beginners." He cites a student who reached 1000 in about 10 weeks with no opening prep by drilling tactics and simple endings on a daily routine. — [Chess.com forum](https://www.chess.com/forum/view/for-beginners/the-openings-are-not-important-for-beginners-fact)
  - A Lichess guide calls deep opening memorisation futile for beginners: learn the first 3-5 moves and play. — [Lichess Beginner's Guide](https://af.lichess.org/@/Gordima/blog/beginners-guide/1Cq8Athk)
  - **Counterpoint:** a chess.com blog calls "don't study openings until 1500" a recipe for frustration and argues for opening principles and piece placement. — [Stop Gatekeeping Opening Study](https://www.chess.com/blog/MattyDPerrine/stop-gatekeeping-opening-study); [Working on Openings Below 2000](https://www.chess.com/blog/Armand_Spenser/working-on-opening-below-2000)
- **[ANECDOTE] Time controls.** Informal Lichess observations say ratings typically drop about 100-200 points (sometimes 300 or more) from classical to rapid to blitz to bullet. No dataset was found measuring which time control produces the most *improvement*. — [Lichess forum](https://lichess.org/forum/general-chess-discussion/rating-difference-across-time-controls)

### Inferences
- A blunder-check habit, and a "hung piece / missed forcing move" taxonomy for classifying mistakes, matches the consensus picture of what decides games at 200-1500. It is the highest-value thing to detect and coach, even though no study validates the routine itself.
- Opening features should be light: principles and "your first few moves" deviations. They should not be repertoire memorisation. This is consensus, not evidence.
- Encouraging slower time controls for learning is plausible because it gives time to run the blunder-check. But no chess data was found, so frame it as advice.

### Gaps
- No study measures whether a blunder-check routine reduces blunder rate or raises rating.
- No platform analysis was found comparing rating gains for players who mostly play rapid or classical against those who mostly play blitz or bullet. Lichess's open game database could support one.
- No source was found quantifying what fraction of games at 200-1500 are decided by one-move blunders. An engine pass over Lichess data could answer this.

---

## 4. Learning-science implications for presenting mistakes

### Takeaway
The strongest findings argue for:
- making the player **attempt the move before showing the answer**: retrieval practice, and benefits even from failed retrieval attempts;
- **spacing** re-exposure to missed positions;
- giving **corrective feedback**.

Expertise-reversal and cognitive-load research argues for **short, worked-example-style explanations for weaker players**, fading to problem-solving as skill grows. All of this is general learning science, **not chess-specific**.

### Cited Findings
- **[STUDY] Dunlosky et al. (2013), *Psychological Science in the Public Interest* 14(1):4-58.**
  - Of 10 techniques, practice testing (retrieval) and distributed practice were rated **high utility**.
  - Elaborative interrogation, self-explanation and interleaved practice were rated **moderate**.
  - Rereading, highlighting, summarisation, keyword mnemonic and imagery for text were rated **low**.
  - Sources: [APS](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html); [Kent State](https://www.kent.edu/kent/news/success/all-study-strategies-not-created-equal-according-kent-state-researchers)
- **[STUDY] Kornell, Hays & Bjork (2009).** Unsuccessful retrieval attempts *enhanced* later learning, even with materials designed to make retrieval fail. — [PubMed 19586265](https://pubmed.ncbi.nlm.nih.gov/19586265/)
- **[STUDY] Richland, Kornell & Kao (2009), pretesting effect.** Across 5 experiments, pretesting improved learning even for items answered *incorrectly* on the pretest. — [PubMed 19751074](https://pubmed.ncbi.nlm.nih.gov/19751074/); [PDF](https://learninglab.uchicago.edu/Pre-Testing_files/RichlandKornellKao.pdf)
- **[STUDY] Caveat on the above.** Knight et al. (2012) report that failed retrieval attempts with immediate feedback can sometimes *impair* learning, so the benefit is not universal. — [Knight 2012 PDF](https://amalab.uta.edu/files/2021/12/knight-2012-2.pdf); [Grimaldi & Karpicke 2012](https://learninglab.psych.purdue.edu/downloads/2012/2012_Grimaldi_Karpicke_MC.pdf)
- **[STUDY] Expertise reversal effect (Kalyuga 2007, *Educational Psychology Review*).**
  - Worked examples help novices but lose effectiveness, and can hurt, as task-specific expertise grows. Explanations become extraneous load for learners who can self-explain.
  - Recommended design: **faded worked examples** that move learners from studying solutions to solving problems.
  - Caveat: most evidence comes from well-structured tasks such as mechanics.
  - Sources: [Kalyuga 2007 (Springer)](https://link.springer.com/article/10.1007%2Fs10648-007-9054-3); [Kalyuga 2007 PDF](https://www.uky.edu/~gmswan3/EDC608/Kalyuga2007_Article_ExpertiseReversalEffectAndItsI.pdf); [Wikipedia overview](https://en.wikipedia.org/wiki/Expertise_reversal_effect)
- **[STUDY] Feedback (Wisniewski, Zierer & Hattie 2020).** Average d = 0.48 with large heterogeneity. Feedback containing more information is more effective. Timing results (immediate vs delayed) are inconsistent in prior syntheses. — [Frontiers](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.03087/full)
- **[STUDY] Cognitive ability matters more at low chess skill** (Burgoyne 2016, above). This adds support for low-load presentation for this audience. — [Burgoyne 2016](https://www.psychologie.uzh.ch/dam/jcr:4b13cd49-3e58-409f-988e-1e73693e1e0b/Burgoyne.Intelligence.2016.pdf)

### Inferences
These are design implications, extrapolated from general learning science.
- **Make the player find the move first.** This is supported by the retrieval-practice and pretesting literature, including failed attempts. Then show the answer with a brief reason. Watch the Knight et al. caveat: keep failure cheap and follow it quickly with clear corrective feedback.
- **Keep explanations short for low-rated players.** Use one worked example of the motif ("the knight was undefended, so..."), then fade to "find it yourself" on later recurrences. This is expertise reversal applied per motif, not per user.
- **One lesson per game** is consistent with cognitive-load theory and the low-skill sensitivity to working memory. It is not directly tested in chess.
- **Resurface missed positions on a spaced schedule** (distributed practice plus testing). This is the strongest combination in Dunlosky's review.
- **Interleaving** motifs, rather than blocking all forks together, is only moderately supported. It is a reasonable default for review queues.

### Gaps
- No chess-specific test of "guess first vs show answer," explanation length, or one-lesson-per-game was found.
- Feedback-timing evidence (immediate post-move vs post-game) is inconsistent in the literature. No chess-specific study was found. Kulik & Kulik (1988) was not retrieved.
- Roediger & Karpicke (2006) on the testing effect was not directly retrieved. Dunlosky (2013) is cited instead.

---

## 5. Knowing your weaknesses, habits, and progress tracking

### Takeaway
No chess study shows that diagnosing recurring weaknesses across many games improves rating. The general evidence is decent: **progress monitoring improves goal attainment (d = 0.40, 138 RCTs)**, and feedback improves learning (d = 0.48). Effects are larger when progress is recorded and when outcomes are made public. Monitoring a *behaviour* changes that behaviour, not necessarily the outcome.

### Cited Findings
- **[STUDY] Harkin et al. (2016), *Psychological Bulletin*.**
  - Scope: 138 randomised experiments, N = 19,951.
  - Progress-monitoring interventions increased monitoring frequency (d = 1.98) and goal attainment (**d = 0.40, 95% CI 0.32-0.48**).
  - Changes in monitoring frequency mediated the effect.
  - Effects were larger when progress was physically recorded and when outcomes were reported or made public.
  - Most studies were health-related, so generalise with caution. Secondary coverage gives 133 studies.
  - Monitoring behaviour changed behaviour but not the related outcome. Monitoring the outcome changed the outcome but not the behaviour.
  - Sources: [White Rose repository](https://eprints.whiterose.ac.uk/id/eprint/87431/); [APA press release](https://www.apa.org/news/press/releases/2015/10/progress-goals?hl=pt-BR); [ScienceForWork summary](https://scienceforwork.com/blog/goal-monitoring/)
- **[STUDY] Feedback meta-analysis**, d = 0.48 (above). — [Wisniewski et al. 2020](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.03087/full)
- **[ANECDOTE / PLATFORM]** A Lichess blogger describes using game analytics to find hidden strengths and weaknesses. This is a self-report with no outcome data. — [Lichess blog (DeepLies)](https://lichess.org/@/DeepLies/blog/chess-analytics-revealed-how-i-discovered-my-hidden-strengths-and-weaknesses/VqqHKbRC)
- **[STUDY, analogous]** Deliberate practice, by Ericsson's definition, is designed to target current weaknesses with feedback. Solo serious study was the strongest chess predictor. — [Burgoyne et al. 2019](https://englelab.gatech.edu/articles/2019/Burgoyne_et_al_2019_AJP.pdf)

### Inferences
- A "habits" or recurring-weakness view is well grounded *as feedback* and as targeting for deliberate practice. Its specific effect on chess rating is unproven.
- Harkin's behaviour-vs-outcome split matters for design.
  - Track **both** the behaviour (for example, "blunder-checked before moving," or "hung-piece rate per game") and the outcome (rating).
  - Showing only rating may not change habits. Showing only habit metrics may not move rating.
- A physically recorded or persistent progress view is supported. Optional sharing or public commitment may raise effects, per Harkin's moderator.

### Gaps
- No chess-platform data was found linking use of weakness reports or game-review features (for example chess.com Game Review, or Lichess Insights) to subsequent rating gain.
- No evidence was found on whether streaks or gamified tracking increase practice volume in chess specifically.

---

## 6. Large-platform data on what correlates with improvement

### Takeaway
Public platform data is thin and mostly community-made.
- **Strong cross-sectional puzzle-rating correlations** exist (r about 0.74 for classical; about 0.86 for Puzzle Storm vs blitz).
- **One vendor longitudinal analysis** reports about +35 Elo from Woodpecker-style repetition, with smaller gains above 1600.
- **No official chess.com or Lichess study** was found on what predicts rating gain.

### Cited Findings
- Puzzle vs classical rating correlation: 0.74 across 71,820 players. — [Lichess forum](https://lichess.org/forum/general-chess-discussion/low-correlation-between-puzzle-proficiency--rating-implications-for-chess-improvement)
- Puzzle Storm vs blitz and bullet: about 0.863; vs puzzle rating: 0.684. — [Lichess blog](https://lichess.org/@/capibarazul/blog/how-does-lichess-puzzle-storm-relates-to-blitzbullet-rating/YHjkeKJl)
- About 24,000-player puzzle/rating analysis: correlational only. — [Lichess blog](https://lichess.org/@/ggSayItBack/blog/do-puzzles-matter-a-data-analysis/twAyjQDX)
- Woodpecker: 431k puzzles and 60k games gave about +35 Elo. Gains were smaller above 1600, and multiple cycles beat a single cycle. — [DiscoChess on Lichess](https://lichess.org/@/DiscoChessApp/blog/woodpecker-method-training-431000-puzzles-60000-rated-games-and-35-elo/yrWsFF1N)
- Starting rating strongly predicts rating change (1,256 Lichess players). — [JEI PDF](https://emerginginvestigators.org/articles/25-024/pdf)
- Classical and correspondence samples were too small in one community Lichess analysis, so conclusions there cover fast time controls only. — [Lichess forum (time controls)](https://lichess.org/forum/general-chess-discussion/ratingpercentile-distribution-of-different-time-controls)

### Inferences
- The product can generate better evidence than currently exists. Logging which features a user engages with (own-mistake drills, blunder-check prompts) against rating change, controlling for starting rating and games played, would be novel.
- Expect any real effect at the 200-1500 level to be modest per feature. Regression to the mean and new-account rating inflation will dominate naive "before/after" comparisons.

### Gaps
- No official chess.com or Lichess research publication on puzzle use, game review use, or study habits vs rating gain was found in this session. One may exist, but searches did not surface it.
- Full methods for the community analyses could not be checked (403 errors).
