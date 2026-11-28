# Chrome Web Store listing

Everything the Chrome Web Store's forms ask for, ready to paste. The images in this folder come from the sample
player only (`web/scripts/make-store-images.mjs`).

**Upload package:** `web/prophylaxis-extension-0.1.0.zip`, made by `npm run pack:extension` in `web/`. It is the built
extension without the `localhost` match used for development. It isn't committed; run the command to make it.

---

## Store listing tab

**Name** (from the package): Prophylaxis

**Summary** (from the package, 124 characters):
After a chess.com game ends: the move it turned on, the habit behind it, and a retry. Never looks at a game until it's over.

**Description:**

```
Prophylaxis is a free chess coach for chess.com players. When you finish a game, it reviews it beside the board, on your own computer.

AFTER EVERY GAME
• The move the game turned on, with your winning chances before and after.
• Accuracy and move grades for both players.
• Retry your key moments: find the better move yourself before seeing the answer.
• What your mistake allowed, and how many players at your rating find the better move ("about 1 in 50").

ACROSS ALL YOUR GAMES (on the Prophylaxis website)
• Your #1 habit, such as moving too fast or leaving pieces undefended, with how often it shows up.
• Practice built from positions you got wrong, brought back on a spaced-repetition schedule.
• Your opening tree, and a comparison with any other player.

PRIVATE BY DESIGN
• No account and no server. The Stockfish chess engine runs on your computer.
• Your games and reviews stay in your browser. Nothing is uploaded.
• The extension contains no analytics.

FAIR PLAY
• It never helps during a game. A game is only reviewed once chess.com has published it in your public archive of finished games.

Free and open source (GPL-3.0): https://github.com/atefmo-1/prophylaxis
Website: https://atefmo-1.github.io/prophylaxis/
```

**Category:** Education
**Language:** English

**Graphic assets**
- Store icon: the 128×128 icon inside the package (`web/extension/public/icons/128.png`)
- Screenshots (1280×800): `screenshot-1.png` to `screenshot-4.png`, in that order
- Small promo tile (440×280): `promo-small.png`

**Official URL:** leave empty (needs a verified domain)
**Homepage URL:** https://atefmo-1.github.io/prophylaxis/
**Support URL:** https://github.com/atefmo-1/prophylaxis/issues

---

## Privacy practices tab

**Single purpose:**

```
Reviews the chess.com games you finish, in Chrome's side panel next to the board, once each game is over.
```

**Permission justifications:**

| Permission | Justification to paste |
|---|---|
| `storage` | Saves your chess.com username, two settings (whether the panel opens by itself, and the Prophylaxis website address), and your last 15 game reviews, on your computer. |
| `sidePanel` | Shows the review of the game you just finished in Chrome's side panel, next to the board. |
| `offscreen` | Runs the Stockfish chess engine in Web Workers to analyse a finished game. A service worker can't start Web Workers, so the analysis runs in an offscreen document. |
| Host permission `https://api.chess.com/*` | Downloads the game you just finished from chess.com's public game archive, which only lists finished games. |
| Content script on `https://www.chess.com/*` | Notices when you are on the page of a game that has ended (from the page address and chess.com's game-over card), and shows a small card with the review's result. It never reads the board or moves from the page. chess.com changes pages without reloading, so the script has to be present on all its pages to notice a game page. |
| Content script on `https://atefmo-1.github.io/prophylaxis/*` | Lets the Prophylaxis website, when you open it, pick up the reviews this extension made and send back your habits. This stays inside your browser. |

**Remote code:** No, I am not using remote code. (The engine and models are inside the package.)

**Data usage:** tick nothing under "What user data do you plan to collect". The extension sends no user data off
the device: it only downloads a public game from chess.com, and keeps everything in Chrome's storage on your
computer. (The website's anonymous visit counts are not part of the extension.)

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://atefmo-1.github.io/prophylaxis/privacy.html

---

## Distribution tab

- **Payments:** Free
- **Visibility:** Public
- **Regions:** All regions

## Account (once, before the first upload)

- Register as a Chrome Web Store developer at https://chrome.google.com/webstore/devconsole (one-time $5 fee).
- When asked whether you are a trader (EU Digital Services Act): a free, non-commercial project is usually
  "non-trader". Choose what is true for you.
- Google may ask you to verify your contact email before you can publish.

Review usually takes a few days. Google emails the result.
