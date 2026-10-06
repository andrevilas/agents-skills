// Shared helpers for the build tests: each test builds a private copy of the fixture repo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "repo");
export const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const created = [];
process.on("exit", () => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** A fresh temporary directory, removed when the test process exits. */
export function tempDir(name = "tmp") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `agents-skills-${name}-`));
  created.push(dir);
  return dir;
}

/** Copies the fixture repo into a fresh temporary directory and returns its path. */
export function fixtureCopy(name = "fx") {
  const dir = tempDir(name);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

/** Recursively lists files (POSIX, sorted) under dir. */
export function listFiles(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out.sort();
}

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
