// snapshot (§5.4) hashes, files and stub cards; CLI dispatcher usage and exit codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fixtureCopy, read, SCRIPTS } from "./helpers.mjs";
import { computeHashes, runSnapshot, snapshotFiles } from "../lib/snapshot.mjs";
import { sha256 } from "../lib/fs.mjs";
import { main, parseArgs } from "../skills.mjs";

const EXPORT = {
  schemaVersion: 1,
  lpmCommit: "abc",
  lpmDirty: false,
  tools: [
    { name: "get_issue", category: "portfolio", accessLevel: "read", sensitive: false, oauthScope: "portfolio:read", profiles: ["full"], required: ["projectId", "issueId"], params: { issueId: "string", projectId: "string" } },
    { name: "brand_new_tool", category: "portfolio", accessLevel: "write", sensitive: true, oauthScope: null, profiles: ["full"], required: ["x"], params: { x: "string" }, description: "Does a new thing." },
  ],
  cli: ["issues get", "auth status"],
};

const silent = { info() {}, warn() {}, error() {} };

test("computeHashes follows §5.4 (sorted lines, LF-terminated)", () => {
  const h = computeHashes(EXPORT.tools, EXPORT.cli);
  assert.equal(h.namesHash, `sha256:${sha256("brand_new_tool\nget_issue\n")}`);
  assert.equal(h.schemaHash, `sha256:${sha256("brand_new_tool|portfolio|write|1|-|x\nget_issue|portfolio|read|0|portfolio:read|issueId,projectId\n")}`);
  assert.equal(h.cliHash, `sha256:${sha256("auth status\nissues get\n")}`);
});

test("snapshotFiles writes tools, cli and meta files sorted, with the hashes", () => {
  const { files } = snapshotFiles(EXPORT);
  const tools = JSON.parse(files.get("catalog/lpm-tools.snapshot.json"));
  assert.deepEqual(tools.tools.map((t) => t.name), ["brand_new_tool", "get_issue"]);
  assert.deepEqual(JSON.parse(files.get("catalog/lpm-cli.snapshot.json")).cli, ["auth status", "issues get"]);
  const meta = JSON.parse(files.get("catalog/snapshot.meta.json"));
  assert.deepEqual(Object.keys(meta), ["schemaVersion", "lpmCommit", "lpmDirty", "toolCount", "cliCount", "namesHash", "schemaHash", "cliHash"]);
  assert.equal(meta.toolCount, 2);
  assert.equal(meta.namesHash, computeHashes(EXPORT.tools).namesHash);
});

test("snapshotFiles keeps CLI usage lines from cliUsage as {key, usage}; cliHash covers keys only", () => {
  const withUsage = { ...EXPORT, cliUsage: { "issues get": ["lpm issues get <id> [--json]"], "auth status": [] } };
  const { files } = snapshotFiles(withUsage);
  assert.deepEqual(JSON.parse(files.get("catalog/lpm-cli.snapshot.json")).cli, [
    { key: "auth status", usage: [] },
    { key: "issues get", usage: ["lpm issues get <id> [--json]"] },
  ]);
  assert.deepEqual(Object.keys(JSON.parse(files.get("catalog/lpm-tools.snapshot.json"))), ["schemaVersion", "tools", "hashes"]);
  assert.equal(JSON.parse(files.get("catalog/snapshot.meta.json")).cliHash, computeHashes(EXPORT.tools, EXPORT.cli).cliHash);
});

