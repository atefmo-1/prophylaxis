---
name: Prophylaxis
description: A chess-native game review and habit coach. Quiet dark chrome; the board and the move grades carry the design.
colors:
  page: "#161718"
  panel: "#1f2022"
  panel-raised: "#28292c"
  line: "#34363a"
  ink: "#ecebe8"
  ink-soft: "#b9b8b3"
  ink-muted: "#969590"
  accent: "#366fb5"
  accent-hover: "#3d78c1"
  accent-ink: "#8dbbf0"
  current-move: "rgb(61 124 201 / 0.32)"
  square-light: "#f0d9b5"
  square-dark: "#b58863"
  grade-great: "#5b8baf"
  grade-best: "#81b64c"
  grade-excellent: "#96bc4b"
  grade-good: "#95a88a"
  grade-inaccuracy: "#f0b93a"
  grade-mistake: "#e5872b"
  grade-miss: "#e8613a"
  grade-blunder: "#ca3431"
  eval-white: "#f2f1ed"
  eval-black: "#403d39"
typography:
  page-title:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  figure:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  square: "4px"
  control: "6px"
  panel: "8px"
  card: "10px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  section: "44px"
components:
  button:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-hover:
    backgroundColor: "#33353a"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-icon:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "36px"
  nav-link:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
  segmented:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "3px"
  segmented-option-active:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  scoresheet-cell:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.square}"
    padding: "0 8px"
    height: "30px"
  scoresheet-cell-current:
    backgroundColor: "{colors.current-move}"
    textColor: "#ffffff"
  review-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  page-card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    padding: "20px"
  grade-badge:
    size: "18px"
---

# Design System: Prophylaxis

## Overview

**Creative North Star: "The Board Carries It"**

A chess-native review room. Everything a player already knows from chess.com and lichess stays where they expect it: the board first and as large as the viewport allows, an eval bar on its edge, player strips above and below, a two-column scoresheet, an advantage graph, and chess.com's move-grade names and colour ramp. The chrome around that is deliberately quiet: three near-black greys, warm off-white ink in three strengths, one blue.

Colour has a job here. The board is the only large warm surface, and the grade ramp (great blue through blunder red) is the only chromatic vocabulary; the chrome never competes with either. Density is that of a tool, not a page: 15px body, tight rows, numbers in tabular figures, sections separated by hairlines and tonal steps rather than ornament. There is no decorative layer, no invented layout, no costume styling.

**Key Characteristics:**
- Dark, flat, tonal chrome in three steps (page, panel, raised).
- One blue accent for the primary action, the current move and focus.
- A classic brown board, sized to the viewport height.
- Colour reserved for move grades, drawn as SVG badges with a mark, never colour alone.
- One sans (Hanken Grotesk) for everything, with tabular numbers.

## Colors

A near-neutral dark scale with a faint cool cast, warm off-white ink, one mid blue, a brown board, and chess.com's grade ramp as the only other colour.

### Primary
- **Move Blue** (accent): primary buttons ("Play it", "Next"), the skip link, text selection. Lifts to **Move Blue Hover** on hover.
- **Pale Move Blue** (accent-ink): the light form of the accent where it sits on dark as a line or text: focus rings, the active-tab underline, the graph cursor, coach progress dots, inline links.
- **Current Move Wash** (current-move): the translucent blue behind the scoresheet cell of the move being shown.

### Secondary
- **Classic Board** (square-light, square-dark): the cream and mid-brown board squares. The dark square also backs the board frame and colours the coordinates on light squares; the light square colours them on dark squares.

### Tertiary: the grade ramp
- **Great** (grade-great), **Best** (grade-best), **Excellent** (grade-excellent), **Good** (grade-good), **Inaccuracy** (grade-inaccuracy), **Mistake** (grade-mistake), **Miss** (grade-miss), **Blunder** (grade-blunder): chess.com's names and hues. Used as badge fills, graph dots for inaccuracy and worse, and (as lighter tints for contrast on dark) the grade name in the coach card. Win/positive states borrow the Best green; loss/negative states borrow the Blunder red family.

### Neutral
- **Page** (page): the app background and top bar.
- **Panel** (panel): the review panel, page cards, habit list, segmented control track.
- **Raised** (panel-raised): buttons, active nav and segment, hovered scoresheet cells, feedback and fix callouts, phase tiles.
- **Hairline** (line): every divider, table rule, tab baseline and the 1px gaps of the skills grid.
- **Ink** (ink), **Soft Ink** (ink-soft), **Muted Ink** (ink-muted): primary text; secondary prose and inactive nav; captions, column heads, move numbers, inactive tabs.
- **Eval White / Eval Black** (eval-white, eval-black): the two halves of the eval bar; Eval White also fills the "plays white" swatch and the graph area.

