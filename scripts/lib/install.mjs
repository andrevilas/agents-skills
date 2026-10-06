// agents-skills v2 — install, update, verify, doctor, prune (§5.8). Zero dependencies, Node >= 20 ESM.
//
// Install copies committed `dist/` bundles (never builds) into an agent's skill root:
// - atomic per skill: `<dest>/.tmp-<id>-<pid>` → rename; the old copy is moved to `.old-<id>-<pid>`
//   and deleted after the swap;
// - `<dest>/.agents-skills-manifest.json` records {sourceCommit, agent, scope, selection, skills{id:{version, pack, files{path:sha256}}}};
// - only ids listed in that manifest are ever removed; `.system/`, `synced/` and third-party
//   directories are never touched;
// - `--adopt-legacy` removes legacy-shaped directories of the ids in catalog/legacy-ids.json.
// No function prints secrets or MCP configuration values; doctor prints server NAMES only.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compareStrings, isDir, jsonText, readText, sha256, sortStrings, uniqSorted, walk } from "./fs.mjs";
import { ENDPOINT, installProfiles, loadModel } from "./model.mjs";

export const MANIFEST_FILE = ".agents-skills-manifest.json";
export const NATIVE_AGENTS = ["codex", "claude-code", "antigravity"];
export const AGENTS = [...NATIVE_AGENTS, "generic"];
export const INSTALL_TARGETS_FILE = "install-targets.json";
const PROTECTED_DIRS = new Set([".system", "synced"]);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEFTOVER_RE = /^\.(tmp|old)-([a-z0-9]+(?:-[a-z0-9]+)*)-\d+$/;
const GENERIC_SHARED = ["AGENTS-snippet.md", "INDEX.md"];
const GENERATED_BY = "agents-skills scripts/skills.mjs install";
const CLI = "node scripts/skills.mjs";

