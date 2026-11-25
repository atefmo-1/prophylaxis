---
name: Prophylaxis
description: A chess-native game review and habit coach. Navy ink on white (dark navy in dark mode); the board and the move grades carry the colour.
colors:
  page: "#121821"
  panel: "#1a212c"
  panel-raised: "#242c39"
  line: "#2a3240"
  ink: "#f2ede3"
  ink-soft: "#c4c0b7"
  ink-muted: "#9d9b96"
  accent: "#f2ede3"
  accent-hover: "#ffffff"
  accent-ink: "#f2ede3"
  current-move: "rgb(242 237 227 / 0.13)"
  square-light: "#f0d9b5"
  square-dark: "#b58863"
  grade-brilliant: "#1baca6"
  grade-great: "#5b8baf"
  grade-best: "#81b64c"
  grade-excellent: "#96bc4b"
  grade-good: "#95a88a"
  grade-book: "#a88865"
  grade-inaccuracy: "#f0b93a"
  grade-mistake: "#e5872b"
  grade-miss: "#e8613a"
  grade-blunder: "#ca3431"
  eval-white: "#f2f1ed"
  eval-black: "#403d39"
typography:
  page-title:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Hanken Grotesk Variable, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
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
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  square: "4px"
  control: "12px"
  panel: "18px"
  card: "16px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  section: "44px"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-hover:
    backgroundColor: "#29313f"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#121821"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-icon:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "40px"
  nav-link:
    textColor: "{colors.ink-soft}"
    rounded: "10px"
    padding: "7px 13px"
  nav-link-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
  segmented:
    backgroundColor: "{colors.panel-raised}"
    rounded: "{rounded.control}"
    padding: "3px"
  segmented-option-active:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "9px"
    padding: "6px 13px"
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

A chess-native review room. Everything a player already knows from chess.com and lichess stays where they expect it: the board first and as large as the viewport allows, an eval bar on its edge, player strips above and below, a two-column scoresheet, an advantage graph, and chess.com's move-grade names and colour ramp. The chrome around that is deliberately quiet: white surfaces with cool grey hairlines and navy ink in three strengths (in dark mode, three navy-blacks with warm off-white ink). The primary action is filled with the ink colour itself, so there is no separate brand hue.

Colour has a job here. The board is the only large warm surface, and the grade ramp (brilliant teal and great blue through blunder red, with a brown for book moves) is the only chromatic vocabulary; the chrome never competes with either. Density is that of a tool, not a page: 15px body, tight rows, numbers in tabular figures, sections separated by hairlines and tonal steps rather than ornament. There is no decorative layer, no invented layout, no costume styling.

**Key Characteristics:**
- Flat chrome: white page and panels in light, three navy-black steps in dark, separated by hairlines.
- The ink colour fills the one primary action; it also marks the current move and focus.
- A classic brown board, sized to the viewport height.
- Colour reserved for move grades, drawn as SVG badges with a mark, never colour alone.
- One sans (Hanken Grotesk) for everything, with tabular numbers.

## Colors

Navy ink on white in light; navy-black surfaces with warm off-white ink in dark. The action colour is the ink itself, so the only hues are the brown board and chess.com's grade ramp.

### Primary
- **Action Ink** (accent): primary buttons ("Review the key moment", "Next position", "Finish"), the "Review your own games" button on the sample player, the skip link, text selection. Navy `#1d2a3f` with white text in light; off-white with navy text in dark (`--c-on-accent`). Lifts to **Action Ink Hover** on hover.
- **Action Ink as a line** (accent-ink): the same colour where it is a line or text: focus rings, the graph cursor, coach progress dots, inline links.
- **Current Move Wash** (current-move): the translucent ink wash behind the scoresheet cell of the move being shown.

### Secondary
- **Classic Board** (square-light, square-dark): the cream and mid-brown board squares. The dark square also backs the board frame and colours the coordinates on light squares; the light square colours them on dark squares.

### Tertiary: the grade ramp
- **Brilliant** (grade-brilliant), **Great** (grade-great), **Best** (grade-best), **Excellent** (grade-excellent), **Good** (grade-good), **Book** (grade-book), **Inaccuracy** (grade-inaccuracy), **Mistake** (grade-mistake), **Miss** (grade-miss), **Blunder** (grade-blunder): chess.com's names and hues. Used as badge fills, the graph's dots on a game's key moments, and (as lighter tints for contrast on dark) the grade name in the coach card. Win/positive states borrow the Best green; loss/negative states borrow the Blunder red family.

