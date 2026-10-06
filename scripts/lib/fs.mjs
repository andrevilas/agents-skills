// Deterministic file helpers for agents-skills v2 (zero dependencies, Node >= 20 ESM).
// Every generated file goes through normalizeText(): LF line endings, no trailing
// whitespace at end of file, exactly one final newline.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Codepoint string comparison (never locale-dependent). */
export function compareStrings(a, b) {
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Returns a new array sorted with compareStrings (optionally by key function). */
export function sortStrings(list, key = (v) => v) {
  return [...list].sort((a, b) => compareStrings(key(a), key(b)));
}

/** Unique + sorted list of strings. */
export function uniqSorted(list) {
  return sortStrings([...new Set(list.filter((v) => v !== undefined && v !== null))]);
}

/** POSIX-style relative path. */
export function toPosix(p) {
  return p.split(path.sep).join("/");
}

/** sha256 hex digest of a string (UTF-8) or Buffer. */
export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** CRLF/CR -> LF, strip trailing blank lines, exactly one final newline. */
export function normalizeText(text) {
  let s = String(text).replace(/\r\n?/g, "\n");
  s = s.replace(/[ \t]+$/gm, "");
  s = s.replace(/\n+$/g, "");
  return s + "\n";
}

/** JSON text with 2-space indent and final LF (key order = insertion order). */
export function jsonText(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

/** Recursively sorts object keys (arrays keep their order). */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of sortStrings(Object.keys(value))) out[k] = sortKeysDeep(value[k]);
    return out;
  }
  return value;
}

export function exists(abs) {
  try {
    fs.statSync(abs);
    return true;
  } catch {
    return false;
  }
}

export function isDir(abs) {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

/** Reads a UTF-8 file; returns null when absent or unreadable. */
export function readText(abs) {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Reads and parses JSON. Returns { value, error, missing }.
 * Never throws: callers turn `error` into a model warning.
 */
export function readJson(abs) {
  const text = readText(abs);
  if (text === null) return { value: null, error: null, missing: true };
  try {
    return { value: JSON.parse(text), error: null, missing: false };
  } catch (err) {
    return { value: null, error: `invalid JSON: ${err.message}`, missing: false };
  }
}

/** Lists the entries of a directory, sorted; [] when absent. */
export function listDir(abs) {
  try {
    return sortStrings(fs.readdirSync(abs));
  } catch {
    return [];
  }
}

/**
 * Recursively lists files under absDir as sorted POSIX paths relative to absDir.
 * Skips `.git` and symlinks. `ignore(relPath, isDirectory)` may prune entries.
 */
export function walk(absDir, { ignore = null } = {}) {
  const out = [];
  const visit = (dirAbs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries.sort((a, b) => compareStrings(a.name, b.name))) {
      if (ent.name === ".git") continue;
      if (ent.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      const childAbs = path.join(dirAbs, ent.name);
      if (ent.isDirectory()) {
        if (ignore && ignore(childRel, true)) continue;
        visit(childAbs, childRel);
      } else if (ent.isFile()) {
        if (ignore && ignore(childRel, false)) continue;
        out.push(childRel);
      }
    }
  };
  visit(absDir, "");
  return sortStrings(out);
}

/**
 * Writes `content` (normalized unless opts.raw) only when it differs.
 * Returns "written" | "unchanged".
 */
export function writeFileDeterministic(abs, content, { raw = false } = {}) {
  const data = raw ? content : normalizeText(content);
  const current = readText(abs);
  if (current === data) return "unchanged";
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return "written";
}

/** Removes a file and then any now-empty parent directories up to stopAbs. */
export function removeFileAndEmptyParents(abs, stopAbs) {
  try {
    fs.unlinkSync(abs);
  } catch {
    return false;
  }
  let dir = path.dirname(abs);
  const stop = path.resolve(stopAbs);
  while (path.resolve(dir).startsWith(stop) && path.resolve(dir) !== stop) {
    try {
      if (fs.readdirSync(dir).length > 0) break;
      fs.rmdirSync(dir);
    } catch {
      break;
    }
    dir = path.dirname(dir);
  }
  return true;
}

// ─── .gitignore (minimal, deterministic, no git binary) ─────────────────────────
// Supported: blank lines, `#` comments, `!` negation, trailing `/` (directory only),
// leading `/` (anchored), `*`, `?`, `**`. Only the repository root .gitignore is read.

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more directories; `**` alone matches anything.
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$+.()|{}[]".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return re;
}

export function parseGitignore(text) {
  const rules = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    let line = rawLine.replace(/\s+$/, "");
    if (!line || line.startsWith("#")) continue;
    let negate = false;
    if (line.startsWith("!")) {
      negate = true;
      line = line.slice(1);
    }
    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    let anchored = false;
    if (line.startsWith("/")) {
      anchored = true;
      line = line.slice(1);
    } else if (line.includes("/")) {
      anchored = true;
    }
    if (!line) continue;
    const body = globToRegex(line);
    const regex = new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`);
    rules.push({ regex, negate, dirOnly });
  }
  return rules;
}

/**
 * Returns ignore(relPath, isDirectory) for the root .gitignore of `root`.
 * A path is ignored when it or any parent directory is ignored.
 */
export function loadGitignore(root) {
  const rules = parseGitignore(readText(path.join(root, ".gitignore")) || "");
  const test = (rel, isDirectory) => {
    let ignored = false;
    for (const r of rules) {
      if (r.dirOnly && !isDirectory) continue;
      if (r.regex.test(rel)) ignored = !r.negate;
    }
    return ignored;
  };
  return (relPath, isDirectory = false) => {
    const parts = relPath.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (test(parts.slice(0, i).join("/"), true)) return true;
    }
    return test(relPath, isDirectory);
  };
}
