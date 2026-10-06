// install / update / verify / doctor / prune (§5.8). Every test uses temporary directories only:
// HOME, CODEX_HOME etc. point into a fresh temp dir, never at the real ~/.codex, ~/.claude or ~/.gemini.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fixtureCopy, listFiles, read, SCRIPTS, tempDir } from "./helpers.mjs";
import { runBuild } from "../lib/build.mjs";
import { sha256 } from "../lib/fs.mjs";
import { codexServerNames, doctor, install, isLegacyBundle, isLpmOrigin, MANIFEST_FILE, prune, update, verify } from "../lib/install.mjs";

const CORE = ["lpm-deliver-activity", "lpm-roadmap", "lpm-start"];

function setup(name) {
  const root = fixtureCopy(name);
  runBuild(root);
  const home = tempDir(`${name}-home`);
  const env = { HOME: home };
  const lines = [];
  const log = {
    info: (...a) => lines.push(a.join(" ")),
    warn: (...a) => lines.push(a.join(" ")),
    error: (...a) => lines.push(a.join(" ")),
  };
  const run = (fn, flags, extra = {}) => fn({ root, flags, args: [], log, env, cwd: home, ...extra });
  const out = () => lines.join("\n");
  const clear = () => lines.splice(0, lines.length);
  return { root, home, env, run, out, clear, lines };
}

