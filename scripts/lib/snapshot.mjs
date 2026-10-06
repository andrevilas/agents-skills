// snapshot.mjs — `skills.mjs snapshot --lpm <dir> [--check] [--json <file>]` (§5.2, §5.4).
// Runs LPM's exporter read-only in the lpm checkout and stores its output in
//   catalog/lpm-tools.snapshot.json   {schemaVersion, tools[], hashes}
//   catalog/lpm-cli.snapshot.json     {schemaVersion, cli[]}  (cli[] = {key, usage[]} when the exporter
//                                     prints `cliUsage` (--include-cli-usage), plain keys otherwise; §3.1)
//   catalog/snapshot.meta.json        {schemaVersion, lpmCommit, lpmDirty, toolCount, cliCount, namesHash, schemaHash, cliHash}
// New tools get "status":"stub" cards in catalog/cards/<category>.json.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { compareStrings, jsonText, readJson, readText, sha256, sortStrings, writeFileDeterministic } from "./fs.mjs";
import { loadModel } from "./model.mjs";

export const SNAPSHOT_FILES = {
  tools: "catalog/lpm-tools.snapshot.json",
  cli: "catalog/lpm-cli.snapshot.json",
  meta: "catalog/snapshot.meta.json",
};
/** Fields of snapshot.meta.json that are informational: `--check` ignores them. */
export const INFORMATIONAL_META = ["lpmCommit", "lpmDirty"];

const sortedLinesHash = (lines) => `sha256:${sha256(sortStrings(lines).map((l) => `${l}\n`).join(""))}`;

const cliKey = (c) => (typeof c === "string" ? c : c && (c.key || c.name));

/**
 * Hashes of §5.4 (each = sha256 of the sorted lines, every line terminated by "\n").
 * @param {Array<{name, category, accessLevel, sensitive, oauthScope, required}>} tools
 * @param {Array<string|{key}>} cli
 */
export function computeHashes(tools, cli = []) {
  const names = tools.map((t) => t.name);
  const schemaLines = tools.map(
    (t) =>
      `${t.name}|${t.category ?? ""}|${t.accessLevel ?? ""}|${t.sensitive ? 1 : 0}|${t.oauthScope || "-"}|${sortStrings(t.required || []).join(",")}`,
  );
  return {
    namesHash: sortedLinesHash(names),
    schemaHash: sortedLinesHash(schemaLines),
    cliHash: sortedLinesHash(cli.map(cliKey).filter(Boolean)),
  };
}

/**
 * Runs `node --import tsx/esm <lpmDir>/scripts/export-mcp-catalog.ts --include-cli-usage` (cwd = lpmDir)
 * and parses its JSON. An exporter that predates `--include-cli-usage` is re-run without it (keys only).
 */
