// Zip the built extension (dist-extension, from `npm run build:extension`) for the Chrome Web Store. The store copy
// leaves out the localhost match that only matters when developing, so it asks for no more than it uses.
// Usage: npm run pack:extension
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const web = path.resolve(import.meta.dirname, "..");
const built = path.join(web, "dist-extension");
const stage = path.join(web, "dist-store");
if (!fs.existsSync(path.join(built, "manifest.json"))) throw new Error("Run npm run build:extension first");

fs.rmSync(stage, { recursive: true, force: true });
fs.cpSync(built, stage, { recursive: true });

const file = path.join(stage, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
for (const script of manifest.content_scripts) script.matches = script.matches.filter((m) => !m.startsWith("http://localhost"));
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");

const zip = path.join(web, `prophylaxis-extension-${manifest.version}.zip`);
fs.rmSync(zip, { force: true });
execFileSync("zip", ["-q", "-r", "-X", zip, "."], { cwd: stage });
fs.rmSync(stage, { recursive: true, force: true });

const size = (fs.statSync(zip).size / 1024 / 1024).toFixed(1);
console.log(`${path.relative(web, zip)}: version ${manifest.version}, ${size} MB`);
console.log("Content scripts:", manifest.content_scripts.map((s) => s.matches.join(", ")).join(" | "));