/** A refusal or failure with exactly one next action. `exitCode` 2 = usage, 1 = refusal. */
export class InstallError extends Error {
  constructor(message, next = null, exitCode = 1) {
    super(message);
    this.next = next;
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------------------------
// Context, paths and git helpers

function contextOf(opts = {}) {
  const env = opts.env || process.env;
  const home = env.HOME || os.homedir();
  const log = opts.log || { info: console.log, warn: console.error, error: console.error };
  return { root: opts.root, flags: opts.flags || {}, args: opts.args || [], log, env, home, cwd: opts.cwd || process.cwd() };
}

function expandHome(p, home) {
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

/** Path for display: the home directory becomes `~`. */
function show(p, ctx) {
  const rel = path.relative(ctx.home, p);
  if (rel === "") return "~";
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) return `~/${rel.split(path.sep).join("/")}`;
  return p;
}

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return { status: r.error ? -1 : r.status, stdout: (r.stdout || "").trim() };
}

function lstat(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function isRealDir(p) {
  const st = lstat(p);
  return Boolean(st && st.isDirectory() && !st.isSymbolicLink());
}

function isFile(p) {
  const st = lstat(p);
  return Boolean(st && st.isFile());
}

/** The nearest path at or above `p` that exists: { path, isDir }. */
function nearestExisting(p) {
  let cur = path.resolve(p);
  for (;;) {
    let st = null;
    try {
      st = fs.statSync(cur);
    } catch {
      st = null;
    }
    if (st) return { path: cur, isDir: st.isDirectory() };
    const parent = path.dirname(cur);
    if (parent === cur) return { path: cur, isDir: true };
    cur = parent;
  }
}

function gitTop(dir) {
  const r = git(["rev-parse", "--show-toplevel"], dir);
  return r.status === 0 && r.stdout ? path.resolve(r.stdout) : null;
}

/** True when the origin URL names the lpm repository (`…/lpm.git`, `…:owner/lpm`). */
export function isLpmOrigin(url) {
  return /(^|[/:])lpm(\.git)?\/?$/i.test(String(url || "").trim());
}

function hasLpmMarkers(dir) {
  return isFile(path.join(dir, "scripts", "check-mcp-parity.ts")) && isFile(path.join(dir, "src", "lib", "mcpToolCatalog.ts"));
}

/** Returns the lpm checkout root that contains `dir`, or null. */
function lpmCheckoutOf(dir) {
  const top = gitTop(dir);
  if (top) {
    const origin = git(["config", "--get", "remote.origin.url"], top);
    if (origin.status === 0 && isLpmOrigin(origin.stdout)) return top;
  }
  let cur = path.resolve(dir);
  for (;;) {
    if (hasLpmMarkers(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function projectRoot(ctx) {
  const start = path.resolve(ctx.cwd, expandHome(String(ctx.flags.project || "."), ctx.home));
  const existing = nearestExisting(start);
  return (existing.isDir && gitTop(existing.path)) || start;
}

/** Default install root (§5.3) for an agent and scope, with env overrides. */
export function defaultRoot(agent, scope, ctx) {
  const env = ctx.env;
  const fromEnv = (name) => (env[name] ? path.resolve(ctx.cwd, expandHome(env[name], ctx.home)) : null);
  if (agent === "generic") return null;
  if (scope === "project") {
    const repo = projectRoot(ctx);
    return agent === "claude-code" ? path.join(repo, ".claude", "skills") : path.join(repo, ".agents", "skills");
  }
  if (agent === "codex") {
    const codexHome = fromEnv("CODEX_HOME") || path.join(ctx.home, ".codex");
    return fromEnv("CODEX_SKILLS_DIR") || path.join(codexHome, "skills");
  }
  if (agent === "claude-code") return fromEnv("CLAUDE_SKILLS_DIR") || path.join(ctx.home, ".claude", "skills");
  if (agent === "antigravity") return fromEnv("ANTIGRAVITY_SKILLS_DIR") || path.join(ctx.home, ".gemini", "config", "skills");
  return null;
}

function resolveDest(agent, scope, ctx) {
  if (ctx.flags.dest && ctx.flags.dest !== true) return path.resolve(ctx.cwd, expandHome(String(ctx.flags.dest), ctx.home));
  if (agent === "generic") throw new InstallError("the generic target needs --dest DIR", `re-run with --dest <dir>`, 2);
  return defaultRoot(agent, scope, ctx);
}

/**
 * Destination safety (§5.8 items 3 and 6). Throws InstallError on the first refusal.
 * - never inside `.system/` or `synced/`;
 * - never below a path that exists as a file (`lpm/.codex` is a 0-byte read-only file);
 * - never inside an lpm checkout (origin = lpm, or lpm marker files): its deploy uploads the working dir;
 * - inside any git work tree, only when `git check-ignore` confirms the destination is ignored,
 *   or with --allow-untracked; project scope outside git needs --allow-untracked.
 */
export function checkDestination(dest, ctx, { scope, allowUntracked, writes = true }) {
  const parts = path.resolve(dest).split(path.sep);
  const bad = parts.find((p) => PROTECTED_DIRS.has(p));
  if (bad) throw new InstallError(`refusing ${show(dest, ctx)}: \`${bad}/\` is managed by another tool and is never touched`, "choose the agent's skill root itself, not a folder inside it");
  const existing = nearestExisting(dest);
  if (!existing.isDir) {
    throw new InstallError(
      `refusing ${show(dest, ctx)}: ${show(existing.path, ctx)} is a file, not a directory (lpm/.codex is a deliberate 0-byte read-only block)`,
      "use --scope user, or another --dest",
    );
  }
  const lpm = lpmCheckoutOf(existing.path);
  if (lpm) {
    throw new InstallError(
      `refusing ${show(dest, ctx)}: it is inside the lpm checkout ${show(lpm, ctx)}, which may be deploying (gcloud run deploy --source . uploads it)`,
      "install at --scope user instead",
    );
  }
  if (!writes) return;
  const top = gitTop(existing.path);
  if (top) {
    const ignored = git(["check-ignore", "-q", path.resolve(dest)], top).status === 0;
    if (!ignored && !allowUntracked) {
      throw new InstallError(
        `refusing ${show(dest, ctx)}: git check-ignore does not confirm it is ignored in ${show(top, ctx)}`,
        `add the folder to ${show(path.join(top, ".gitignore"), ctx)}, or pass --allow-untracked`,
      );
    }
  } else if (scope === "project" && !allowUntracked) {
    throw new InstallError(`refusing ${show(dest, ctx)}: not inside a git repository, so it cannot be confirmed as ignored`, "pass --allow-untracked, or use --scope user");
  }
}

// ---------------------------------------------------------------------------------------------
// Selection

const listOf = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The selection recorded in the manifest, from CLI flags. */
export function selectionFromFlags(flags) {
  const skills = flags.skills && flags.skills !== true ? uniqSorted(listOf(flags.skills)) : [];
  const mode = flags.all ? "all" : skills.length ? "skills" : "profile";
  return {
    mode,
    profile: mode === "profile" ? String(flags.profile || "core") : null,
    skills: mode === "skills" ? skills : [],
    includeInternal: Boolean(flags["include-internal"]),
    includeExternal: Boolean(flags["include-external"]),
  };
}

function normalizeSelection(sel) {
  const s = sel && typeof sel === "object" ? sel : {};
  const mode = ["profile", "skills", "all"].includes(s.mode) ? s.mode : "profile";
  return {
    mode,
    profile: mode === "profile" ? String(s.profile || "core") : null,
    skills: mode === "skills" ? uniqSorted(Array.isArray(s.skills) ? s.skills.map(String) : []) : [],
    includeInternal: Boolean(s.includeInternal),
    includeExternal: Boolean(s.includeExternal),
  };
}

/**
 * Resolves a selection against the model.
 * Returns { entries: [{id, kind: "skill"|"external", version, pack, srcDir?}], internal[], unknown[], notes[] }.
 * `--all` = every skill that is not internal; internal skills come only from --include-internal,
 * --profile internal, or an internal id in --skills. External bundles: native agents, status active.
 */
export function resolveSelection(model, selection, agent) {
  const sel = normalizeSelection(selection);
  const profiles = installProfiles(model);
  const notes = [];
  let ids;
  if (sel.mode === "all") ids = model.skills.filter((s) => s.manifest.pack !== "internal").map((s) => s.id);
  else if (sel.mode === "skills") ids = sel.skills;
  else if (profiles[sel.profile]) ids = profiles[sel.profile];
  else throw new InstallError(`unknown profile: ${sel.profile}`, "use --profile core|connector|internal", 2);
  const unknown = ids.filter((id) => !model.skillById[id]);
  ids = ids.filter((id) => model.skillById[id]);
  if (sel.includeInternal) ids = ids.concat(profiles.internal);
  ids = uniqSorted(ids);
  const entries = ids.map((id) => {
    const m = model.skillById[id].manifest;
    return { id, kind: "skill", version: String(m.version || "0.0.0"), pack: m.pack || "core" };
  });
  const internal = entries.filter((e) => e.pack === "internal").map((e) => e.id);
  if (sel.includeExternal) {
    if (!NATIVE_AGENTS.includes(agent)) notes.push("external bundles are native SKILL.md bundles only; skipped for the generic target");
    else {
      for (const ext of model.external) {
        const meta = ext.metadata || {};
        if (meta.status !== "active") {
          notes.push(`external ${ext.id}: status ${meta.status || "unknown"}, not installed (only active bundles install)`);
          continue;
        }
        if (!ID_RE.test(ext.id) || model.skillById[ext.id]) {
          notes.push(`external ${ext.id}: id is invalid or collides with an LPM skill; skipped`);
          continue;
        }
        let rel = typeof meta.bundle_target_path === "string" ? meta.bundle_target_path.replace(/\\/g, "/").replace(/\/+$/, "") : "";
        if (!rel.startsWith(`external/${ext.id}/`) || rel.split("/").includes("..")) rel = `external/${ext.id}/codex/${ext.id}`;
        entries.push({ id: ext.id, kind: "external", version: String(meta.upstream_ref || "unknown"), pack: "external", srcDir: rel });
      }
    }
  }
  entries.sort((a, b) => compareStrings(a.id, b.id));
  return { entries, internal, unknown, notes, selection: sel };
}

// ---------------------------------------------------------------------------------------------
// Files: desired (dist / external) and installed

/** Map<relPath, Buffer> of the files to install for an entry, or null when the source is missing. */
function desiredFiles(root, agent, entry) {
  const out = new Map();
  if (entry.kind === "external") {
    const dir = path.join(root, entry.srcDir);
    if (!isRealDir(dir)) return null;
    for (const rel of walk(dir)) out.set(rel, fs.readFileSync(path.join(dir, rel)));
    return out.size ? out : null;
  }
  if (agent === "generic") {
    const main = path.join(root, "dist", "generic", `${entry.id}.md`);
    if (!isFile(main)) return null;
    out.set(`${entry.id}.md`, fs.readFileSync(main));
    const flows = path.join(root, "dist", "generic", `${entry.id}.flows.md`);
    if (isFile(flows)) out.set(`${entry.id}.flows.md`, fs.readFileSync(flows));
    const refs = path.join(root, "dist", "generic", `${entry.id}.refs.md`);
    if (isFile(refs)) out.set(`${entry.id}.refs.md`, fs.readFileSync(refs));
    const tools = path.join(root, "dist", "generic", `${entry.id}.tools.md`);
    if (isFile(tools)) out.set(`${entry.id}.tools.md`, fs.readFileSync(tools));
    return out;
  }
  const dir = path.join(root, "dist", agent, entry.id);
  if (!isRealDir(dir)) return null;
  for (const rel of walk(dir)) out.set(rel, fs.readFileSync(path.join(dir, rel)));
  return out.size ? out : null;
}

function genericSharedFiles(root) {
  const out = new Map();
  for (const name of GENERIC_SHARED) {
    const p = path.join(root, "dist", "generic", name);
    if (isFile(p)) out.set(name, fs.readFileSync(p));
  }
  return out;
}

const shaMap = (files) => {
  const out = {};
  for (const rel of sortStrings([...files.keys()])) out[rel] = sha256(files.get(rel));
  return out;
};

/** Installed { relPath: sha256 } of a managed id. Native: every file under <dest>/<id>. Generic: the listed files. */
function installedShas(dest, agent, id, relPaths) {
  const out = {};
  if (agent === "generic" && relPaths) {
    for (const rel of relPaths) {
      const p = path.join(dest, rel);
      if (isFile(p)) out[rel] = sha256(fs.readFileSync(p));
    }
    return out;
  }
  const dir = path.join(dest, id);
  if (!isRealDir(dir)) return out;
  for (const rel of walk(dir)) out[rel] = sha256(fs.readFileSync(path.join(dir, rel)));
  return out;
}

function presentOnDisk(dest, agent, id, relPaths) {
  if (agent === "generic") return (relPaths || []).some((rel) => lstat(path.join(dest, rel)));
  return Boolean(lstat(path.join(dest, id)));
}

function sameShas(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/** Lists differences between expected and installed hash maps. */
function diffShas(expected, installed) {
  const missing = Object.keys(expected).filter((k) => !(k in installed));
  const changed = Object.keys(expected).filter((k) => k in installed && installed[k] !== expected[k]);
  const extra = Object.keys(installed).filter((k) => !(k in expected));
  return { missing: sortStrings(missing), changed: sortStrings(changed), extra: sortStrings(extra) };
}

function safeRel(rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\\") || path.isAbsolute(rel) || rel.includes("\0")) return false;
  return !rel.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}

function writeTree(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const rel of sortStrings([...files.keys()])) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files.get(rel));
  }
}

function rmTree(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/** Atomic per-skill directory swap (native targets). */
function swapSkillDir(dest, id, files) {
  const tmp = path.join(dest, `.tmp-${id}-${process.pid}`);
  const final = path.join(dest, id);
  rmTree(tmp);
  writeTree(tmp, files);
  const written = installedShas(path.dirname(tmp), "native", path.basename(tmp));
  if (!sameShas(written, shaMap(files))) {
    rmTree(tmp);
    throw new Error(`${id}: staged copy does not match dist (hash mismatch)`);
  }
  let old = null;
  if (lstat(final)) {
    old = path.join(dest, `.old-${id}-${process.pid}`);
    rmTree(old);
    fs.renameSync(final, old);
  }
  try {
    fs.renameSync(tmp, final);
  } catch (err) {
    if (old) fs.renameSync(old, final);
    rmTree(tmp);
    throw err;
  }
  if (old) rmTree(old);
}

/** Per-file atomic swap for flat targets (generic): stage, verify, then rename each file into place. */
function swapFlatFiles(dest, id, files, staleRels = []) {
  const tmp = path.join(dest, `.tmp-${id}-${process.pid}`);
  rmTree(tmp);
  writeTree(tmp, files);
  for (const rel of files.keys()) {
    if (sha256(fs.readFileSync(path.join(tmp, rel))) !== sha256(files.get(rel))) {
      rmTree(tmp);
      throw new Error(`${id}: staged copy does not match dist (hash mismatch)`);
    }
  }
  for (const rel of sortStrings([...files.keys()])) {
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(path.join(tmp, rel), target);
  }
  rmTree(tmp);
  for (const rel of staleRels) if (!files.has(rel) && safeRel(rel) && isFile(path.join(dest, rel))) fs.unlinkSync(path.join(dest, rel));
}

/** Removes one manifest-managed id. Refuses anything that is not a plain id directly under dest. */
function removeManaged(dest, agent, id, record) {
  if (!ID_RE.test(id) || PROTECTED_DIRS.has(id)) return false;
  if (agent === "generic") {
    let removed = false;
    for (const rel of Object.keys((record && record.files) || {})) {
      if (!safeRel(rel) || rel.includes("/")) continue;
      const p = path.join(dest, rel);
      if (isFile(p)) {
        fs.unlinkSync(p);
        removed = true;
      }
    }
    return removed;
  }
  const p = path.join(dest, id);
  if (path.dirname(p) !== path.resolve(dest)) return false;
  const st = lstat(p);
  if (!st) return false;
  if (st.isSymbolicLink() || st.isFile()) fs.unlinkSync(p);
  else rmTree(p);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Legacy bundles

function frontmatterName(md) {
  const text = String(md).replace(/^﻿/, "");
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    const m = line.match(/^name\s*:\s*(.*)$/);
    if (m) return m[1].trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  }
  return null;
}

/** The legacy bundle shape (§5.8 item 4): SKILL.md whose `name` equals the id, or manifest.json + PLAYBOOK.md. */
export function isLegacyBundle(dir, id) {
  if (!isRealDir(dir)) return false;
  const skill = isFile(path.join(dir, "SKILL.md")) ? readText(path.join(dir, "SKILL.md")) : null;
  if (skill !== null && frontmatterName(skill) === id) return true;
  return isFile(path.join(dir, "manifest.json")) && isFile(path.join(dir, "PLAYBOOK.md"));
}

function legacyIdsOf(model) {
  return uniqSorted(model.catalog.legacyIds.map((e) => e.legacy).filter((id) => ID_RE.test(id) && !PROTECTED_DIRS.has(id)));
}

// ---------------------------------------------------------------------------------------------
// Manifest

/** Reads <dest>/.agents-skills-manifest.json → { manifest | null, error | null, dropped[] }. */
export function readManifest(dest) {
  const p = path.join(dest, MANIFEST_FILE);
  if (!lstat(p)) return { manifest: null, error: null, dropped: [] };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    return { manifest: null, error: `invalid JSON (${err.message})`, dropped: [] };
  }
  if (!raw || typeof raw !== "object" || !raw.skills || typeof raw.skills !== "object" || Array.isArray(raw.skills)) {
    return { manifest: null, error: "missing `skills` object", dropped: [] };
  }
  const dropped = [];
  const skills = {};
  for (const id of sortStrings(Object.keys(raw.skills))) {
    const rec = raw.skills[id];
    if (!ID_RE.test(id) || PROTECTED_DIRS.has(id) || !rec || typeof rec !== "object") {
      dropped.push(id);
      continue;
    }
    const files = {};
    for (const [rel, sha] of Object.entries(rec.files || {})) if (safeRel(rel) && typeof sha === "string") files[rel] = sha;
    skills[id] = { version: String(rec.version || "0.0.0"), pack: String(rec.pack || "core"), files };
  }
  const shared = {};
  for (const [rel, sha] of Object.entries((raw.shared && raw.shared.files) || {})) if (safeRel(rel) && typeof sha === "string") shared[rel] = sha;
  return {
    manifest: {
      sourceCommit: raw.sourceCommit || null,
      agent: raw.agent,
      scope: raw.scope === "project" ? "project" : "user",
      selection: normalizeSelection(raw.selection),
      shared: { files: shared },
      skills,
    },
    error: null,
    dropped,
  };
}

/** Deterministic manifest text (sorted ids and files, LF). */
export function manifestText(m) {
  const sortObj = (o) => Object.fromEntries(sortStrings(Object.keys(o || {})).map((k) => [k, o[k]]));
  const skills = {};
  for (const id of sortStrings(Object.keys(m.skills))) {
    const s = m.skills[id];
    skills[id] = { version: s.version, pack: s.pack, files: sortObj(s.files) };
  }
  const sel = normalizeSelection(m.selection);
  return jsonText({
    schemaVersion: 1,
    generatedBy: GENERATED_BY,
    sourceCommit: m.sourceCommit || null,
    agent: m.agent,
    scope: m.scope,
    selection: sel,
    ...(m.agent === "generic" ? { shared: { files: sortObj((m.shared && m.shared.files) || {}) } } : {}),
    skills,
  });
}

function writeManifest(dest, m) {
  const text = manifestText(m);
  const p = path.join(dest, MANIFEST_FILE);
  if (readText(p) === text) return "unchanged";
  fs.mkdirSync(dest, { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
  return "written";
}

function sourceCommit(root) {
  const r = git(["rev-parse", "HEAD"], root);
  return r.status === 0 && /^[0-9a-f]{7,64}$/.test(r.stdout) ? r.stdout : null;
}

function leftovers(dest) {
  let names = [];
  try {
    names = fs.readdirSync(dest);
  } catch {
    return [];
  }
  return sortStrings(names.filter((n) => LEFTOVER_RE.test(n)));
}

// ---------------------------------------------------------------------------------------------
// Messages

function cmdFor(command, agent, scope, dest, ctx, extra = "") {
  const parts = [CLI, command, `--agent ${agent}`];
  if (scope === "project") parts.push("--scope project");
  if (ctx.flags.dest && ctx.flags.dest !== true) parts.push(`--dest ${show(dest, ctx)}`);
  if (extra) parts.push(extra);
  return parts.join(" ");
}

function report(ctx, problems) {
  for (const p of problems) {
    ctx.log.error(`problem [${p.kind}] ${p.id ? `${p.id}: ` : ""}${p.message}`);
    ctx.log.error(`  next: ${p.next}`);
  }
}

// ---------------------------------------------------------------------------------------------
// install

/** Core install routine shared by install and update. */
function runInstall(ctx, model, { agent, scope, dest, selection, prune, adoptLegacy, dryRun, allowUntracked, lenient, command }) {
  const log = ctx.log;
  const resolved = resolveSelection(model, selection, agent);
  if (resolved.unknown.length && !lenient) {
    throw new InstallError(`unknown skill id(s): ${resolved.unknown.join(", ")}`, `pick ids from skills/ (e.g. lpm-start)`, 2);
  }
  if (resolved.internal.length && scope !== "user") {
    throw new InstallError(
      `the internal pack (${resolved.internal.join(", ")}) installs only with --scope user`,
      "re-run with --scope user (never a project scope inside the lpm checkout)",
      2,
    );
  }
  checkDestination(dest, ctx, { scope, allowUntracked });
  const { manifest: old, error, dropped } = readManifest(dest);
  if (error) {
    throw new InstallError(`${show(path.join(dest, MANIFEST_FILE), ctx)} is unreadable: ${error}`, "move the manifest aside and re-run install");
  }
  if (old && old.agent !== agent) {
    throw new InstallError(
      `${show(dest, ctx)} is managed for agent ${old.agent}, not ${agent}`,
      `use --agent ${old.agent}, or another --dest`,
    );
  }
  for (const id of dropped) log.warn(`warning: ignored invalid manifest entry ${JSON.stringify(id)} (never removed)`);
  for (const n of resolved.notes) log.warn(`note: ${n}`);

  const oldSkills = old ? old.skills : {};
  const legacy = new Set(legacyIdsOf(model));
  const problems = [];
  const result = { agent, scope, dest, written: [], unchanged: [], removed: [], adopted: [], legacyPresent: [], unselected: [] };
  const nextSkills = {};
  const verifyAfter = [];
  const say = (msg) => log.info(`${dryRun ? "[dry-run] " : ""}${msg}`);

  for (const entry of resolved.entries) {
    const { id } = entry;
    const desired = desiredFiles(ctx.root, agent, entry);
    const prev = oldSkills[id] || null;
    if (!desired) {
      const src = entry.kind === "external" ? entry.srcDir : agent === "generic" ? `dist/generic/${id}.md` : `dist/${agent}/${id}/`;
      problems.push({ kind: "source-missing", id, message: `${src} is missing`, next: `${CLI} build` });
      if (prev) nextSkills[id] = prev;
      continue;
    }
    const want = shaMap(desired);
    const rels = sortStrings([...new Set([...Object.keys(want), ...Object.keys(prev ? prev.files : {})])]);
    const installed = installedShas(dest, agent, id, rels);
    const present = presentOnDisk(dest, agent, id, rels);
    const record = { version: entry.version, pack: entry.pack, files: want };
    if (present && !prev) {
      if (sameShas(installed, want)) {
        nextSkills[id] = record;
        result.adopted.push(id);
        result.unchanged.push(id);
        if (ctx.flags.verbose) say(`adopted ${id} (identical to dist)`);
        continue;
      }
      if (agent !== "generic" && legacy.has(id) && isLegacyBundle(path.join(dest, id), id)) {
        if (!adoptLegacy) {
          problems.push({
            kind: "conflict",
            id,
            message: `${show(path.join(dest, id), ctx)} is a legacy bundle`,
            next: cmdFor("install", agent, scope, dest, ctx, "--adopt-legacy"),
          });
          continue;
        }
        say(`replacing legacy ${id} in place`);
      } else {
        problems.push({
          kind: "conflict",
          id,
          message: `${show(agent === "generic" ? dest : path.join(dest, id), ctx)} holds an unmanaged copy (not in ${MANIFEST_FILE})`,
          next: `move it out of ${show(dest, ctx)}, then re-run install`,
        });
        continue;
      }
    }
    if (present && sameShas(installed, want)) {
      nextSkills[id] = record;
      result.unchanged.push(id);
      if (ctx.flags.verbose) say(`unchanged ${id}`);
      continue;
    }
    nextSkills[id] = record;
    result.written.push(id);
    if (dryRun) {
      say(`would install ${id} (${desired.size} files)`);
      continue;
    }
    if (agent === "generic") swapFlatFiles(dest, id, desired, prev ? Object.keys(prev.files) : []);
    else swapSkillDir(dest, id, desired);
    verifyAfter.push([id, want, rels]);
    say(`installed ${id} ${entry.version} (${desired.size} files)`);
  }

  // Generic: INDEX.md and AGENTS-snippet.md are shared by every skill.
  let shared = { files: {} };
  if (agent === "generic") {
    const files = genericSharedFiles(ctx.root);
    const want = shaMap(files);
    shared = { files: want };
    const installed = installedShas(dest, agent, null, Object.keys(want));
    if (!files.size) problems.push({ kind: "source-missing", id: null, message: "dist/generic/INDEX.md is missing", next: `${CLI} build` });
    else if (!sameShas(installed, want)) {
      const unmanaged = Object.keys(installed).filter((rel) => !(old && old.shared.files[rel]));
      if (unmanaged.length) {
        problems.push({
          kind: "conflict",
          id: null,
          message: `${unmanaged.join(", ")} already exist in ${show(dest, ctx)} and are not managed`,
          next: `move them out of ${show(dest, ctx)}, then re-run install`,
        });
        shared = old ? old.shared : { files: {} };
      } else if (dryRun) say(`would write ${[...files.keys()].join(", ")}`);
      else {
        swapFlatFiles(dest, "index", files);
        verifyAfter.push([null, want, Object.keys(want)]);
        say(`wrote ${[...files.keys()].join(", ")}`);
      }
    }
  }

  // Legacy bundles (--adopt-legacy): only legacy-shaped, unmanaged directories directly under dest.
  const selectedIds = new Set(resolved.entries.map((e) => e.id));
  if (agent !== "generic") {
    for (const id of legacy) {
      if (selectedIds.has(id) || oldSkills[id]) continue;
      const dir = path.join(dest, id);
      if (!lstat(dir)) continue;
      if (!isLegacyBundle(dir, id)) {
        if (adoptLegacy) log.warn(`kept ${show(dir, ctx)}: it does not match the legacy bundle shape`);
        continue;
      }
      if (!adoptLegacy) {
        result.legacyPresent.push(id);
        continue;
      }
      if (!dryRun) rmTree(dir);
      result.removed.push(id);
      say(`${dryRun ? "would remove" : "removed"} legacy ${show(dir, ctx)}`);
    }
    if (result.legacyPresent.length) {
      log.warn(`warning: legacy bundles still installed: ${result.legacyPresent.join(", ")}`);
      log.warn(`  next: ${cmdFor("update", agent, scope, dest, ctx, "--adopt-legacy")}`);
    }
  }

  // Ownership-safe prune: only ids of the previous manifest that are no longer selected.
  for (const id of sortStrings(Object.keys(oldSkills))) {
    if (selectedIds.has(id)) continue;
    if (!prune) {
      nextSkills[id] = oldSkills[id];
      result.unselected.push(id);
      continue;
    }
    if (!dryRun) removeManaged(dest, agent, id, oldSkills[id]);
    result.removed.push(id);
    say(`${dryRun ? "would remove" : "removed"} ${id} (managed, no longer selected)`);
  }
  if (result.unselected.length) {
    log.warn(`warning: managed but not selected: ${result.unselected.join(", ")}`);
    log.warn(`  next: ${cmdFor("prune", agent, scope, dest, ctx)}`);
  }

  if (!dryRun) {
    for (const name of leftovers(dest)) {
      const id = name.match(LEFTOVER_RE)[2];
      if (selectedIds.has(id) || oldSkills[id] || id === "index") rmTree(path.join(dest, name));
    }
    // Re-verify every written copy against the hashes it was written from.
    for (const [id, want, rels] of verifyAfter) {
      const got = id === null ? installedShas(dest, agent, null, Object.keys(want)) : installedShas(dest, agent, id, rels);
      if (!sameShas(got, want)) {
        problems.push({ kind: "modified", id, message: "installed files differ from dist right after the write", next: cmdFor("update", agent, scope, dest, ctx) });
      }
    }
    const touched = Object.keys(nextSkills).length || old || result.removed.length;
    if (touched) {
      const status = writeManifest(dest, {
        sourceCommit: sourceCommit(ctx.root),
        agent,
        scope,
        selection: resolved.selection,
        shared,
        skills: nextSkills,
      });
      if (ctx.flags.verbose) say(`manifest ${status}`);
    }
  }

  report(ctx, problems);
  const total = resolved.entries.length;
  log.info(
    `${command} ${agent}/${scope} → ${show(dest, ctx)}: ${total} selected · ${result.written.length} ${dryRun ? "to write" : "written"} · ${result.unchanged.length} unchanged · ${result.removed.length} ${dryRun ? "to remove" : "removed"} · ${problems.length} problem(s)`,
  );
  if (agent === "generic" && !dryRun && !problems.length) {
    log.info(`LPM: read \`${show(path.join(dest, "INDEX.md"), ctx)}\` first, then exactly one \`<id>.md\`, and the one playbook it names in \`<id>.flows.md\`.`);
  }
  result.problems = problems;
  result.exitCode = problems.length ? 1 : 0;
  result.ok = result.exitCode === 0;
  return result;
}

function fail(ctx, err) {
  if (!(err instanceof InstallError)) throw err;
  ctx.log.error(`error: ${err.message}`);
  if (err.next) ctx.log.error(`  next: ${err.next}`);
  return { exitCode: err.exitCode, ok: false, error: err.message, next: err.next };
}

/** `install --agent X [--scope] [--dest] [--profile|--skills|--all] [--include-internal] [--include-external] [--prune] [--adopt-legacy] [--allow-untracked] [--dry-run]` */
export async function install(opts) {
  const ctx = contextOf(opts);
  const f = ctx.flags;
  try {
    const agent = f.agent;
    if (!AGENTS.includes(agent)) throw new InstallError(`install needs --agent ${AGENTS.join("|")}`, null, 2);
    const scope = f.scope || "user";
    const dest = resolveDest(agent, scope, ctx);
    const model = loadModel(ctx.root);
    return runInstall(ctx, model, {
      agent,
      scope,
      dest,
      selection: selectionFromFlags(f),
      prune: Boolean(f.prune),
      adoptLegacy: Boolean(f["adopt-legacy"]),
      dryRun: Boolean(f["dry-run"]),
      allowUntracked: Boolean(f["allow-untracked"]),
      lenient: false,
      command: "install",
    });
  } catch (err) {
    return fail(ctx, err);
  }
}

/** Finds the managed roots for update/prune: [{ agent, dest, manifest }]. */
function managedTargets(ctx, command) {
  const f = ctx.flags;
  const scope = f.scope || "user";
  const agents = f.agent ? [f.agent] : NATIVE_AGENTS;
  const out = [];
  const seen = new Set();
  for (const agent of agents) {
    const dest = resolveDest(agent, scope, ctx);
    if (seen.has(dest)) continue; // codex and antigravity share <repo>/.agents/skills at project scope
    seen.add(dest);
    const { manifest, error } = readManifest(dest);
    if (error) throw new InstallError(`${show(path.join(dest, MANIFEST_FILE), ctx)} is unreadable: ${error}`, "move the manifest aside and re-run install");
    if (!manifest) {
      if (f.agent || f.dest) {
        throw new InstallError(`no ${MANIFEST_FILE} in ${show(dest, ctx)}`, cmdFor("install", agent, scope, dest, ctx));
      }
      continue;
    }
    if (!AGENTS.includes(manifest.agent)) throw new InstallError(`${show(dest, ctx)}: manifest agent ${JSON.stringify(manifest.agent)} is unknown`, "move the manifest aside and re-run install");
    if (manifest.agent !== agent) {
      if (f.agent) throw new InstallError(`${show(dest, ctx)} is managed for agent ${manifest.agent}, not ${f.agent}`, `use --agent ${manifest.agent}`);
      if (agents.includes(manifest.agent) && resolveDest(manifest.agent, scope, ctx) !== dest) continue;
    }
    out.push({ agent: manifest.agent, dest, manifest });
  }
  if (!out.length) throw new InstallError(`no managed install found for ${command} (${agents.join(", ")}, scope ${scope})`, `${CLI} install --agent <agent>`);
  return out;
}

/** `update [--agent X] [--scope] [--dest]`: install with the manifest's agent, scope and selection, plus --prune. */
export async function update(opts) {
  const ctx = contextOf(opts);
  const f = ctx.flags;
  try {
    if (f.profile || f.skills || f.all || f["include-internal"] || f["include-external"]) {
      throw new InstallError("update reuses the manifest's selection; selection flags are not accepted", `use ${CLI} install to change the selection`, 2);
    }
    const model = loadModel(ctx.root);
    const results = [];
    for (const t of managedTargets(ctx, "update")) {
      results.push(
        runInstall(ctx, model, {
          agent: t.agent,
          scope: t.manifest.scope,
          dest: t.dest,
          selection: t.manifest.selection,
          prune: true,
          adoptLegacy: Boolean(f["adopt-legacy"]),
          dryRun: Boolean(f["dry-run"]),
          allowUntracked: Boolean(f["allow-untracked"]),
          lenient: true,
          command: "update",
        }),
      );
    }
    const exitCode = results.some((r) => r.exitCode) ? 1 : 0;
    return { exitCode, ok: exitCode === 0, results };
  } catch (err) {
    return fail(ctx, err);
  }
}

/** `prune [--agent X] [--scope] [--dest] [--adopt-legacy] [--dry-run]`: removes managed ids that are no longer selected. */
export async function prune(opts) {
  const ctx = contextOf(opts);
  const f = ctx.flags;
  const dryRun = Boolean(f["dry-run"]);
  try {
    const model = loadModel(ctx.root);
    const results = [];
    for (const t of managedTargets(ctx, "prune")) {
      checkDestination(t.dest, ctx, { scope: t.manifest.scope, writes: false });
      const resolved = resolveSelection(model, t.manifest.selection, t.agent);
      const selected = new Set(resolved.entries.map((e) => e.id));
      const skills = { ...t.manifest.skills };
      const removed = [];
      const say = (msg) => ctx.log.info(`${dryRun ? "[dry-run] " : ""}${msg}`);
      for (const id of sortStrings(Object.keys(skills))) {
        if (selected.has(id)) continue;
        if (!dryRun) removeManaged(t.dest, t.agent, id, skills[id]);
        delete skills[id];
        removed.push(id);
        say(`${dryRun ? "would remove" : "removed"} ${id} (managed, no longer selected)`);
      }
      if (f["adopt-legacy"] && t.agent !== "generic") {
        for (const id of legacyIdsOf(model)) {
          if (skills[id] || selected.has(id)) continue;
          const dir = path.join(t.dest, id);
          if (!lstat(dir)) continue;
          if (!isLegacyBundle(dir, id)) {
            ctx.log.warn(`kept ${show(dir, ctx)}: it does not match the legacy bundle shape`);
            continue;
          }
          if (!dryRun) rmTree(dir);
          removed.push(id);
          say(`${dryRun ? "would remove" : "removed"} legacy ${show(dir, ctx)}`);
        }
      }
      if (!dryRun) {
        for (const name of leftovers(t.dest)) {
          const id = name.match(LEFTOVER_RE)[2];
          if (t.manifest.skills[id] || selected.has(id) || id === "index") {
            rmTree(path.join(t.dest, name));
            say(`removed leftover ${name}`);
          }
        }
        writeManifest(t.dest, { ...t.manifest, agent: t.agent, skills });
      }
      ctx.log.info(`prune ${t.agent}/${t.manifest.scope} → ${show(t.dest, ctx)}: ${removed.length} ${dryRun ? "to remove" : "removed"}`);
      results.push({ agent: t.agent, dest: t.dest, removed });
    }
    return { exitCode: 0, ok: true, results };
  } catch (err) {
    return fail(ctx, err);
  }
}

// ---------------------------------------------------------------------------------------------
// verify

/** Collects every problem of one install root (never stops at the first). */
export function collectProblems(ctx, model, agent, scope, dest) {
  const problems = [];
  const add = (kind, id, message, next) => problems.push({ kind, id, message, next, dest });
  const updateCmd = cmdFor("update", agent, scope, dest, ctx);
  const legacy = legacyIdsOf(model);
  const { manifest, error } = readManifest(dest);
  let managed = {};
  if (error) add("manifest-invalid", null, `${show(path.join(dest, MANIFEST_FILE), ctx)} is unreadable: ${error}`, "move the manifest aside and re-run install");
  else if (!manifest) add("not-installed", null, `no ${MANIFEST_FILE} in ${show(dest, ctx)}`, cmdFor("install", agent, scope, dest, ctx));
  else if (manifest.agent !== agent) add("agent-mismatch", null, `${show(dest, ctx)} is managed for agent ${manifest.agent}`, `run verify with --agent ${manifest.agent}`);
  else {
    managed = manifest.skills;
    const resolved = resolveSelection(model, manifest.selection, agent);
    const byId = new Map(resolved.entries.map((e) => [e.id, e]));
    for (const id of sortStrings(Object.keys(managed))) {
      const rec = managed[id];
      if (!byId.has(id)) {
        add("orphaned", id, "managed by a previous install but no longer selected or in the catalog", cmdFor("prune", agent, scope, dest, ctx));
        continue;
      }
      const rels = Object.keys(rec.files);
      if (!presentOnDisk(dest, agent, id, rels)) {
        add("missing", id, `managed copy is missing from ${show(dest, ctx)}`, updateCmd);
        continue;
      }
      const d = diffShas(rec.files, installedShas(dest, agent, id, rels));
      const changes = [...d.missing.map((r) => `${r} missing`), ...d.changed.map((r) => `${r} changed`), ...d.extra.map((r) => `${r} unexpected`)];
      if (changes.length) {
        const shown = changes.slice(0, 5).join(", ") + (changes.length > 5 ? `, … ${changes.length - 5} more` : "");
        add("modified", id, shown, updateCmd);
        continue;
      }
      const desired = desiredFiles(ctx.root, agent, byId.get(id));
      if (!desired) add("source-missing", id, "no rendered source to compare with", `${CLI} build`);
      else if (!sameShas(shaMap(desired), rec.files)) add("outdated", id, "installed copy differs from the current dist/", updateCmd);
    }
    for (const id of byId.keys()) if (!managed[id]) add("missing", id, "selected but not installed", updateCmd);
    if (agent === "generic") {
      const files = genericSharedFiles(ctx.root);
      const d = diffShas(manifest.shared.files, installedShas(dest, agent, null, Object.keys(manifest.shared.files)));
      if (!Object.keys(manifest.shared.files).length || d.missing.length || d.changed.length) add("modified", null, "INDEX.md / AGENTS-snippet.md missing or changed", updateCmd);
      else if (!sameShas(shaMap(files), manifest.shared.files)) add("outdated", null, "INDEX.md / AGENTS-snippet.md differ from the current dist/", updateCmd);
    }
  }
  if (agent !== "generic" && isDir(dest)) {
    for (const id of legacy) {
      if (managed[id]) continue;
      const dir = path.join(dest, id);
      if (isLegacyBundle(dir, id)) add(
          "legacy",
          id,
          `legacy bundle still present at ${show(dir, ctx)}`,
          manifest ? cmdFor("update", agent, scope, dest, ctx, "--adopt-legacy") : cmdFor("install", agent, scope, dest, ctx, "--profile core --prune --adopt-legacy"),
        );
    }
  }
  for (const name of leftovers(dest)) add("leftover", null, `${name} was left by an interrupted install`, cmdFor("prune", agent, scope, dest, ctx));
  return problems;
}

function readInstallTargets(ctx, agent) {
  const p = path.join(ctx.root, INSTALL_TARGETS_FILE);
  const text = readText(p);
  if (text === null) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new InstallError(`${INSTALL_TARGETS_FILE} is invalid JSON (${err.message})`, `fix ${show(p, ctx)}`);
  }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw && raw.projects) ? raw.projects : [];
  const out = [];
  for (const e of list) {
    const entry = typeof e === "string" ? { path: e } : e && typeof e === "object" ? e : null;
    if (!entry || typeof entry.path !== "string") continue;
    if (Array.isArray(entry.agents) && !entry.agents.includes(agent)) continue;
    out.push(path.resolve(ctx.root, expandHome(entry.path, ctx.home)));
  }
  return uniqSorted(out);
}

/** `verify --agent X [--scope user|project] [--dest DIR] [--project DIR]`: aggregates all problems. */
export async function verify(opts) {
  const ctx = contextOf(opts);
  const f = ctx.flags;
  try {
    const agent = f.agent;
    if (!AGENTS.includes(agent)) throw new InstallError(`verify needs --agent ${AGENTS.join("|")}`, null, 2);
    const scope = f.scope || "user";
    let dests;
    if (f.dest && f.dest !== true) dests = [resolveDest(agent, scope, ctx)];
    else if (agent === "generic") throw new InstallError("the generic target needs --dest DIR", "re-run with --dest <dir>", 2);
    else if (scope === "project" && !f.project) {
      const projects = readInstallTargets(ctx, agent);
      const roots = projects && projects.length ? projects : [projectRoot(ctx)];
      dests = roots.map((repo) => (agent === "claude-code" ? path.join(repo, ".claude", "skills") : path.join(repo, ".agents", "skills")));
    } else dests = [resolveDest(agent, scope, ctx)];
    const model = loadModel(ctx.root);
    const problems = [];
    for (const dest of dests) problems.push(...collectProblems(ctx, model, agent, scope, dest));
    report(ctx, problems);
    const roots = dests.map((d) => show(d, ctx)).join(", ");
    if (problems.length) ctx.log.error(`verify ${agent}/${scope}: ${problems.length} problem(s) in ${roots}`);
    else ctx.log.info(`verify ${agent}/${scope}: ok (${roots})`);
    return { exitCode: problems.length ? 1 : 0, ok: !problems.length, problems, dests };
  } catch (err) {
    return fail(ctx, err);
  }
}

// ---------------------------------------------------------------------------------------------
// doctor

const isLpmName = (name) => /(^|[^a-z0-9])lpm([^a-z0-9]|$)/i.test(name);
const cleanName = (name) => String(name).replace(/[^\x20-\x7e]/g, "?").slice(0, 64);

/** Server names from a Codex config.toml ([mcp_servers.<name>] tables). Values are only scanned for lpm.rocks. */
export function codexServerNames(text) {
  const names = new Set();
  const lpm = new Set();
  let current = null;
  let inRootTable = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/^\s+/, "");
    if (line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inRootTable = /^\[\s*mcp_servers\s*\]/.test(line);
      const m = line.match(/^\[\s*mcp_servers\s*\.\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))/);
      current = m ? m[1] || m[2] || m[3] : null;
      if (current) names.add(current);
      continue;
    }
    const dotted = line.match(/^mcp_servers\s*\.\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*[.=]/);
    if (dotted && !current) names.add(dotted[1] || dotted[2]);
    if (inRootTable) {
      const m = line.match(/^(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*=/);
      if (m) {
        current = m[1] || m[2];
        names.add(current);
      }
    }
    if (current && /lpm\.rocks/i.test(line)) lpm.add(current);
  }
  return { names: sortStrings([...names]), lpm: sortStrings([...lpm]) };
}

function jsonServers(obj) {
  const names = [];
  const lpm = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const name of Object.keys(obj)) {
      names.push(name);
      let value = "";
      try {
        value = JSON.stringify(obj[name]) || "";
      } catch {
        value = "";
      }
      if (/lpm\.rocks/i.test(value)) lpm.push(name);
    }
  }
  return { names, lpm };
}

