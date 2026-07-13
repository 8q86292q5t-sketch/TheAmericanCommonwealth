const { cpSync, existsSync, mkdirSync, rmSync, statSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const dist = join(root, "dist");
const required = [
  "index.html",
  "styles.css",
  "script.js",
  "assets/commonwealth-archive-hero.png",
];

let failed = false;

for (const file of required) {
  const path = join(root, file);
  if (!existsSync(path) || statSync(path).size === 0) {
    console.error(`Missing or empty file: ${file}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

rmSync(dist, { force: true, recursive: true });
mkdirSync(join(dist, "assets"), { recursive: true });

cpSync(join(root, "index.html"), join(dist, "index.html"));
cpSync(join(root, "styles.css"), join(dist, "styles.css"));
cpSync(join(root, "script.js"), join(dist, "script.js"));
cpSync(
  join(root, "assets/commonwealth-archive-hero.png"),
  join(dist, "assets/commonwealth-archive-hero.png")
);

console.log("Built static site to dist.");
