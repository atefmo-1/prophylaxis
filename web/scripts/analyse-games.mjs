// Review a file of chess.com games with the site's own browser analysis (Stockfish 19 Lite, buildReview, NODES as
// in review.ts) and write each side's accuracy, for research such as ml/rating (estimating a rating from one game).
//
//   node web/scripts/analyse-games.mjs <games.jsonl> <out.jsonl> [--url http://localhost:5190] [--engines 4]
//
// Needs a Vite dev server of this site running at --url. Each input line is one chess.com game object (as the
// public API returns it). Output lines carry the game's url, both sides' accuracy and the per-ply win % and move
// classes, so other features can be computed later without reading the game again. Games already in the output are
// skipped, so a stopped run resumes. Retry answers (multi-PV searches for the "try again" drill) are skipped: they run
// after the positions are read and don't change the accuracy.
import { createRequire } from "node:module";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), "../package.json"));
const puppeteer = require("puppeteer-core");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const url = opt("url", "http://localhost:5190");
const engines = Number(opt("engines", 4));
const chrome = opt("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const [input, output] = args;
if (!input || !output) {
  console.error("usage: node web/scripts/analyse-games.mjs <games.jsonl> <out.jsonl> [--url URL] [--engines N]");
  process.exit(2);
}

const games = readFileSync(input, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const done = new Set(existsSync(output) ? readFileSync(output, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).url) : []);
const todo = games.filter((g) => !done.has(g.url));
console.log(`${games.length} games, ${done.size} done, ${todo.length} to review on ${engines} engines`);

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 3_600_000 });
const page = await browser.newPage();
page.on("console", (m) => m.type() === "error" && console.log("page:", m.text()));
await page.goto(`${url}/`, { waitUntil: "networkidle0" });
await page.evaluate(async (engines) => {
  const { Engine, workerTransport } = await import("/src/analysis/engine.ts");
  const { EnginePool } = await import("/src/analysis/pool.ts");
  const { buildReview, NODES } = await import("/src/analysis/review.ts");
  const pool = new EnginePool(Array.from({ length: engines }, () => new Engine(workerTransport(new Worker("/engine/stockfish-19-lite-single.js")))));
  await Promise.all(pool.engines.map((e) => e.ready));
  // The same pool, minus the retry searches (multi-PV over every legal move), which come after accuracy is fixed.
  const analyser = {
    lanes: pool.lanes,
    newGame: (l) => pool.newGame(l),
    analyse: (fen, multipv, nodes, lane) => (multipv > 2 ? Promise.resolve([]) : pool.analyse(fen, multipv, nodes, lane)),
  };
  window.__review = async (game) => {
    const r = await buildReview(game, game.white.username, analyser, null);
    const side = (mine) => r.moves.filter((m) => m.mine === mine);
    return {
      url: game.url,
      nodes: NODES,
      engines,
      plies: r.moves.length,
      white_accuracy: r.game.accuracy,
      black_accuracy: r.game.opp_accuracy,
      start_win_white: r.start_win_white,
      win_white: r.moves.map((m) => Math.round(m.win_white * 100) / 100),
      classes: r.moves.map((m) => m.class),
      time_spent: r.moves.map((m) => m.time_spent),
      decided: r.moves.map((m) => m.decided),
      white_moves: side(true).length,
      black_moves: side(false).length,
    };
  };
}, engines);

let n = 0;
const t0 = Date.now();
for (const game of todo) {
  try {
    const row = await page.evaluate((g) => window.__review(g), game);
    appendFileSync(output, JSON.stringify(row) + "\n");
  } catch (e) {
    appendFileSync(output, JSON.stringify({ url: game.url, error: String(e).slice(0, 300) }) + "\n");
  }
  n++;
  if (n % 10 === 0 || n === todo.length) {
    const per = (Date.now() - t0) / 1000 / n;
    console.log(`${n}/${todo.length}  ${per.toFixed(1)} s/game  ~${((todo.length - n) * per / 60).toFixed(0)} min left`);
  }
}
await browser.close();
