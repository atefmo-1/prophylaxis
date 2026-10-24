// Runs on the Prophylaxis site's pages. Passes the site's requests to the extension and the answers back, so the site
// can take over reviews this extension already made and send back the player's habits. Plain script, no imports:
// content scripts can't load modules. The page only ever talks to this script, never to the extension directly.
(() => {
  const SITE = "prophylaxis-site";
  const EXTENSION = "prophylaxis-extension";
  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== SITE || !alive()) return;
    const { id, type, payload } = event.data;
    chrome.runtime
      .sendMessage({ type: `site:${type}`, ...payload })
      .then((reply) => window.postMessage({ source: EXTENSION, id, reply }, window.location.origin))
      .catch(() => window.postMessage({ source: EXTENSION, id, reply: null }, window.location.origin));
  });
})();