const codexRoot = (home) => path.join(home, ".codex", "skills");
const manifestOf = (dest) => JSON.parse(fs.readFileSync(path.join(dest, MANIFEST_FILE), "utf8"));
const dirs = (dest) =>
  fs
    .readdirSync(dest, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
const write = (p, text) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const legacySkill = (dir, name) => write(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: old\n---\n# Old\n`);
const gitInit = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync("git", ["init", "-q", dir], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

test("install is idempotent: same files as dist, a sorted manifest, no leftovers", async () => {
  const t = setup("inst-idem");
  const dest = codexRoot(t.home);
  const first = await t.run(install, { agent: "codex" });
  assert.equal(first.exitCode, 0, t.out());
  assert.deepEqual(first.written, CORE);
  assert.deepEqual(dirs(dest), CORE); // core profile: no internal skill, no legacy dir
  for (const id of CORE) {
    assert.deepEqual(listFiles(path.join(dest, id)), listFiles(path.join(t.root, "dist", "codex", id)), id);
    for (const f of listFiles(path.join(dest, id))) assert.equal(read(dest, `${id}/${f}`), read(t.root, `dist/codex/${id}/${f}`));
  }
  const m = manifestOf(dest);
  assert.equal(m.agent, "codex");
  assert.equal(m.scope, "user");
  assert.deepEqual(Object.keys(m.skills), CORE);
  assert.deepEqual(m.selection, { mode: "profile", profile: "core", skills: [], includeInternal: false, includeExternal: false });
  const skillMd = fs.readFileSync(path.join(t.root, "dist/codex/lpm-start/SKILL.md"));
  assert.equal(m.skills["lpm-start"].files["SKILL.md"], sha256(skillMd));
  assert.equal(m.skills["lpm-start"].version, "2.0.0");
  const text1 = fs.readFileSync(path.join(dest, MANIFEST_FILE), "utf8");
  assert.ok(!text1.includes("\r") && text1.endsWith("}\n"));

  const second = await t.run(install, { agent: "codex" });
  assert.equal(second.exitCode, 0);
  assert.deepEqual(second.written, []);
  assert.deepEqual(second.unchanged, CORE);
  assert.equal(fs.readFileSync(path.join(dest, MANIFEST_FILE), "utf8"), text1);
  assert.deepEqual(
    fs.readdirSync(dest).filter((n) => /^\.(tmp|old)-/.test(n)),
    [],
  );
});

test("install cleans its own interrupted swaps but never a third-party leftover", async () => {
  const t = setup("inst-left");
  const dest = codexRoot(t.home);
  write(path.join(dest, ".tmp-lpm-start-999", "SKILL.md"), "partial");
  write(path.join(dest, ".old-lpm-roadmap-1", "SKILL.md"), "old");
  write(path.join(dest, ".tmp-someone-else-1", "x"), "theirs");
  const r = await t.run(install, { agent: "codex" });
  assert.equal(r.exitCode, 0, t.out());
  assert.deepEqual(
    fs.readdirSync(dest).filter((n) => n.startsWith(".")).sort(),
    [MANIFEST_FILE, ".tmp-someone-else-1"].sort(),
  );
});

test("update reuses the manifest selection, rewrites only changed skills and is idempotent", async () => {
  const t = setup("upd");
  const dest = codexRoot(t.home);
  assert.equal((await t.run(install, { agent: "codex", skills: "lpm-start,lpm-roadmap" })).exitCode, 0);
  fs.appendFileSync(path.join(t.root, "dist/codex/lpm-start/SKILL.md"), "\nchanged\n");
  const u1 = await t.run(update, {});
  assert.equal(u1.exitCode, 0, t.out());
  assert.deepEqual(u1.results[0].written, ["lpm-start"]);
  assert.deepEqual(u1.results[0].unchanged, ["lpm-roadmap"]);
  assert.equal(read(dest, "lpm-start/SKILL.md"), read(t.root, "dist/codex/lpm-start/SKILL.md"));
  assert.deepEqual(dirs(dest), ["lpm-roadmap", "lpm-start"]);
  const u2 = await t.run(update, { agent: "codex" });
  assert.deepEqual(u2.results[0].written, []);
  assert.equal((await t.run(verify, { agent: "codex" })).exitCode, 0, t.out());

  // Selection flags are refused; a missing manifest is an error with one next action.
  assert.equal((await t.run(update, { agent: "codex", profile: "core" })).exitCode, 2);
  const none = await t.run(update, { agent: "claude-code" });
  assert.equal(none.exitCode, 1);
  assert.match(none.next, /install --agent claude-code/);
});

test("update prunes managed skills that left the catalog", async () => {
  const t = setup("upd-prune");
  const dest = codexRoot(t.home);
  assert.equal((await t.run(install, { agent: "codex", all: true })).exitCode, 0);
  fs.rmSync(path.join(t.root, "skills", "lpm-roadmap"), { recursive: true });
  const u = await t.run(update, { agent: "codex" });
  assert.equal(u.exitCode, 0, t.out());
  assert.deepEqual(u.results[0].removed, ["lpm-roadmap"]);
  assert.deepEqual(dirs(dest), ["lpm-deliver-activity", "lpm-start"]);
  assert.deepEqual(Object.keys(manifestOf(dest).skills), ["lpm-deliver-activity", "lpm-start"]);
});

test("prune removes only manifest ids; .system/, synced/ and third-party dirs are never touched", async () => {
  const t = setup("prune");
  const dest = codexRoot(t.home);
  write(path.join(dest, ".system", "lpm-roadmap", "SKILL.md"), "system");
  write(path.join(dest, "synced", "lpm-roadmap", "SKILL.md"), "synced");
  write(path.join(dest, "doc", "SKILL.md"), "---\nname: doc\n---\n");
  write(path.join(dest, "notes.txt"), "mine");
  write(path.join(path.dirname(dest), "outside", "keep.txt"), "outside");
  assert.equal((await t.run(install, { agent: "codex", all: true })).exitCode, 0, t.out());

  // Without --prune, de-selected managed ids are kept and reported.
  t.clear();
  const keep = await t.run(install, { agent: "codex", skills: "lpm-start" });
  assert.deepEqual(keep.removed, []);
  assert.deepEqual(keep.unselected, ["lpm-deliver-activity", "lpm-roadmap"]);
  assert.match(t.out(), /next: node scripts\/skills\.mjs prune --agent codex/);

  // A tampered manifest cannot point prune outside the managed ids.
  const m = manifestOf(dest);
  m.skills["../outside"] = { version: "1", pack: "core", files: { "keep.txt": "x" } };
  m.skills[".system"] = { version: "1", pack: "core", files: {} };
  fs.writeFileSync(path.join(dest, MANIFEST_FILE), JSON.stringify(m));
  const p = await t.run(prune, { agent: "codex" });
  assert.equal(p.exitCode, 0, t.out());
  assert.deepEqual(p.results[0].removed, ["lpm-deliver-activity", "lpm-roadmap"]);
  assert.deepEqual(dirs(dest), [".system", "doc", "lpm-start", "synced"]);
  assert.equal(read(dest, ".system/lpm-roadmap/SKILL.md"), "system");
  assert.equal(read(dest, "synced/lpm-roadmap/SKILL.md"), "synced");
  assert.equal(read(dest, "notes.txt"), "mine");
  assert.ok(fs.existsSync(path.join(path.dirname(dest), "outside", "keep.txt")));
  assert.deepEqual(Object.keys(manifestOf(dest).skills), ["lpm-start"]);

  // install --prune does the same in one step.
  assert.equal((await t.run(install, { agent: "codex", all: true })).exitCode, 0);
  const ip = await t.run(install, { agent: "codex", skills: "lpm-roadmap", prune: true });
  assert.deepEqual(ip.removed, ["lpm-deliver-activity", "lpm-start"]);
  assert.deepEqual(dirs(dest), [".system", "doc", "lpm-roadmap", "synced"]);
});

test("an unmanaged directory with a skill id is a conflict and is left untouched", async () => {
  const t = setup("conflict");
  const dest = codexRoot(t.home);
  write(path.join(dest, "lpm-roadmap", "SKILL.md"), "my own skill");
  const r = await t.run(install, { agent: "codex" });
  assert.equal(r.exitCode, 1);
  assert.equal(r.problems[0].kind, "conflict");
  assert.equal(read(dest, "lpm-roadmap/SKILL.md"), "my own skill");
  assert.ok(!("lpm-roadmap" in manifestOf(dest).skills));
  assert.deepEqual(r.written, ["lpm-deliver-activity", "lpm-start"]);
});

test("--adopt-legacy removes only legacy-shaped bundles and replaces a v2 id in place", async () => {
  const t = setup("legacy");
  // Make lpm-start a legacy id too, like lpm-workspace-admin in the real catalog.
  const idsPath = path.join(t.root, "catalog", "legacy-ids.json");
  const ids = JSON.parse(fs.readFileSync(idsPath, "utf8"));
  ids.legacy.push({ id: "lpm-start", primary: "lpm-start", skills: ["lpm-start"] });
  fs.writeFileSync(idsPath, JSON.stringify(ids));

  const dest = codexRoot(t.home);
  legacySkill(path.join(dest, "software-project-orchestrator"), "software-project-orchestrator");
  legacySkill(path.join(dest, "lpm-start"), "lpm-start");
  write(path.join(dest, "lpm-start", "references", "old.md"), "old");
  legacySkill(path.join(dest, ".system", "software-project-orchestrator"), "software-project-orchestrator");

  // Without --adopt-legacy: the in-place id is a conflict, the other legacy dir is reported.
  const before = await t.run(install, { agent: "codex" });
  assert.equal(before.exitCode, 1);
  assert.deepEqual(before.legacyPresent, ["software-project-orchestrator"]);
  assert.equal(before.problems.find((p) => p.id === "lpm-start").kind, "conflict");
  assert.match(t.out(), /--adopt-legacy/);
  const v = await t.run(verify, { agent: "codex" });
  assert.ok(v.problems.some((p) => p.kind === "legacy" && p.id === "software-project-orchestrator"));

  t.clear();
  const after = await t.run(install, { agent: "codex", "adopt-legacy": true });
  assert.equal(after.exitCode, 0, t.out());
  assert.deepEqual(after.removed, ["software-project-orchestrator"]);
  assert.match(t.out(), /removed legacy .*software-project-orchestrator/);
  assert.match(t.out(), /replacing legacy lpm-start in place/);
  assert.deepEqual(listFiles(path.join(dest, "lpm-start")), listFiles(path.join(t.root, "dist/codex/lpm-start")));
  assert.ok(fs.existsSync(path.join(dest, ".system", "software-project-orchestrator", "SKILL.md")));
  assert.equal((await t.run(verify, { agent: "codex" })).exitCode, 0, t.out());
});

test("the legacy shape check keeps directories that do not match", async () => {
  const t = setup("legacy-shape");
  const ag = path.join(t.home, ".gemini", "config", "skills");
  write(path.join(ag, "software-project-orchestrator", "manifest.json"), "{}");
  write(path.join(ag, "software-project-orchestrator", "PLAYBOOK.md"), "# p");
  assert.ok(isLegacyBundle(path.join(ag, "software-project-orchestrator"), "software-project-orchestrator"));
  const a = await t.run(install, { agent: "antigravity", "adopt-legacy": true });
  assert.equal(a.exitCode, 0, t.out());
  assert.deepEqual(a.removed, ["software-project-orchestrator"]);

  const cc = path.join(t.home, ".claude", "skills");
  legacySkill(path.join(cc, "software-project-orchestrator"), "someone-else");
  assert.ok(!isLegacyBundle(path.join(cc, "software-project-orchestrator"), "software-project-orchestrator"));
  t.clear();
  const c = await t.run(install, { agent: "claude-code", "adopt-legacy": true });
  assert.equal(c.exitCode, 0, t.out());
  assert.deepEqual(c.removed, []);
  assert.match(t.out(), /kept .*software-project-orchestrator: it does not match the legacy bundle shape/);
  assert.ok(fs.existsSync(path.join(cc, "software-project-orchestrator", "SKILL.md")));
});

test("the internal pack installs only at user scope", async () => {
  const t = setup("internal");
  const repo = path.join(t.home, "repo");
  gitInit(repo);
  write(path.join(repo, ".gitignore"), ".claude/\n.agents/\n");
  for (const flags of [{ "include-internal": true }, { profile: "internal" }, { skills: "lpm-start,lpm-release-product" }]) {
    const r = await t.run(install, { agent: "claude-code", scope: "project", ...flags }, { cwd: repo });
    assert.equal(r.exitCode, 2, JSON.stringify(flags));
    assert.match(r.error, /internal pack .* only with --scope user/);
  }
  assert.ok(!fs.existsSync(path.join(repo, ".claude")));
  const u = await t.run(install, { agent: "claude-code", "include-internal": true });
  assert.equal(u.exitCode, 0, t.out());
  assert.deepEqual(dirs(path.join(t.home, ".claude", "skills")), [...CORE, "lpm-release-product"].sort());
});

test("project scope: refuses lpm checkouts, file ancestors (lpm/.codex) and non-ignored destinations", async () => {
  const t = setup("project");
  // An lpm checkout by origin.
  const lpm = path.join(t.home, "lpm");
  gitInit(lpm);
  spawnSync("git", ["-C", lpm, "remote", "add", "origin", "git@github.com:andrevilas/lpm.git"]);
  write(path.join(lpm, ".gitignore"), ".claude/\n.agents/\n.codex\n");
  const a = await t.run(install, { agent: "claude-code", scope: "project" }, { cwd: lpm });
  assert.equal(a.exitCode, 1);
  assert.match(a.error, /inside the lpm checkout/);
  const b = await t.run(install, { agent: "codex", dest: path.join(lpm, "tools", "skills") });
  assert.match(b.error, /inside the lpm checkout/);
  assert.ok(!fs.existsSync(path.join(lpm, ".claude")) && !fs.existsSync(path.join(lpm, "tools")));

  // An lpm checkout recognised by its marker files, without git.
  const copy = path.join(t.home, "lpm-copy");
  write(path.join(copy, "scripts", "check-mcp-parity.ts"), "");
  write(path.join(copy, "src", "lib", "mcpToolCatalog.ts"), "");
  const c = await t.run(install, { agent: "codex", dest: path.join(copy, ".agents", "skills"), "allow-untracked": true });
  assert.match(c.error, /inside the lpm checkout/);

  // `.codex` as a 0-byte read-only file.
  const proj = path.join(t.home, "proj");
  write(path.join(proj, ".codex"), "");
  fs.chmodSync(path.join(proj, ".codex"), 0o444);
  const d = await t.run(install, { agent: "codex", dest: path.join(proj, ".codex", "skills") });
  assert.equal(d.exitCode, 1);
  assert.match(d.error, /is a file, not a directory/);

  // A normal repo: refused until git check-ignore confirms, or with --allow-untracked.
  const repo = path.join(t.home, "app");
  gitInit(repo);
  const e = await t.run(install, { agent: "claude-code", scope: "project" }, { cwd: repo });
  assert.equal(e.exitCode, 1);
  assert.match(e.error, /git check-ignore/);
  assert.match(e.next, /\.gitignore|--allow-untracked/);
  assert.ok(!fs.existsSync(path.join(repo, ".claude")));
  write(path.join(repo, ".gitignore"), ".claude/\n");
  const f = await t.run(install, { agent: "claude-code", scope: "project" }, { cwd: repo });
  assert.equal(f.exitCode, 0, t.out());
  assert.deepEqual(dirs(path.join(repo, ".claude", "skills")), CORE);
  assert.equal(manifestOf(path.join(repo, ".claude", "skills")).scope, "project");
  const repo2 = path.join(t.home, "app2");
  gitInit(repo2);
  const g = await t.run(install, { agent: "codex", scope: "project", "allow-untracked": true }, { cwd: repo2 });
  assert.equal(g.exitCode, 0, t.out());
  assert.deepEqual(dirs(path.join(repo2, ".agents", "skills")), CORE);

  // Outside git, project scope needs --allow-untracked.
  const plain = path.join(t.home, "plain");
  fs.mkdirSync(plain);
  const h = await t.run(install, { agent: "codex", scope: "project" }, { cwd: plain });
  assert.match(h.error, /not inside a git repository/);
});

test("other refusals: protected folders, generic without --dest, unknown ids, agent mismatch; --dry-run writes nothing", async () => {
  const t = setup("refuse");
  const synced = await t.run(install, { agent: "claude-code", dest: path.join(t.home, ".claude", "skills", "synced") });
  assert.equal(synced.exitCode, 1);
  assert.match(synced.error, /synced\/` is managed by another tool/);
  assert.equal((await t.run(install, { agent: "generic" })).exitCode, 2);
  assert.equal((await t.run(install, { agent: "codex", skills: "lpm-start,nope" })).exitCode, 2);
  const dry = await t.run(install, { agent: "codex", "dry-run": true });
  assert.equal(dry.exitCode, 0);
  assert.deepEqual(dry.written, CORE);
  assert.ok(!fs.existsSync(codexRoot(t.home)));
  const shared = path.join(t.home, "shared-skills");
  assert.equal((await t.run(install, { agent: "codex", dest: shared })).exitCode, 0);
  const mismatch = await t.run(install, { agent: "antigravity", dest: shared });
  assert.equal(mismatch.exitCode, 1);
  assert.match(mismatch.error, /managed for agent codex/);
});

test("external bundles install only with --include-external, only when active, only on native targets", async () => {
  const t = setup("external");
  write(path.join(t.root, "external", "demo", "codex", "demo", "SKILL.md"), "---\nname: demo\n---\n# Demo\n");
  write(path.join(t.root, "external", "demo", "codex", "demo", "agents", "openai.yaml"), "interface: {}\n");
  write(path.join(t.root, "external", "later", "metadata.json"), JSON.stringify({ id: "later", status: "planned" }));
  write(path.join(t.root, "external", "later", "codex", "later", "SKILL.md"), "---\nname: later\n---\n");
  const dest = codexRoot(t.home);
  await t.run(install, { agent: "codex" });
  assert.deepEqual(dirs(dest), CORE);
  t.clear();
  const r = await t.run(install, { agent: "codex", "include-external": true });
  assert.equal(r.exitCode, 0, t.out());
  assert.deepEqual(dirs(dest), [...CORE, "demo"].sort());
  assert.deepEqual(manifestOf(dest).skills.demo.pack, "external");
  assert.equal(manifestOf(dest).skills.demo.version, "abc123");
  assert.match(t.out(), /external later: status planned, not installed/);
  const gen = path.join(t.home, "gen");
  t.clear();
  const g = await t.run(install, { agent: "generic", dest: gen, "include-external": true });
  assert.equal(g.exitCode, 0, t.out());
  assert.ok(!fs.existsSync(path.join(gen, "demo.md")));
  assert.match(t.out(), /native SKILL\.md bundles only/);
});

test("generic install: flat files, shared INDEX.md, include line, idempotent, prunable", async () => {
  const t = setup("generic");
  const dest = path.join(t.home, "gen");
  const r = await t.run(install, { agent: "generic", dest });
  assert.equal(r.exitCode, 0, t.out());
  assert.deepEqual(listFiles(dest), [
    MANIFEST_FILE,
    "AGENTS-snippet.md",
    "INDEX.md",
    ...CORE.flatMap((id) => [`${id}.md`, `${id}.refs.md`, `${id}.tools.md`]),
  ].sort());
  assert.equal(read(dest, "INDEX.md"), read(t.root, "dist/generic/INDEX.md"));
  assert.match(t.out(), /LPM: read `~\/gen\/INDEX\.md` first, then exactly one `<id>\.md`, and the one playbook it names in `<id>\.flows\.md`\./);
  const m = manifestOf(dest);
  assert.deepEqual(Object.keys(m.shared.files), ["AGENTS-snippet.md", "INDEX.md"]);
  assert.deepEqual(Object.keys(m.skills["lpm-start"].files), ["lpm-start.md", "lpm-start.refs.md", "lpm-start.tools.md"]);
  const again = await t.run(install, { agent: "generic", dest });
  assert.deepEqual(again.written, []);
  assert.equal((await t.run(verify, { agent: "generic", dest })).exitCode, 0, t.out());
  const p = await t.run(install, { agent: "generic", dest, skills: "lpm-start", prune: true });
  assert.deepEqual(p.removed, ["lpm-deliver-activity", "lpm-roadmap"]);
  assert.deepEqual(listFiles(dest), [MANIFEST_FILE, "AGENTS-snippet.md", "INDEX.md", "lpm-start.md", "lpm-start.refs.md", "lpm-start.tools.md"]);
});

test("verify aggregates every problem with exactly one next action each", async () => {
  const t = setup("verify");
  const dest = codexRoot(t.home);
  assert.equal((await t.run(install, { agent: "codex" })).exitCode, 0);
  assert.equal((await t.run(verify, { agent: "codex" })).exitCode, 0);

  fs.rmSync(path.join(dest, "lpm-roadmap"), { recursive: true }); // missing
  fs.appendFileSync(path.join(dest, "lpm-start", "SKILL.md"), "edited\n"); // modified
  write(path.join(dest, "lpm-start", "extra.md"), "x"); // modified (unexpected file)
  fs.appendFileSync(path.join(t.root, "dist/codex/lpm-deliver-activity/SKILL.md"), "\nnew\n"); // outdated
  legacySkill(path.join(dest, "software-project-orchestrator"), "software-project-orchestrator"); // legacy
  const m = manifestOf(dest);
  m.skills["lpm-gone"] = { version: "1.0.0", pack: "core", files: {} }; // orphaned
  fs.writeFileSync(path.join(dest, MANIFEST_FILE), JSON.stringify(m));
  write(path.join(dest, ".tmp-lpm-start-4242", "SKILL.md"), "x"); // leftover

  t.clear();
  const v = await t.run(verify, { agent: "codex" });
  assert.equal(v.exitCode, 1);
  const kinds = v.problems.map((p) => `${p.kind}:${p.id || ""}`).sort();
  assert.deepEqual(kinds, [
    "leftover:",
    "legacy:software-project-orchestrator",
    "missing:lpm-roadmap",
    "modified:lpm-start",
    "orphaned:lpm-gone",
    "outdated:lpm-deliver-activity",
  ]);
  assert.match(v.problems.find((p) => p.kind === "modified").message, /SKILL\.md changed.*extra\.md unexpected|extra\.md unexpected.*SKILL\.md changed/);
  const nextLines = t.lines.filter((l) => /^\s+next: /.test(l));
  assert.equal(nextLines.length, v.problems.length);

  // update repairs everything it owns; the legacy dir needs --adopt-legacy.
  await t.run(update, { agent: "codex", "adopt-legacy": true });
  const v2 = await t.run(verify, { agent: "codex" });
  assert.equal(v2.exitCode, 0, t.out());
});

test("verify --scope project reads roots from install-targets.json and aggregates across them", async () => {
  const t = setup("verify-targets");
  const a = path.join(t.home, "a");
  const b = path.join(t.home, "b");
  for (const r of [a, b]) {
    gitInit(r);
    write(path.join(r, ".gitignore"), ".claude/\n");
  }
  assert.equal((await t.run(install, { agent: "claude-code", scope: "project" }, { cwd: a })).exitCode, 0, t.out());
  write(path.join(t.root, "install-targets.json"), JSON.stringify({ projects: [a, { path: b, agents: ["claude-code"] }, { path: "/nowhere", agents: ["codex"] }] }));
  const v = await t.run(verify, { agent: "claude-code", scope: "project" });
  assert.equal(v.exitCode, 1);
  assert.equal(v.dests.length, 2);
  assert.deepEqual(v.problems.map((p) => [p.kind, p.dest]), [["not-installed", path.join(b, ".claude", "skills")]]);
});

test("doctor lists MCP server names only, never values, with one next action per problem", async () => {
  const t = setup("doctor");
  const secrets = ["sk-secret-value-123", "lpm_mcp_SECRETSECRET", "ghp_supersecret", "topsecret", "person@example.invalid", "https://example.invalid", "LPM_KEY_VALUE_XYZ"];
  t.env.LPM_API_KEY = "LPM_KEY_VALUE_XYZ";
  write(
    path.join(t.home, ".codex", "config.toml"),
    [
      "[mcp_servers.LPM]",
      'url = "https://lpm.rocks/mcp"',
      'env_http_headers = { "x-api-key" = "LPM_API_KEY" }',
      "",
      "[mcp_servers.other.env]",
      'TOKEN = "sk-secret-value-123"',
      "",
    ].join("\n"),
  );
  write(
    path.join(t.home, ".claude.json"),
    JSON.stringify({
      oauthAccount: { emailAddress: "person@example.invalid" },
      mcpServers: {
        lpm: { type: "http", url: "https://lpm.rocks/mcp", headers: { "x-api-key": "lpm_mcp_SECRETSECRET" } },
        github: { env: { GITHUB_TOKEN: "ghp_supersecret" } },
      },
    }),
  );
  write(
    path.join(t.home, ".gemini", "config", "mcp_config.json"),
    JSON.stringify({ mcpServers: { "xpory-governance": { serverUrl: "https://example.invalid", headers: { Authorization: "Bearer topsecret" } } } }),
  );
  assert.equal((await t.run(install, { agent: "antigravity" })).exitCode, 0);
  assert.equal((await t.run(install, { agent: "claude-code" })).exitCode, 0);
  t.clear();
  const d = await t.run(doctor, {});
  const out = t.out();
  for (const s of secrets) assert.ok(!out.includes(s), `doctor printed ${s}`);
  assert.match(out, /MCP servers: LPM, other/);
  assert.match(out, /MCP servers: github, lpm/);
  assert.match(out, /MCP servers: xpory-governance/);
  assert.equal(d.exitCode, 1);
  assert.deepEqual(
    d.problems.map((p) => `${p.agent}: ${p.message}`),
    [
      "codex: an LPM MCP server is configured but no LPM skills are installed",
      "antigravity: skills are installed but no LPM MCP server is configured",
    ],
  );
  const problemLines = t.lines.filter((l) => /^\s+problem: /.test(l));
  const nextLines = t.lines.filter((l) => /^\s+next: /.test(l));
  assert.equal(problemLines.length, 2);
  assert.equal(nextLines.length, 2);
  assert.match(nextLines[1], /agy mcp add .*lpm https:\/\/lpm\.rocks\/mcp/);

  // A config that cannot be parsed is reported without its contents.
  fs.writeFileSync(path.join(t.home, ".claude.json"), '{"mcpServers": {"x": "ghp_supersecret"');
  t.clear();
  const e = await t.run(doctor, { agent: "claude-code" });
  assert.ok(!t.out().includes("ghp_supersecret"));
  assert.match(e.problems[0].message, /could not be parsed/);
});

test("doctor: Claude Code without a local LPM server is a note (claude.ai connector), not a problem", async () => {
  const t = setup("doctor-connector");
  write(path.join(t.home, ".claude.json"), JSON.stringify({ mcpServers: { github: { command: "gh" } } }));
  assert.equal((await t.run(install, { agent: "claude-code" })).exitCode, 0);
  t.clear();
  const d = await t.run(doctor, { agent: "claude-code" });
  assert.equal(d.exitCode, 0);
  assert.deepEqual(d.problems, []);
  assert.match(t.out(), /note: no local LPM MCP server; fine if the claude\.ai LPM connector is enabled/);
});

test("helpers: lpm origin detection and Codex TOML server names", () => {
  for (const url of ["git@github.com:andrevilas/lpm.git", "https://github.com/andrevilas/lpm", "https://github.com/x/lpm.git/"]) assert.ok(isLpmOrigin(url), url);
  for (const url of ["git@github.com:andrevilas/agents-skills.git", "https://github.com/x/lpm-tools.git", ""]) assert.ok(!isLpmOrigin(url), url);
  const r = codexServerNames('[mcp_servers]\nfoo = { url = "https://lpm.rocks/mcp" }\n[mcp_servers."my server"]\ncommand = "x"\n# [mcp_servers.commented]\n');
  assert.deepEqual(r.names, ["foo", "my server"]);
  assert.deepEqual(r.lpm, ["foo"]);
});

test("the CLI dispatches install and verify with a temporary HOME", () => {
  const root = fixtureCopy("cli");
  runBuild(root);
  const home = tempDir("cli-home");
  const env = { HOME: home, PATH: process.env.PATH };
  const cli = (...a) => spawnSync(process.execPath, [path.join(SCRIPTS, "skills.mjs"), ...a, "--root", root], { encoding: "utf8", env, cwd: home });
  const i = cli("install", "--agent", "claude-code");
  assert.equal(i.status, 0, i.stderr);
  assert.match(i.stdout, /install claude-code\/user → ~\/\.claude\/skills: 3 selected · 3 written/);
  const v = cli("verify", "--agent", "claude-code");
  assert.equal(v.status, 0, v.stderr);
  const bad = cli("install", "--agent", "claude-code", "--scope", "project", "--include-internal");
  assert.equal(bad.status, 2);
  assert.ok(!fs.existsSync(path.join(home, ".codex")));
});
