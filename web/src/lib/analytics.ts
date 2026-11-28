// Anonymous counts of how the site is used, sent to GoatCounter (goatcounter.com: open source, no cookies, no
// personal data). Nothing about a player is ever sent: no username, no game, no move, no rating. Only which page was
// opened ("/habits"), a handful of actions ("first-review-done"), and the answer to "Was this explanation right?"
// with the kind of explanation it was ("vote/no/allowed_fork"). Sent as a plain request from this file, so no
// third-party script runs on the site. Off when SITE is empty, on localhost, inside another page (the portfolio's
// live demo promises nothing leaves the browser), with Do Not Track or Global Privacy Control, or after "Stop
// counting my visits" in the player menu.

/** The GoatCounter site code (https://<SITE>.goatcounter.com). Empty: nothing is counted. */
const SITE = "atefmo";
const OFF_KEY = "coach.analytics.off";

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return true;
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

const local = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || location.hostname.endsWith(".localhost");

function embedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent hides itself, which also means embedded
  }
}

/** Whether anything is counted in this browser. */
export const counting = () => !!SITE && !local() && !embedded() && !optedOut();

/** Whether the visitor can turn counting off (or back on) here: it's set up and the browser isn't already saying no. */
export const canChooseCounting = () => !!SITE && !local() && !embedded();

export function setCounting(on: boolean) {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch {
    // Storage unavailable: the browser's own Do Not Track setting is the way to say no.
  }
}

function send(path: string, event: boolean) {
  if (!counting()) return;
  const params = new URLSearchParams({ p: path, t: path, e: String(event), s: `${screen.width},${screen.height}`, rnd: String(Math.random()) });
  // Only where a visitor came from (a site's address, never a page on it), and only on the first page.
  if (!event && document.referrer && !sent) {
    try {
      const from = new URL(document.referrer);
      if (from.host !== location.host) params.set("r", from.origin);
    } catch {
      // An unreadable referrer is simply left out.
    }
  }
  sent = true;
  new Image().src = `https://${SITE}.goatcounter.com/count?${params}`;
}
let sent = false;

/** A page was opened: "/habits", "/sample/review". Never an id or a name. */
export const countPage = (page: string) => send(page, false);

/** Something happened: "first-review-done", "vote/yes/hanging_piece". */
export const countEvent = (name: string) => send(name, true);
