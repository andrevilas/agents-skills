// Entry point for `node --test scripts/test/`.
// Node >= 21 treats a directory argument of --test as a module path and loads this index.js;
// it imports every *.test.mjs file of this folder (sorted) so the whole suite runs.
// (Node 20 searches the directory itself; the suite then simply runs these files directly too.)
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

(async () => {
  for (const f of files) await import(pathToFileURL(path.join(__dirname, f)).href);
})();
