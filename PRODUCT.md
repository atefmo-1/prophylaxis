# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript static site, hosted standalone (e.g. Vercel or GitHub Pages) and linked from the owner's portfolio website. Data comes from a Python pipeline (`coach export`) as static JSON under `web/public/data/`; in development the same JSON is served live by FastAPI (`coach serve`).

## Users

1. **A chess.com player learning the game.** Rated a few hundred, plays sessions of 10-minute rapid games, then opens the coach to understand what just happened and what to fix. The first question after a session is "how did my last game go?"
2. **Visitors to the owner's website.** Recruiters and curious visitors who see the project as a portfolio piece. They need to understand within seconds what the tool does with real games, and see the engineering behind it.

## Product Purpose

A personal chess coach that does what chess.com charges for (Game Review, move classifications, advanced stats) and goes further: it analyzes every game together to find recurring weaknesses and backs every claim with the player's own positions. Success means the player knows exactly which habit costs them games, and visitors leave understanding that this is real analysis of real games, not a mock-up.

## Positioning

It is built around one specific player's real games. Every insight links to a real position from a real game, every rate shows its uncertainty (n is small), and the grading is validated against chess.com's own accuracy numbers. Generic chess sites review one game at a time; this one looks across all games.

## Operating Context

- After a playing session on chess.com: run `coach sync && coach analyze && coach export`, then open the site.
- Data: chess.com public API (games, clocks per move), Stockfish 19 evaluations, tactic detectors (hung pieces, forks, missed mates, time pressure, rushed moves).
- Mostly viewed on a laptop; visitors may arrive on a phone from a portfolio link.

## Capabilities and Constraints

- Analyzes finished games only. It must never offer help during a live game (chess.com Fair Play policy).
- Move classes follow chess.com's scale: great, best, excellent, good, inaccuracy, mistake, blunder.
- Small samples (a player may have only a few dozen games): stats are shown with 90% intervals, never as falsely exact numbers.
- Not yet built: LLM move explanations, coach chat agent, drills, ML tactic classifier, Chrome extension (see PLAN.md).

## Brand Commitments

None yet. No existing name, logo or visual identity.

## Evidence on Hand

- Real data: any player's public chess.com games, with per-move clocks, engine evaluations and tags. A player's analysis stays on their own machine (`data/chess.db` locally, the browser's storage on the site).
- Validation: where chess.com computed an accuracy, ours is compared against it.
- No testimonials, users, or press. Do not invent any.

## Product Principles

1. Every claim points at a real position from a real game.
2. Show uncertainty honestly; small samples get intervals, not exact-looking percentages.
3. The engine supplies facts; the interface explains them in plain language for a beginner.
4. The latest game comes first; patterns across games are one step away.
5. Fair play: post-game analysis only.

## Accessibility & Inclusion

Move classes must not rely on color alone (use symbols and labels too). Keyboard navigation through moves (arrow keys). Readable on a phone.