### Named Rules
**The Grades Own Colour Rule.** Chromatic colour belongs to the move grades and the board. Chrome is grey and ink; any status colour (win, loss, rating up or down) is drawn from the grade ramp, never a new hue.

**The One Blue Rule.** Blue means "you are here or go here": the primary action, the current move, focus and the active tab. It is never decoration and never a second button style.

### Light and dark

Both themes share every token name; only values change. Dark is the default. Light follows `prefers-color-scheme` unless the viewer picks Auto, Light or Dark in the top bar (stored in the browser as `coach.theme` and applied before first paint by an inline script in `index.html`). Light values: page `#f3f3f1`, panel `#ffffff` with a 1px `#e3e3df` edge (`--c-panel-edge`, transparent in dark), raised `#ececea`, ink `#18191b` / `#45474b` / `#66686c`, accent `#2f6db5`. Grade text uses `--gi-*` inks: light tints on dark, darker shades on light, so every grade name clears 4.5:1 in both. White elements on the board's edge (eval bar, white piece chips) carry a hairline so they never vanish on the light page. Charts colour their marks through classes on these tokens, never through SVG attributes, so they switch with the theme.

## Typography

**Display Font:** Hanken Grotesk Variable (with system-ui, sans-serif)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** none; numbers use the same face with tabular figures

**Character:** One plain, slightly warm grotesque does every job; hierarchy comes from weight (500, 550, 600, 650, 700) and small negative tracking on headings, not from a second family.

### Hierarchy
- **Page title** (700, 28px, 1.15, -0.02em): the H1 of Habits, Practice and Games.
- **Headline** (700, 22px, 1.2-1.25, -0.015em): the review report-card title and the #1 habit heading.
- **Title** (700, 18-19px, 1.3, -0.01em): the coach card heading and page section headings.
- **Body** (400, 15px, 1.5): prose, capped at 60-72ch on pages.
- **Label** (600, 13-14px): tabs, buttons (14px), table heads, captions and meta in Muted Ink. Sentence case, no tracking.
- **Figure** (700, 16-28px): accuracy in the strips (16px), the summary accuracy row (20px) and skill values (28px).

### Named Rules
**The One Sans Rule.** Hanken Grotesk everywhere, including board coordinates (700, 11px) and graph labels. No second family, no uppercase tracked labels.

**The Tabular Numbers Rule.** Every rating, accuracy, move number, percentage and count is set with tabular figures so columns and strips don't jitter as values change.

## Layout

The review screen is a fixed three-column grid: a 16px eval bar, the board, and a 340-400px panel, centred, with 40px player strips above and below the board. The board size is computed from the viewport: the smaller of (viewport height minus top bar, padding and both strips) and (viewport width minus 520px), clamped between 300px and 860px. The panel matches the full board-plus-strips height; its tabs and coach card sit at the top, the scoresheet scrolls in the middle, and the graph and step controls are pinned in a footer.

Below 900px the review stacks: player strip, a horizontal 8px eval bar, a full-width board, the other strip, then the panel at natural height with the scoresheet scrolling sideways.

Habits, Practice and Games are a centred 1080px column (32px top, 24px sides, 72px bottom; 16px sides under 560px). Sections are spaced 44px apart; a heading sits over a one-line muted lede and its content. Grids collapse 3 → 2 → 1 columns at 860px and 560px.

The top bar is 52px, sticky, on the page colour with a hairline beneath. Spacing works in a 6/8/16/24 rhythm with 10-14px used inside dense rows.

### Named Rules
**The Board Sets the Height Rule.** On the review screen the board is as large as the viewport height allows, and the panel takes the board's height, not the other way round.

## Elevation & Depth

Flat and tonal. Depth is three surface steps (page, panel, raised) plus hairlines; panels and cards carry no shadow.

### Shadow Vocabulary
- **Board lift** (`box-shadow: 0 10px 30px -14px rgb(0 0 0 / 0.7)`): under the review board only.
- **Badge lift** (`filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))`): the grade badge on the board square, to separate it from the pieces.
- **Focus ring** (`outline: 2px solid` Pale Move Blue, `2px` offset): every focusable element.