export function runExporter(lpmDir) {
  const script = path.join(lpmDir, "scripts", "export-mcp-catalog.ts");
  if (readText(script) === null) throw new Error(`LPM exporter not found: ${script}`);
  const spawn = (extra) =>
    spawnSync(process.execPath, ["--import", "tsx/esm", script, ...extra], {
      cwd: lpmDir,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  let res = spawn(["--include-cli-usage"]);
  if (!res.error && res.status !== 0 && /Unknown argument: --include-cli-usage/.test(String(res.stderr || ""))) res = spawn([]);
  if (res.error) throw new Error(`exporter failed to start: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`exporter exited ${res.status}: ${String(res.stderr || "").trim().split("\n").slice(-5).join(" | ")}`);
  return parseExporterOutput(res.stdout);
}

/**
 * CLI entries for lpm-cli.snapshot.json: `{key, usage[]}` when the exporter printed `cliUsage`
 * (`{"<key>": ["lpm …"]}`), the plain key otherwise. Object entries already carrying `usage` are kept.
 */
function cliEntries(exported) {
  const raw = Array.isArray(exported.cli) ? exported.cli : [];
  const usage = exported.cliUsage && typeof exported.cliUsage === "object" && !Array.isArray(exported.cliUsage) ? exported.cliUsage : null;
  return raw
    .filter((c) => cliKey(c))
    .map((c) => {
      if (!usage) return c;
      const key = cliKey(c);
      const lines = Array.isArray(usage[key]) ? usage[key].map(String) : typeof c === "object" && Array.isArray(c.usage) ? c.usage : [];
      return { key, usage: lines };
    })
    .sort((a, b) => compareStrings(cliKey(a), cliKey(b)));
}

export function parseExporterOutput(text) {
  const s = String(text || "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("exporter output is not JSON");
  }
}

/**
 * Converts exporter output into the 3 catalog files.
 * @returns {{files: Map<string,string>, warnings: string[], tools: object[]}}
 */
export function snapshotFiles(exported) {
  const warnings = [];
  if (!exported || !Array.isArray(exported.tools)) throw new Error("exporter output has no tools[]");
  const tools = [...exported.tools].filter((t) => t && t.name).sort((a, b) => compareStrings(a.name, b.name));
  const cli = cliEntries(exported);
  const local = computeHashes(tools, cli);
  const hashes = { ...local, ...(exported.hashes || {}) };
  for (const k of Object.keys(local)) {
    if (exported.hashes && exported.hashes[k] && exported.hashes[k] !== local[k]) {
      warnings.push(`${k}: exporter ${exported.hashes[k]} differs from the local §5.4 computation ${local[k]}; the exporter value is stored`);
    }
  }
  const schemaVersion = exported.schemaVersion || 1;
  const files = new Map();
  files.set(SNAPSHOT_FILES.tools, jsonText({ schemaVersion, tools, hashes }));
  files.set(SNAPSHOT_FILES.cli, jsonText({ schemaVersion, cli }));
  files.set(
    SNAPSHOT_FILES.meta,
    jsonText({
      schemaVersion,
      lpmCommit: exported.lpmCommit || null,
      lpmDirty: Boolean(exported.lpmDirty),
      toolCount: tools.length,
      cliCount: cli.length,
      namesHash: hashes.namesHash,
      schemaHash: hashes.schemaHash,
      cliHash: hashes.cliHash,
    }),
  );
  return { files, warnings, tools };
}

/** A "status":"stub" card built from a snapshot tool (fails `check` until filled). */
export function stubCard(tool) {
  const params = tool.params && typeof tool.params === "object" ? tool.params : {};
  const required = new Set(tool.required || []);
  return {
    name: tool.name,
    status: "stub",
    purpose: tool.description || "",
    useWhen: [],
    avoidWhen: [],
    inputs: sortStrings(Object.keys(params)).map((p) => ({
      param: p,
      required: required.has(p),
      source: "",
      notes: String(params[p] || ""),
    })),
    preconditions: [],
    effect: tool.accessLevel || null,
    authority: null,
    idempotency: null,
    returns: "",
    pairsWith: [],
    errors: [],
    oauthScope: tool.oauthScope === undefined ? null : tool.oauthScope,
    cli: null,
    gotchas: [],
  };
}

/**
 * Card files to (re)write so that every snapshot tool without a card gets a stub.
 * Keeps the existing file shape (array, {cards:[]} or {tools:[]}); entries sorted by name.
 * @returns {{files: Map<string,string>, stubs: string[]}}
 */
export function stubCardFiles(root, tools) {
  const model = loadModel(root);
  const missing = tools.filter((t) => !model.catalog.cards[t.name]);
  const byFile = {};
  for (const t of missing) (byFile[`catalog/cards/${t.category || "uncategorized"}.json`] ||= []).push(t);
  const files = new Map();
  for (const rel of sortStrings(Object.keys(byFile))) {
    const current = readJson(path.join(root, rel));
    const value = current.value;
    let list;
    let wrap;
    if (Array.isArray(value)) {
      list = [...value];
      wrap = (l) => l;
    } else if (value && Array.isArray(value.cards)) {
      list = [...value.cards];
      wrap = (l) => ({ ...value, cards: l });
    } else if (value && Array.isArray(value.tools)) {
      list = [...value.tools];
      wrap = (l) => ({ ...value, tools: l });
    } else {
      list = [];
      wrap = (l) => l;
    }
    list.push(...byFile[rel].map(stubCard));
    list.sort((a, b) => compareStrings(a.name, b.name));
    files.set(rel, jsonText(wrap(list)));
  }
  return { files, stubs: sortStrings(missing.map((t) => t.name)) };
}

function stripInformational(text) {
  try {
    const v = JSON.parse(text);
    for (const k of INFORMATIONAL_META) delete v[k];
    return JSON.stringify(v);
  } catch {
    return text;
  }
}

/**
 * Runs the snapshot command.
 * @param {string} root agents-skills root
 * @param {{lpm?: string, json?: string, check?: boolean, log?: object}} opts
 * @returns {{exitCode: number, changed: string[], stubs: string[], warnings: string[]}}
 */
export function runSnapshot(root, opts = {}) {
  const log = opts.log || console;
  let exported;
  if (opts.json) {
    const text = readText(path.resolve(opts.json));
    if (text === null) throw new Error(`--json file not found: ${opts.json}`);
    exported = parseExporterOutput(text);
  } else {
    if (!opts.lpm) throw new Error("snapshot needs --lpm <dir>");
    exported = runExporter(path.resolve(opts.lpm));
  }
  const { files, warnings, tools } = snapshotFiles(exported);
  const stub = stubCardFiles(root, tools);
  const changed = [];
  for (const [rel, content] of files) {
    const current = readText(path.join(root, rel));
    const same =
      rel === SNAPSHOT_FILES.meta && current !== null ? stripInformational(current) === stripInformational(content) : current === content;
    if (!same) changed.push(rel);
  }
  for (const w of warnings) log.warn(`warning: ${w}`);
  if (opts.check) {
    for (const rel of changed) log.error(`snapshot differs: ${rel}`);
    for (const t of stub.stubs) log.error(`tool without a card: ${t}`);
    const exitCode = changed.length || stub.stubs.length ? 1 : 0;
    if (!exitCode) log.info(`snapshot up to date: ${tools.length} tools`);
    return { exitCode, changed, stubs: stub.stubs, warnings };
  }
  for (const [rel, content] of files) writeFileDeterministic(path.join(root, rel), content);
  for (const [rel, content] of stub.files) writeFileDeterministic(path.join(root, rel), content);
  log.info(`snapshot: ${tools.length} tools, ${changed.length} catalog file(s) changed, ${stub.stubs.length} stub card(s)`);
  for (const t of stub.stubs) log.info(`  stub card: ${t} (fill it before \`check\` passes)`);
  return { exitCode: 0, changed, stubs: stub.stubs, warnings };
}
