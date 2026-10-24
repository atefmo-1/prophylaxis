---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

## Scope

Whole web app (`web/`): Review (first screen, latest game), Habits, Practice, Games. Visitor mode: Operate. Interaction and layout follow docs/UX-SPEC.md, which was researched from chess.com and Lichess conventions.

## Audience and job

The player after a rapid session ("how did my last game go, and what do I fix?"), and portfolio visitors who need to see real analysis of real games within seconds.

## Direction contract

THESIS: A chess-native coach. Familiar where players expect it (the scoresheet, chess.com's grade names and colours, an eval bar, board-first layout); different where it helps (retry before reveal, every mistake linked to the player's habits). Refuses invented layouts and costume styling: the board and the grades carry the design.

OWN-WORLD: Quiet dark surfaces (#161718 page, #1f2022 panels, #28292c raised), ink #ecebe8 / #b9b8b3 / #8f8e89, one blue accent (#3d7cc9) for primary actions, the current move and focus. Classic brown board (#f0d9b5 / #b58863). Colour is reserved for move grades: chess.com's ramp, drawn as SVG badges. One sans (Hanken Grotesk) with tabular numbers.

STORY: The visitor lands on the latest game's report card, steps through the key moments as puzzles, sees each mistake tied to a habit, then goes to Habits for the one thing to work on and to Practice for five positions from their own games.

FIRST VIEWPORT: Top bar (Review · Habits · Practice · Games, player). Board sized to the viewport height with an eval bar on its left and player strips above and below. Right panel at the same height: Summary / Key moments / Moves tabs, the coach card, the two-column scoresheet, the graph and step controls pinned at the bottom.

FORM: Chess-native review (replaced Club Ladder after user feedback; no concept seed, the layout comes from researched conventions in docs/UX-SPEC.md).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Chrome extension (post-game card + side panel) is next and should reuse this system.