### Named Rules
**The Only Lifted Thing Rule.** The board is the one object that casts a shadow. Everything else sits flat and separates by tone.

## Shapes

Small, practical radii in four steps: 4px for the board, scoresheet cells and badges in strips; 6px for buttons, nav links, segments and callouts; 8px for the review panel and segmented track; 10px for page cards and lists. Grade badges are circles with a faint dark rim. Swatches for piece colour are small circles, so they never read as checkboxes. The coach progress dots are 18 x 4px bars. Lists are grouped inside one rounded container with hairline row dividers rather than separate cards.

## Components

### Buttons
Quiet, solid, small.
- **Shape:** gently rounded (6px), 36px tall everywhere, 14px side padding, 600 weight.
- **Default:** Raised fill, Ink text; hover steps one shade lighter; press nudges down 1px.
- **Primary:** Move Blue fill with white text; one per decision.
- **Quiet:** no fill, Muted Ink; gains the Raised fill on hover.
- **Icon:** 44px square-ish step controls (first, previous, next, last) using the drawn 20px-grid icons.
- **Disabled:** 35% opacity.

### Tabs
- Review panel and Practice tabs: no fill, Muted Ink labels, a 2px inset underline in Pale Move Blue on the selected tab, over a hairline baseline.

### Segmented control
- Games filters: a Panel-coloured 8px track with 3px padding; the selected option takes the Raised fill and Ink.

### Navigation
- Top bar links: Soft Ink, 550 weight, 6px-rounded; hover and current page take the Raised fill and Ink. Brand hides under 640px, the player name under 400px.

### Cards / Containers
- **Review panel:** Panel fill, 8px corners, no border, internal hairlines between head, coach card, scoresheet and footer.
- **Page cards and lists:** Panel fill, 10px corners, 18-20px padding; the skills grid uses 1px Hairline gaps as dividers.
- **Callouts:** feedback and "the fix" sit on the Raised fill at 6px; feedback tints to a translucent grade red or green for wrong and right.

### Grade badge (signature)
The SVG circle in the grade's colour with a white mark: star (best), thumbs-up (excellent), check (good), cross (miss), and chess annotation symbols for great (!), inaccuracy (?!), mistake (?) and blunder (??). 18px in lists and the scoresheet, 26px on the board at the top-right corner of the destination square. The grade is always named in text nearby.

### Scoresheet
Two-column move list with a 44px move-number gutter; even rows carry a 2.5% white wash. The player's own moves are Ink at 650; the opponent's are Soft Ink. The current move takes the Current Move Wash. Under 900px it becomes a single horizontal scrolling row.

### Eval bar and graph
The eval bar is Eval White over Eval Black, eased (320ms) to the current evaluation, with a thin orange midline; it is vertical beside the board and horizontal on narrow screens. The 88px advantage graph uses the same white at 12% for its area, a light line, grade-coloured dots on inaccuracies and worse, phase dividers, and a Pale Move Blue cursor.

### Board arrows
Best line in green (#629924), the played move in blue (#3b78c7), threats in red (#d43b32), all at 80-85% opacity. Last move squares use the lichess-style olive highlight.

## Do's and Don'ts

### Do:
- **Do** keep chrome on the three surface steps (page, panel, raised) and separate regions with hairlines.
- **Do** pair every grade colour with its badge mark and its name (PRODUCT.md: move classes must not rely on colour alone).
- **Do** use Move Blue for exactly one primary action per decision, and for the current move and focus.
- **Do** set every number with tabular figures.
- **Do** size the review board from the viewport height and let the panel match it.
- **Do** keep transitions short (150ms for state, 180ms for piece moves, 320ms for the eval bar) on the shared ease curve; motion drops to zero under reduced-motion, piece animation included.
- **Do** keep the one authored moment: the grade badge lands on its square (260ms, exponential ease-out, after the piece arrives), and a try's feedback settles in under the prompt (200ms).
- **Do** keep every board move possible from the keyboard: a "Type your move" field appears over the board when reached with Tab.

### Don't:
- **Don't** introduce a hue outside the grade ramp and the board; status colour borrows from the ramp.
- **Don't** shadow panels, cards or buttons; the board is the only lifted object.
- **Don't** add a second typeface, uppercase tracked labels or eyebrow text above headings.
- **Don't** restyle the board away from the classic cream and brown, or rename the chess.com grades.
- **Don't** invent layouts where chess players have a convention (board left, panel right, scoresheet in two columns).