### Neutral
- **Page** (page): the app background and top bar.
- **Panel** (panel): the review panel, page cards, habit list, segmented control track.
- **Raised** (panel-raised): the track of tabs and segmented controls, the turning-point row in the review summary, hovered scoresheet cells, feedback and fix callouts.
- **Hairline** (line): every divider, table rule, tab baseline and the 1px gaps of the skills grid.
- **Ink** (ink), **Soft Ink** (ink-soft), **Muted Ink** (ink-muted): primary text; secondary prose and inactive nav; captions, column heads, move numbers, inactive tabs.
- **Eval White / Eval Black** (eval-white, eval-black): the two halves of the eval bar; Eval White also fills the "plays white" swatch and the graph area.

### Named Rules
**The Grades Own Colour Rule.** Chromatic colour belongs to the move grades and the board. Chrome is grey and ink; any status colour (win, loss, rating up or down) is drawn from the grade ramp, never a new hue.

**The One Action Colour Rule.** The filled ink button means "go here": one per decision. The same colour marks the current move and focus; it is never decoration.

### Light and dark

Both themes share every token name; only values change. Dark is the default. Light follows `prefers-color-scheme` unless the viewer picks Auto, Light or Dark in the top bar (stored in the browser as `coach.theme` and applied before first paint by an inline script in `index.html`). Light values: page and panel `#ffffff`, the panel outlined by a 1px navy edge at 10% (`--c-panel-edge`), raised `#f2f3f6`, hairline `#e6e8ec`, ink `#1d2a3f` / `#3d4759` / `#5f6777`, accent `#1d2a3f`. Outlined controls use `--c-hair` (navy at 15% in light, white at 10% in dark). Grade text uses `--gi-*` inks: light tints on dark, darker shades on light, so every grade name clears 4.5:1 in both. White elements on the board's edge (eval bar, white piece chips) carry a hairline so they never vanish on the light page. Charts colour their marks through classes on these tokens, never through SVG attributes, so they switch with the theme.

## Typography

**Display Font:** Hanken Grotesk Variable (with system-ui, sans-serif)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** none; numbers use the same face with tabular figures

**Character:** One plain, slightly warm grotesque does every job; hierarchy comes from size, weight (400, 500, 600; nothing heavier) and tight negative tracking on headings, not from a second family.

### Hierarchy
- **Page title** (600, 34px, 1.1, -0.04em): the H1 of Habits, Games, Openings and Compare (Review and Practice have a visually hidden H1).
- **Headline** (600, 26px, 1.15, -0.035em): the review report-card title; the #1 habit heading is 600 at 22px.
- **Title** (600, 18-19px, 1.3, -0.01em): the coach card heading and page section headings.
- **Body** (400, 15px, 1.5): prose, capped at 60-72ch on pages.
- **Label** (500-600, 13-15px): tabs and buttons (500, 15px), table heads, captions and meta in Muted Ink. Sentence case, no tracking.
- **Figure** (600, 20-28px): the summary accuracy row (20px) and skill values (28px). Accuracy is shown once, in the summary, not in the player strips.

### Named Rules
**The One Sans Rule.** Hanken Grotesk everywhere, including board coordinates (600, 11px). No second family, no uppercase tracked labels.

**The Tabular Numbers Rule.** Every rating, accuracy, move number, percentage and count is set with tabular figures so columns and strips don't jitter as values change.

## Layout

The review screen is a fixed three-column grid: a 16px eval bar, the board, and a 340-400px panel, centred, with 40px player strips above and below the board. The board size is computed from the viewport: the smaller of (viewport height minus top bar, padding and both strips) and (viewport width minus 520px), clamped between 300px and 860px. The panel matches the full board-plus-strips height; its tabs and coach card sit at the top, the scoresheet scrolls in the middle, and the graph and step controls are pinned in a footer.

Below 900px the review stacks: player strip, a horizontal 8px eval bar, a full-width board, the other strip, then the panel at natural height with the scoresheet scrolling sideways.

Habits, Games, Openings and Compare are a centred 1080px column; Practice and Puzzles use the review's board-and-panel grid (32px top, 24px sides, 72px bottom; 16px sides under 560px). Sections are spaced 44px apart; a heading sits over a one-line muted lede and its content. Grids collapse 3 → 2 → 1 columns at 860px and 560px.

The top bar is 60px, sticky, on the page colour with a hairline beneath. Spacing works in a 6/8/16/24 rhythm with 10-14px used inside dense rows.

### Named Rules
**The Board Sets the Height Rule.** On the review screen the board is as large as the viewport height allows, and the panel takes the board's height, not the other way round.

## Elevation & Depth

Flat. Depth is surface steps (page, panel, raised) plus hairlines; in light the page and panels are both white, so panels are outlined. Panels and cards carry no shadow; only the selected pill of a segmented control has a faint 1px one.