test("runSnapshot --json writes the catalog and stub cards; --check then passes except for stubs", () => {
  const root = fixtureCopy("snap");
  const file = path.join(root, "export.json");
  fs.writeFileSync(file, JSON.stringify(EXPORT));
  const res = runSnapshot(root, { json: file, log: silent });
  assert.equal(res.exitCode, 0);
  assert.deepEqual(res.stubs, ["brand_new_tool"]);
  const cards = JSON.parse(read(root, "catalog/cards/portfolio.json"));
  const stub = cards.find((c) => c.name === "brand_new_tool");
  assert.equal(stub.status, "stub");
  assert.equal(stub.purpose, "Does a new thing.");
  assert.deepEqual(cards.map((c) => c.name), [...cards.map((c) => c.name)].sort(), "card file sorted by name");
  // stub exists now → --check sees no differences; lpmCommit is informational only
  const again = runSnapshot(root, { json: file, check: true, log: silent });
  assert.equal(again.exitCode, 0);
  fs.writeFileSync(file, JSON.stringify({ ...EXPORT, lpmCommit: "other", lpmDirty: true }));
  assert.equal(runSnapshot(root, { json: file, check: true, log: silent }).exitCode, 0);
  fs.writeFileSync(file, JSON.stringify({ ...EXPORT, tools: [...EXPORT.tools, { ...EXPORT.tools[0], name: "another_tool" }] }));
  const drift = runSnapshot(root, { json: file, check: true, log: silent });
  assert.equal(drift.exitCode, 1);
  assert.ok(drift.changed.includes("catalog/lpm-tools.snapshot.json"));
  assert.deepEqual(drift.stubs, ["another_tool"]);
});

test("parseArgs validates commands and flags", () => {
  assert.deepEqual(parseArgs(["build", "--skills", "a,b"]), { command: "build", args: [], flags: { skills: "a,b" } });
  assert.deepEqual(parseArgs(["snapshot", "--lpm=../lpm", "--check"]).flags, { lpm: "../lpm", check: true });
  assert.equal(parseArgs(["eval", "--trace", "deliver-close"]).flags.trace, "deliver-close");
  assert.throws(() => parseArgs(["bogus"]), /unknown command/);
  assert.throws(() => parseArgs(["build", "--nope"]), /unknown flag/);
  assert.throws(() => parseArgs(["build", "--skills"]), /needs a value/);
  assert.equal(parseArgs(["install", "--agent", "codex", "--whatever", "x"]).flags.whatever, "x", "delegated commands pass flags through");
});

test("CLI exit codes: 0 ok, 1 failure, 2 usage", async () => {
  const quiet = (fn) => async () => {
    const [l, e] = [console.log, console.error];
    console.log = console.error = () => {};
    try {
      return await fn();
    } finally {
      console.log = l;
      console.error = e;
    }
  };
  const root = fixtureCopy("cli");
  assert.equal(await quiet(() => main(["build", "--root", root]))(), 0);
  assert.ok(fs.existsSync(path.join(root, "catalog/coverage.json")));
  assert.equal(await quiet(() => main(["nope"]))(), 2);
  assert.equal(await quiet(() => main(["snapshot", "--root", root]))(), 2, "snapshot needs --lpm");
  assert.equal(await quiet(() => main(["eval", "--root", root]))(), 2, "eval needs a mode");
  assert.equal(await quiet(() => main(["eval", "--router", "--trace", "x", "--root", root]))(), 2);
  assert.equal(await quiet(() => main(["install", "--root", root]))(), 2, "install needs --agent");
  assert.equal(await quiet(() => main(["install", "--agent", "vim", "--root", root]))(), 2);
  assert.equal(await quiet(() => main(["install", "--agent", "codex", "--profile", "core", "--all", "--root", root]))(), 2);
  assert.equal(await quiet(() => main(["new", "--root", root]))(), 2);
  assert.equal(await quiet(() => main(["new", "Bad_Id", "--root", root]))(), 2);
  assert.equal(await quiet(() => main(["snapshot", "--lpm", path.join(root, "no-lpm"), "--root", root]))(), 1, "missing exporter fails");
  assert.equal(await quiet(() => main(["--help"]))(), 0);
});

test("the CLI runs as a script", () => {
  const root = fixtureCopy("cli-proc");
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, "skills.mjs"), "build", "--root", root], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^build: 4 skills · \d+ written · 0 unchanged · 0 removed · \d+ warnings$/m);
  const u = spawnSync(process.execPath, [path.join(SCRIPTS, "skills.mjs"), "frobnicate"], { encoding: "utf8" });
  assert.equal(u.status, 2);
});
