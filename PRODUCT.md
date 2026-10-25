# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript static site on GitHub Pages, linked from the owner's portfolio website, plus a Chrome extension built from the same code. Games come from chess.com's public API and are reviewed in the visitor's browser: Stockfish 19 Lite as WebAssembly, a small ONNX tactic model, reviews kept in IndexedDB. The Python pipeline (`coach`) is the reference implementation the browser analysis is tested against.

## Users

1. **A chess.com player learning the game.** Rated a few hundred, plays sessions of 10-minute rapid games, then opens the coach to understand what just happened and what to fix. The first question after a session is "how did my last game go?"
2. **Visitors to the owner's website.** Recruiters and curious visitors who see the project as a portfolio piece. They need to understand within seconds what the tool does with real games, and see the engineering behind it.

## Product Purpose

A personal chess coach that does what chess.com charges for (Game Review, move classifications, advanced stats) and goes further: it analyzes every game together to find recurring weaknesses and backs every claim with the player's own positions. Success means the player knows exactly which habit costs them games, and visitors leave understanding that this is real analysis of real games, not a mock-up.

## Positioning

It works for any chess.com player, on their own real games. Habits and mistakes point at real positions from real games, rates show their uncertainty (n is small), and the grading is validated against chess.com's own accuracy numbers. Generic chess sites review one game at a time; this one looks across all games.

## Operating Context

- After a playing session on chess.com: open the site, which fetches and reviews the new games in the browser; or let the Chrome extension's side panel open by itself when a game ends.
- Data: chess.com public API (games, clocks per move), Stockfish 19 evaluations, tactic detectors (hung pieces, forks, missed mates, time pressure, rushed moves).
- Mostly viewed on a laptop; visitors may arrive on a phone from a portfolio link.

## Capabilities and Constraints

- Analyzes finished games only. It must never offer help during a live game (chess.com Fair Play policy).
- Move classes follow chess.com's scale: brilliant, great, best, excellent, good, book, inaccuracy, mistake, miss, blunder.
- Small samples (a player may have only a few dozen games): rates are shown with 90% intervals rather than as falsely exact numbers, and comparisons call a difference only when it is clear.
- Built: review with retry puzzles, habits, practice from your own mistakes, Lichess puzzles per habit, the opening tree, Compare with tips against another player, the ML tactic classifier and the Chrome extension. Not built: LLM explanations or a chat coach; every sentence comes from the engine or a tested rule (see PLAN.md).

## Brand Commitments

The name is Prophylaxis ("seeing a problem coming and stopping it before it happens"). The visual identity is in DESIGN.md: quiet dark chrome, a classic brown board and chess.com's grade colours. No logo beyond the favicon.

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