/** MCP config sources per agent: [{ label, path, read(text) → {names, lpm} }]. */
function mcpConfigSources(agent, ctx) {
  const env = ctx.env;
  const fromEnv = (name) => (env[name] ? path.resolve(ctx.cwd, expandHome(env[name], ctx.home)) : null);
  if (agent === "codex") {
    const codexHome = fromEnv("CODEX_HOME") || path.join(ctx.home, ".codex");
    return [{ path: path.join(codexHome, "config.toml"), read: (t) => codexServerNames(t) }];
  }
  if (agent === "claude-code") {
    const dir = fromEnv("CLAUDE_CONFIG_DIR") || ctx.home;
    const project = projectRoot(ctx);
    return [
      {
        path: path.join(dir, ".claude.json"),
        read: (t) => {
          const j = JSON.parse(t);
          const user = jsonServers(j && j.mcpServers);
          const local = jsonServers(j && j.projects && j.projects[project] && j.projects[project].mcpServers);
          return { names: uniqSorted([...user.names, ...local.names]), lpm: uniqSorted([...user.lpm, ...local.lpm]) };
        },
      },
      { path: path.join(project, ".mcp.json"), optional: true, read: (t) => jsonServers(JSON.parse(t).mcpServers) },
    ];
  }
  if (agent === "antigravity") {
    return [{ path: path.join(ctx.home, ".gemini", "config", "mcp_config.json"), read: (t) => jsonServers(JSON.parse(t).mcpServers) }];
  }
  return [];
}