### Shadow Vocabulary
- **Board lift** (`box-shadow: 0 10px 30px -14px rgb(0 0 0 / 0.7)`): under the review board only.
- **Badge lift** (`filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))`): the grade badge on the board square, to separate it from the pieces.
- **Focus ring** (`outline: 2px solid` Action Ink, `2px` offset): every focusable element.

### Named Rules
**The Only Lifted Thing Rule.** On the page, the board is the one object that casts a shadow; everything else sits flat and separates by tone. Things that float above the page (the player menu, the "Type your move" field) lift with a soft shadow too.

## Shapes

Soft, generous radii: 4px for the board, scoresheet cells and badges in strips; 6px for callouts; 9-10px for segment options and nav links; 12px for buttons and segmented tracks; 14px for the summary's turning-point row; 16px for page cards and lists; 18px for the review panel. Grade badges are circles with a faint dark rim. Swatches for piece colour are small circles, so they never read as checkboxes. The coach progress dots are 18 x 4px bars. Lists are grouped inside one rounded container with hairline row dividers rather than separate cards.

## Components

### Buttons
Flat and outlined.
- **Shape:** 12px corners, 40px tall, 16px side padding, 500 weight at 15px.
- **Default:** Panel fill with a 1px inset hairline (`--c-hair`), Ink text; hover steps to the hover tone; press nudges down 1px.
- **Primary:** Action Ink fill, no outline, `--c-on-accent` text; one per decision.
- **Quiet:** no fill, Muted Ink; gains the Raised fill on hover.
- **Icon:** 44px square-ish step controls (first, previous, next, last) using the drawn 20px-grid icons.
- **Disabled:** 35% opacity.

### Tabs
- Review panel tabs (Summary, Key moments, Moves): a segmented control. A Raised 12px track with 3px padding; the selected tab is a Panel-filled 9px pill with a hairline and a faint shadow, in Ink; the others are Soft Ink.

### Segmented control
- Games filters: the same control as the review tabs: a Raised 12px track, the selected option a Panel pill with a hairline.

### Navigation
- Brand: the mark (a white pawn on a 26px Action Ink tile with 8px corners, also the favicon) and the word "Prophylaxis" at 600, 19px, -0.035em. Under 800px only the mark shows.
- Top bar links: Soft Ink, 500 weight, 10px-rounded; hover takes the Raised fill; the current page is a Panel pill with a hairline, in Ink. On the sample player a small Action Ink "Review your own games" button sits before the player menu (hidden under 640px, where the menu's "Leave the sample" does the job). Below 1100px the theme switch moves into the player menu; under 640px the player name is cut to fit and the rating hides, and the sections scroll sideways inside the bar.

### Cards / Containers
- **Review panel:** Panel fill, 18px corners, a 1px edge, internal hairlines between coach card, scoresheet and footer.
- **Review summary:** the result as a headline, one muted line of moves, time control and date, then the turning point: a Raised row with the move's grade badge, "The game turned on 16… d5" and your winning chances before and after, which opens that key moment. Then the accuracy and grade table, then the two actions.
- **Page cards and lists:** Panel fill, 16px corners, 18-20px padding; the skills grid uses 1px Hairline gaps as dividers.
- **Callouts:** feedback and "the fix" sit on the Raised fill at 6px; feedback tints to a translucent grade red or green for wrong and right.

### Grade badge (signature)
The SVG circle in the grade's colour with a white mark: star (best), thumbs-up (excellent), check (good), a book (book), cross (miss), and chess annotation symbols for brilliant (!!), great (!), inaccuracy (?!), mistake (?) and blunder (??). 18px in lists and the scoresheet, 26px on the board at the top-right corner of the destination square. The grade is always named in text nearby.

### Scoresheet
Two-column move list with a 44px move-number gutter; even rows carry a 2.5% white wash. The player's own moves are Ink at 600; the opponent's are Soft Ink. The current move takes the Current Move Wash. Under 900px it becomes a single horizontal scrolling row.

### Eval bar and graph
The eval bar is Eval White over Eval Black, eased (320ms) to the current evaluation, with a thin orange midline; it is vertical beside the board and horizontal on narrow screens. The 88px advantage graph uses the same white at 12% for its area, a light line, grade-coloured dots on the game's key moments, phase dividers and an Action Ink cursor. It carries no text labels; hovering shows the winning chances at that move.

### Board arrows
Best line in green (#629924), the played move in blue (#3b78c7), threats in red (#d43b32), all at 80-85% opacity. Last move squares use the lichess-style olive highlight.

## Do's and Don'ts

### Do:
- **Do** keep chrome on the surface steps (page, panel, raised) and separate regions with hairlines.
- **Do** pair every grade colour with its badge mark and its name (PRODUCT.md: move classes must not rely on colour alone).
- **Do** use Action Ink for exactly one primary action per decision, and for the current move and focus.
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