const ADD_LPM = {
  codex: `add to ~/.codex/config.toml: [mcp_servers.LPM] url = "${ENDPOINT}" env_http_headers = { "x-api-key" = "LPM_API_KEY" } (lpm-start references/agent-setup.md)`,
  "claude-code": `claude mcp add --transport http --scope user lpm ${ENDPOINT} --header "x-api-key: $LPM_API_KEY" (or rely on the claude.ai LPM connector; lpm-start references/agent-setup.md)`,
  antigravity: `agy mcp add --header "x-api-key: $LPM_API_KEY" lpm ${ENDPOINT} (lpm-start references/agent-setup.md)`,
};

/** `doctor [--agent X] [--scope]`: MCP server NAMES per agent (never values) and one next action per problem. */
export async function doctor(opts) {
  const ctx = contextOf(opts);
  const f = ctx.flags;
  const log = ctx.log;
  try {
    const scope = f.scope || "user";
    const agents = f.agent ? [f.agent] : NATIVE_AGENTS;
    const model = loadModel(ctx.root);
    const all = [];
    for (const agent of agents) {
      log.info(`doctor: ${agent}`);
      const problems = [];
      const add = (message, next) => problems.push({ agent, message, next });
      if (agent === "generic") {
        log.info("  MCP servers: (the generic target has no agent config to inspect)");
      }
      let names = [];
      let lpm = [];
      for (const src of mcpConfigSources(agent, ctx)) {
        const text = readText(src.path);
        if (text === null) {
          if (!src.optional) log.info(`  config: ${show(src.path, ctx)} (absent)`);
          continue;
        }
        try {
          const r = src.read(text);
          names = names.concat(r.names);
          lpm = lpm.concat(r.lpm);
          log.info(`  config: ${show(src.path, ctx)}`);
        } catch {
          add(`${show(src.path, ctx)} could not be parsed`, `fix the file syntax (doctor never prints its contents)`);
        }
      }
      names = uniqSorted(names);
      const hasLpm = names.some(isLpmName) || lpm.length > 0;
      if (agent !== "generic") log.info(`  MCP servers: ${names.length ? names.map(cleanName).join(", ") : "(none)"}`);

      let dest = null;
      try {
        dest = agent === "generic" ? (f.dest && f.dest !== true ? resolveDest(agent, scope, ctx) : null) : resolveDest(agent, scope, ctx);
      } catch {
        dest = null;
      }
      let managed = [];
      if (dest) {
        const { manifest } = readManifest(dest);
        managed = manifest && manifest.agent === agent ? Object.keys(manifest.skills) : [];
        log.info(`  skills (${scope}): ${managed.length} managed in ${show(dest, ctx)}`);
        if (managed.length || isDir(dest)) {
          const vp = collectProblems(ctx, model, agent, scope, dest).filter((p) => p.kind !== "not-installed");
          const byKind = new Map();
          for (const p of vp) byKind.set(p.kind, [...(byKind.get(p.kind) || []), p]);
          for (const [kind, list] of [...byKind.entries()].sort((a, b) => compareStrings(a[0], b[0]))) {
            const ids = list.map((p) => p.id).filter(Boolean);
            add(`${list.length} ${kind} item(s)${ids.length ? `: ${ids.slice(0, 6).join(", ")}${ids.length > 6 ? ", …" : ""}` : ""}`, list[0].next);
          }
        }
        if (managed.includes("grill-me")) {
          log.info("  note: external grill-me uses `disable-model-invocation` (rejected by Codex quick_validate) and depends on the non-imported `grilling` skill; reported, not fixed");
        }
      }
      if (agent !== "generic") {
        if (managed.length && !hasLpm) {
          if (agent === "claude-code") {
            // Not a problem: Claude Code users often rely on the claude.ai LPM connector, which has no local config.
            log.info("  note: no local LPM MCP server; fine if the claude.ai LPM connector is enabled");
            log.info(`    to add a local one: ${ADD_LPM[agent]}`);
          } else add("skills are installed but no LPM MCP server is configured", ADD_LPM[agent]);
        }
        if (!managed.length && hasLpm) add("an LPM MCP server is configured but no LPM skills are installed", cmdFor("install", agent, scope, dest, ctx, "--profile core"));
      }
      if (agent === "antigravity" && scope === "user" && isDir(path.join(ctx.home, ".antigravity", "skills"))) {
        add("~/.antigravity/skills is no longer scanned by Antigravity (the root is ~/.gemini/config/skills)", "install with --agent antigravity, then delete ~/.antigravity/skills yourself");
      }
      for (const p of problems) {
        log.warn(`  problem: ${p.message}`);
        log.warn(`    next: ${p.next}`);
      }
      if (!problems.length) log.info("  ok");
      all.push(...problems);
    }
    log.info(`doctor: ${all.length} problem(s)`);
    return { exitCode: all.length ? 1 : 0, ok: !all.length, problems: all };
  } catch (err) {
    return fail(ctx, err);
  }
}
