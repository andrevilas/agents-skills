// loadModel(root): reads every committed source of agents-skills v2 (§3.1) into one
// plain-object model. It is tolerant: missing or malformed files become warnings,
// never exceptions, so the build keeps working while other authors are still writing.
// See scripts/lib/API.md for the full shape.

import path from "node:path";
import {
  compareStrings,
  isDir,
  listDir,
  readJson,
  readText,
  sortStrings,
  uniqSorted,
} from "./fs.mjs";

export const TARGETS = ["codex", "claude-code", "antigravity", "generic"];
export const NATIVE_TARGETS = ["codex", "claude-code", "antigravity"];
export const BASE_SHARED_REFS = [
  "connection-and-access",
  "ids-and-sources",
  "authority-and-owner-decisions",
  "security-and-untrusted-text",
];
export const ENDPOINT = "https://lpm.rocks/mcp";
export const SOURCE_REPO = "andrevilas/agents-skills";

const AUTHORITY_LETTER = {
  autonomous: "A",
  "confirm-with-user": "C",
  confirm: "C",
  "owner-only": "O",
  owner: "O",
  a: "A",
  c: "C",
  o: "O",
};
const AUTHORITY_RANK = { A: 0, C: 1, O: 2 };

/** Maps a card/override authority word or letter to "A" | "C" | "O" | null. */
export function authorityLetter(value) {
  if (value === undefined || value === null) return null;
  const key = String(value).trim().replace(/^\[|\]$/g, "").toLowerCase();
  return AUTHORITY_LETTER[key] || null;
}

/** Stricter of two authority letters. */
export function stricterAuthority(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return AUTHORITY_RANK[b] > AUTHORITY_RANK[a] ? b : a;
}

const asArray = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const asStringArray = (v) => asArray(v).filter((x) => typeof x === "string");

/** Extracts the first array found under one of `keys` (or the value itself when it is an array). */
function pickArray(value, keys) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const k of keys) if (Array.isArray(value[k])) return value[k];
  }
  return null;
}

// ─── Markdown helpers shared with render/validate ──────────────────────────────

/** Body lines of the `## Summary` section (until the next `#`/`##` heading), trimmed. */
export function extractSummary(markdown) {
  if (!markdown) return null;
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^##\s+Summary\s*$/i.test(l));
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join("\n");
}

/** Value of a `Label: value` line (e.g. "Load when:", "Owner skill:"), or null. */
export function extractLine(markdown, label) {
  if (!markdown) return null;
  const re = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(.+)$`, "im");
  const m = markdown.match(re);
  if (!m) return null;
  // "Applies to: x    Source: y" — keep only the first field.
  return m[1].split(/\s{3,}/)[0].trim();
}

// ─── Catalog normalizers ───────────────────────────────────────────────────────

function normalizeGotchas(card) {
  const out = [];
  for (const g of asArray(card.gotchas)) {
    if (typeof g === "string") {
      if (g.trim()) out.push({ text: g.trim(), verifiedFrom: card.verifiedFrom || null });
    } else if (g && typeof g === "object" && g.text) {
      out.push({ text: String(g.text), verifiedFrom: g.verifiedFrom || null });
    }
  }
  return out;
}

/** Normalizes one tool card (scratchpad shape or v2 shape). Unknown fields are kept. */
export function normalizeCard(raw, file) {
  const card = { ...raw };
  card.name = String(raw.name || raw.tool || "");
  card.status = raw.status === "stub" ? "stub" : raw.status || "verified";
  card.purpose = raw.purpose || "";
  card.useWhen = asStringArray(raw.useWhen);
  card.avoidWhen = asStringArray(raw.avoidWhen);
  card.inputs = asArray(raw.inputs)
    .filter((i) => i && typeof i === "object")
    .map((i) => ({
      param: String(i.param || i.name || ""),
      required: Boolean(i.required),
      source: i.source || "",
      notes: i.notes || "",
    }));
  card.preconditions = asStringArray(raw.preconditions);
  card.effect = raw.effect || null;
  card.authority = raw.authority || null;
  card.idempotency = raw.idempotency || null;
  card.returns = raw.returns || "";
  card.pairsWith = asStringArray(raw.pairsWith);
  card.errors = asArray(raw.errors)
    .filter((e) => e && typeof e === "object")
    .map((e) => ({ when: String(e.when || ""), fix: String(e.fix || "") }));
  card.oauthScope = raw.oauthScope === undefined ? null : raw.oauthScope;
  card.cli = raw.cli || null;
  card.gotchas = normalizeGotchas(raw);
  card.file = file;
  return card;
}

function normalizeAliases(value) {
  const list = pickArray(value, ["aliases", "pairs", "entries"]) || [];
  return list
    .filter((a) => a && typeof a === "object")
    .map((a) => ({
      ...a,
      canonical: a.canonical || a.tool || null,
      alias: a.alias || null,
      owner: a.owner || a.ownerSkill || null,
      note: a.note || "",
    }))
    .filter((a) => a.canonical && a.alias)
    .sort((x, y) => compareStrings(x.alias, y.alias));
}

function normalizeOverrides(value) {
  let list = [];
  if (Array.isArray(value)) list = value;
  else if (value && typeof value === "object") {
    for (const k of sortStrings(Object.keys(value))) {
      if (Array.isArray(value[k])) list.push(...value[k].map((e) => ({ group: k, ...e })));
    }
  }
  return list
    .filter((o) => o && typeof o === "object" && (o.tool || o.name))
    .map((o) => ({
      ...o,
      tool: o.tool || o.name,
      decision: o.decision || (o.to ? "raise" : "keep"),
      from: authorityLetter(o.from),
      to: authorityLetter(o.to),
    }));
}

function normalizeLegacyIds(value) {
  const out = [];
  const push = (legacy, target) => {
    if (!legacy) return;
    if (typeof target === "string") out.push({ legacy, skill: target, also: [] });
    else if (Array.isArray(target)) out.push({ legacy, skill: target[0] || null, also: target.slice(1) });
    else if (target && typeof target === "object") {
      out.push({
        legacy,
        skill: target.skill || target.primary || target.to || target.new || null,
        also: asStringArray(target.also || target.secondary),
        ...(target.note ? { note: target.note } : {}),
      });
    }
  };
  const list = pickArray(value, ["legacyIds", "ids", "legacy", "entries"]);
  if (list) {
    for (const e of list) {
      if (typeof e === "string") push(e, null);
      else if (e && typeof e === "object") {
        const legacy = e.legacy || e.legacyId || e.id || e.old || e.from;
        const primary = e.skill || e.primary || e.to || e.new || (Array.isArray(e.skills) ? e.skills[0] : null);
        push(legacy, {
          skill: primary,
          also: e.also || (Array.isArray(e.skills) ? e.skills.filter((x) => x !== primary) : []),
          note: e.note,
        });
      }
    }
  } else if (value && typeof value === "object") {
    for (const k of Object.keys(value)) if (k !== "$comment" && k !== "schemaVersion") push(k, value[k]);
  }
  return out.filter((e) => e.legacy).sort((a, b) => compareStrings(a.legacy, b.legacy));
}

function normalizeSkillManifest(raw, id) {
  const m = { ...raw };
  m.id = raw.id || id;
  m.title = raw.title || raw.name || m.id;
  m.version = raw.version || "0.0.0";
  m.pack = raw.pack || "core";
  m.kind = raw.kind || "tools";
  m.invocation = raw.invocation || "implicit";
  m.description = raw.description || "";
  m.doneWhen = raw.doneWhen || "";
  m.authorityCeiling = raw.authorityCeiling || "";
  m.jobs = asStringArray(raw.jobs);
  m.routing = asArray(raw.routing).filter((r) => r && typeof r === "object");
  m.notFor = asArray(raw.notFor).filter((r) => r && typeof r === "object");
  m.owns = asStringArray(raw.owns);
  m.uses = asStringArray(raw.uses);
  m.cli = asStringArray(raw.cli);
  m.sharedRefs = asArray(raw.sharedRefs)
    .map((r) => (typeof r === "string" ? { name: r } : r))
    .filter((r) => r && typeof r === "object" && r.name)
    .map((r) => ({ ...r, name: refName(r.name) }));
  m.references = asArray(raw.references)
    .map((r) => (typeof r === "string" ? { file: r } : r))
    .filter((r) => r && typeof r === "object" && r.file);
  m.behaviorContracts = asStringArray(raw.behaviorContracts);
  m.codex = raw.codex && typeof raw.codex === "object" ? raw.codex : {};
  return m;
}

/** Canonical reference name: strips directories (`shared/`, `internal/`, `references/`) and `.md`. */
export function refName(name) {
  return String(name).replace(/^.*\//, "").replace(/\.md$/i, "").split("#")[0];
}

/** A skills/<dir> is a v2 skill when it has SKILL.src.md or a v2-shaped skill.json. */
function isV2Manifest(raw) {
  return Boolean(raw && (raw.pack || raw.kind || raw.routing || raw.owns || raw.doneWhen));
}

// ─── loadModel ─────────────────────────────────────────────────────────────────

/**
 * Loads the whole source model of the repository at `root`.
 * @returns {object} model — see API.md ("Model shape").
 */
export function loadModel(root) {
  const abs = (...p) => path.join(root, ...p);
  const warnings = [];
  const warn = (code, message, file = null) => warnings.push({ code, message, ...(file ? { file } : {}) });

  const json = (rel, { optional = false } = {}) => {
    const r = readJson(abs(rel));
    if (r.missing) {
      if (!optional) warn("missing-source", `${rel} is missing`, rel);
      return null;
    }
    if (r.error) {
      warn("invalid-json", `${rel}: ${r.error}`, rel);
      return null;
    }
    return r.value;
  };

  // Catalog: snapshot -----------------------------------------------------------
  const snapshotRaw = json("catalog/lpm-tools.snapshot.json");
  let snapshot = null;
  if (snapshotRaw) {
    const tools = pickArray(snapshotRaw, ["tools"]);
    if (!tools) warn("invalid-snapshot", "catalog/lpm-tools.snapshot.json has no tools[]", "catalog/lpm-tools.snapshot.json");
    snapshot = {
      ...snapshotRaw,
      tools: (tools || [])
        .filter((t) => t && t.name)
        .map((t) => ({
          name: t.name,
          category: t.category || null,
          accessLevel: t.accessLevel || null,
          sensitive: Boolean(t.sensitive),
          oauthScope: t.oauthScope === undefined ? null : t.oauthScope,
          profiles: asStringArray(t.profiles),
          required: asStringArray(t.required),
          params: t.params && typeof t.params === "object" ? t.params : {},
          ...(t.description ? { description: t.description } : {}),
          ...(t.descriptionSha ? { descriptionSha: t.descriptionSha } : {}),
        }))
        .sort((a, b) => compareStrings(a.name, b.name)),
    };
  }
  const cliRaw = json("catalog/lpm-cli.snapshot.json");
  const cliList = pickArray(cliRaw, ["cli", "commands", "keys"]) || pickArray(snapshotRaw, ["cli"]) || [];
  const cli = cliList
    .map((c) => (typeof c === "string" ? { key: c, usage: null } : c && { key: c.key || c.name, usage: c.usage || null }))
    .filter((c) => c && c.key)
    .sort((a, b) => compareStrings(a.key, b.key));
  const meta = json("catalog/snapshot.meta.json");

  // Catalog: cards --------------------------------------------------------------
  const cards = {};
  const cardsDir = "catalog/cards";
  if (!isDir(abs(cardsDir))) warn("missing-source", `${cardsDir}/ is missing`, cardsDir);
  for (const f of listDir(abs(cardsDir)).filter((f) => f.endsWith(".json"))) {
    const rel = `${cardsDir}/${f}`;
    const value = json(rel);
    if (value === null) continue;
    let list = pickArray(value, ["cards", "tools"]);
    if (!list && value && typeof value === "object") {
      list = Object.entries(value)
        .filter(([, v]) => v && typeof v === "object")
        .map(([k, v]) => ({ name: k, ...v }));
    }
    for (const rawCard of list || []) {
      if (!rawCard || typeof rawCard !== "object") continue;
      const card = normalizeCard(rawCard, rel);
      if (!card.name) {
        warn("invalid-card", `${rel}: card without name`, rel);
        continue;
      }
      if (cards[card.name]) warn("duplicate-card", `card ${card.name} defined in ${cards[card.name].file} and ${rel}`, rel);
      card.group = f.replace(/\.json$/, "");
      cards[card.name] = card;
    }
  }

  // Catalog: policy files -------------------------------------------------------
  const aliases = normalizeAliases(json("catalog/aliases.json"));
  const authorityOverrides = normalizeOverrides(json("catalog/authority-overrides.json"));
  const allowlist = json("catalog/allowlist.json");
  const denylist = json("catalog/denylist.json");
  const contractsRaw = json("catalog/contracts.json");
  const contracts = (pickArray(contractsRaw, ["contracts"]) || [])
    .filter((c) => c && c.id)
    .map((c) => ({ ...c, tools: asStringArray(c.tools), phrases: asStringArray(c.phrases) }));
  const policy = {
    schemaDrift: (contractsRaw && contractsRaw.policy && contractsRaw.policy.schemaDrift) || "warn",
  };
  const behaviorContracts = json("catalog/behavior-contracts.json");
  const routingExamplesRaw = json("catalog/routing-examples.json");
  const routingExamples = (pickArray(routingExamplesRaw, ["examples", "entries", "cases"]) || []).filter(
    (e) => e && typeof e === "object",
  );
  const legacyIds = normalizeLegacyIds(json("catalog/legacy-ids.json"));
  const compatRaw = json("catalog/compat.json");
  const compat = {
    see: (compatRaw && compatRaw.see) || null,
    files: (pickArray(compatRaw, ["files", "paths", "entries"]) || [])
      .filter((f) => f && f.path)
      .map((f) => ({ ...f, tools: asStringArray(f.tools), phrases: asStringArray(f.phrases) }))
      .sort((a, b) => compareStrings(a.path, b.path)),
  };
  const cardErrata = json("catalog/card-errata.json");
  const pendingRaw = json("catalog/pending.json", { optional: true });
  const pending = (pickArray(pendingRaw, ["pending", "entries"]) || [])
    .filter((p) => p && p.tool)
    .sort((a, b) => compareStrings(a.tool, b.tool));
  const processRulesRaw = json("catalog/process-rules.json", { optional: true });
  const processRules = (pickArray(processRulesRaw, ["rules", "processRules"]) || []).filter((r) => r && r.rule);

  // Shared ----------------------------------------------------------------------
  const partials = {};
  for (const f of listDir(abs("shared/partials")).filter((f) => f.endsWith(".md"))) {
    partials[f.replace(/\.md$/, "")] = readText(abs("shared/partials", f));
  }
  const sharedRefs = {};
  for (const [dir, internal] of [
    ["shared/references", false],
    ["shared/internal", true],
  ]) {
    for (const f of listDir(abs(dir)).filter((f) => f.endsWith(".md"))) {
      const name = f.replace(/\.md$/, "");
      const content = readText(abs(dir, f));
      if (sharedRefs[name]) {
        warn("duplicate-shared-ref", `shared reference ${name} exists in both shared/references and shared/internal`, `${dir}/${f}`);
        continue;
      }
      sharedRefs[name] = {
        name,
        path: `${dir}/${f}`,
        internal,
        content,
        summary: extractSummary(content),
        loadWhen: extractLine(content, "Load when:"),
        ownerSkill: extractLine(content, "Owner skill:"),
      };
    }
  }
  if (!isDir(abs("shared"))) warn("missing-source", "shared/ is missing", "shared");

  // Skills ----------------------------------------------------------------------
  const skills = [];
  const legacySkillDirs = [];
  for (const dir of listDir(abs("skills"))) {
    if (!isDir(abs("skills", dir))) continue;
    const manifestRel = `skills/${dir}/skill.json`;
    const srcRel = `skills/${dir}/SKILL.src.md`;
    const r = readJson(abs(manifestRel));
    const src = readText(abs(srcRel));
    if (r.missing && src === null) continue; // compat-only directory or empty
    if (r.error) {
      warn("invalid-json", `${manifestRel}: ${r.error}`, manifestRel);
      continue;
    }
    if (!isV2Manifest(r.value) && src === null) {
      legacySkillDirs.push(dir);
      continue;
    }
    if (r.missing) {
      warn("missing-source", `${manifestRel} is missing (SKILL.src.md present)`, manifestRel);
      continue;
    }
    const manifest = normalizeSkillManifest(r.value, dir);
    if (manifest.id !== dir) warn("skill-id-mismatch", `${manifestRel}: id ${manifest.id} != directory ${dir}`, manifestRel);
    if (src === null) warn("missing-source", `${srcRel} is missing; a stub body is rendered`, srcRel);
    const references = [];
    const refDir = `skills/${dir}/references`;
    for (const f of listDir(abs(refDir)).filter((f) => f.endsWith(".md"))) {
      const content = readText(abs(refDir, f));
      const file = `references/${f}`;
      const decl = manifest.references.find((x) => x.file === file || x.file === f);
      references.push({
        name: f.replace(/\.md$/, ""),
        file,
        path: `${refDir}/${f}`,
        content,
        summary: extractSummary(content),
        loadWhen: (decl && decl.loadWhen) || extractLine(content, "Load when:"),
      });
    }
    skills.push({
      id: manifest.id,
      dir,
      manifestPath: manifestRel,
      srcPath: srcRel,
      manifest,
      src,
      references,
    });
  }
  skills.sort((a, b) => compareStrings(a.id, b.id));
  if (legacySkillDirs.length) {
    warn("legacy-skill-dirs", `skipped ${legacySkillDirs.length} legacy skill directories: ${legacySkillDirs.join(", ")}`);
  }
  const skillById = {};
  for (const s of skills) {
    if (skillById[s.id]) warn("duplicate-skill", `skill id ${s.id} defined twice`, s.manifestPath);
    skillById[s.id] = s;
  }

  // External metadata -----------------------------------------------------------
  const external = [];
  for (const dir of listDir(abs("external"))) {
    if (!isDir(abs("external", dir))) continue;
    const r = readJson(abs("external", dir, "metadata.json"));
    if (r.error) warn("invalid-json", `external/${dir}/metadata.json: ${r.error}`);
    external.push({ id: dir, path: `external/${dir}`, metadata: r.value || null });
  }

  const model = {
    root,
    warnings,
    catalog: {
      snapshot,
      cli,
      meta,
      cards,
      aliases,
      authorityOverrides,
      allowlist,
      denylist,
      contracts,
      policy,
      behaviorContracts,
      routingExamples,
      legacyIds,
      compat,
      cardErrata,
      pending,
      processRules,
    },
    shared: { partials, references: sharedRefs },
    skills,
    skillById,
    legacySkillDirs,
    external,
    tools: {},
  };
  model.tools = buildToolIndex(model, warn);
  return model;
}

// ─── Derived tool index ────────────────────────────────────────────────────────

function buildToolIndex(model, warn) {
  const { snapshot, cards, aliases, authorityOverrides } = model.catalog;
  const snapByName = {};
  for (const t of snapshot ? snapshot.tools : []) snapByName[t.name] = t;
  const names = new Set([...Object.keys(snapByName), ...Object.keys(cards)]);
  for (const s of model.skills) for (const t of [...s.manifest.owns, ...s.manifest.uses]) names.add(t);

  const overrideByTool = {};
  for (const o of authorityOverrides) {
    (overrideByTool[o.tool] ||= []).push(o);
  }
  const tools = {};
  for (const name of sortStrings([...names])) {
    const snap = snapByName[name] || null;
    const card = cards[name] || null;
    const cardAuthority = card ? card.authority : null;
    let authority = authorityLetter(cardAuthority);
    for (const o of overrideByTool[name] || []) {
      if (o.decision === "keep") continue;
      if (o.to) authority = stricterAuthority(authority, o.to);
    }
    if (!authority) authority = "C"; // unknown authority renders as confirm-with-user
    const aliasOf = aliases.find((a) => a.alias === name);
    const aliasesOfThis = aliases.filter((a) => a.canonical === name).map((a) => a.alias);
    tools[name] = {
      name,
      snapshot: snap,
      card,
      inSnapshot: Boolean(snap),
      category: (snap && snap.category) || (card && card.group) || null,
      accessLevel: (snap && snap.accessLevel) || null,
      effect: (card && card.effect) || (snap && snap.accessLevel) || null,
      sensitive: snap ? snap.sensitive : false,
      oauthScope: snap ? snap.oauthScope : card ? card.oauthScope : null,
      profiles: snap ? snap.profiles : [],
      required: snap ? snap.required : card ? card.inputs.filter((i) => i.required).map((i) => i.param) : [],
      cardAuthority,
      authority,
      overrides: overrideByTool[name] || [],
      aliasOf: aliasOf ? aliasOf.canonical : null,
      aliases: sortStrings(aliasesOfThis),
      owner: null,
      owners: [],
      usedBy: [],
    };
  }
  for (const s of model.skills) {
    for (const t of s.manifest.owns) tools[t].owners.push(s.id);
    for (const t of s.manifest.uses) tools[t].usedBy.push(s.id);
  }
  for (const t of Object.values(tools)) {
    t.owners = uniqSorted(t.owners);
    t.usedBy = uniqSorted(t.usedBy);
    t.owner = t.owners.length === 1 ? t.owners[0] : t.owners[0] || null;
    if (t.owners.length > 1) warn("duplicate-owner", `${t.name} is owned by ${t.owners.join(", ")}`);
  }
  return tools;
}

// ─── Derived helpers (used by render, coverage and validators) ─────────────────

/** Rendered authority letter of a tool ("A" | "C" | "O"). */
export function renderedAuthority(model, tool) {
  const t = model.tools[tool];
  return t ? t.authority : "C";
}

/** True when the tool is exposed on OAuth connectors. */
export function isOAuth(model, tool) {
  const t = model.tools[tool];
  return Boolean(t && t.oauthScope);
}

/** Tools the skill's access is computed from: owns, or uses for process skills that own nothing. */
export function accessTools(skill) {
  return skill.manifest.owns.length ? skill.manifest.owns : skill.manifest.uses;
}

/**
 * Access class of §2.1: "OAuth ok" | "OAuth mostly" | "mixed" | "mostly KEY" | "KEY" | "process skill".
 */
export function accessClass(model, skill) {
  const owns = skill.manifest.owns;
  if (!owns.length) return "process skill";
  const oauth = owns.filter((t) => isOAuth(model, t)).length;
  const ratio = oauth / owns.length;
  if (ratio === 1) return "OAuth ok";
  if (ratio >= 0.6) return "OAuth mostly";
  if (ratio >= 0.15) return "mixed";
  if (oauth > 0) return "mostly KEY";
  return "KEY";
}

/** {A, C, O} counts of the skill's owned tools (rendered authority). */
export function authorityCounts(model, skill) {
  const counts = { A: 0, C: 0, O: 0 };
  for (const t of skill.manifest.owns) counts[renderedAuthority(model, t)] += 1;
  return counts;
}

/** Profiles ordered by size (number of snapshot tools that include them), excluding "custom". */
export function profileSizes(model) {
  const sizes = {};
  for (const t of Object.values(model.tools)) for (const p of t.profiles) sizes[p] = (sizes[p] || 0) + 1;
  return sizes;
}

/**
 * Profiles an API key can never have: owner-agent profiles belong only to scoped `lpm_mcp_`
 * agent credentials (LPM createApiKey/updateApiKey reject them), plus "custom" (not a preset).
 */
export const NON_KEY_PROFILES = ["custom", "roadmap-owner-advisor", "roadmap-owner-operator"];

/** Smallest API-key preset containing every tool in `tools` ("full" when unknown). */
export function smallestProfile(model, tools) {
  const sizes = profileSizes(model);
  const candidates = Object.keys(sizes)
    .filter((p) => !NON_KEY_PROFILES.includes(p) && !/^roadmap-owner-/.test(p))
    .filter((p) => tools.every((t) => (model.tools[t] ? model.tools[t].profiles.includes(p) : false)))
    .sort((a, b) => sizes[a] - sizes[b] || compareStrings(a, b));
  return candidates[0] || "full";
}

/** Every routing row of every skill, sorted by ascending order, with its skill id. */
export function routingRows(model) {
  const rows = [];
  for (const s of model.skills) {
    for (const r of s.manifest.routing) {
      rows.push({
        ...r,
        skill: s.id,
        pack: s.manifest.pack,
        internal: Boolean(r.internal || s.manifest.pack === "internal"),
        all: asArray(r.all).map((g) => asStringArray(g)),
        unless: asStringArray(r.unless),
      });
    }
  }
  return rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || compareStrings(a.skill, b.skill));
}

/** Collision entries of routing-examples.json (collision: true). */
export function collisionExamples(model) {
  const list = model.catalog.routingExamples.filter((e) => e.collision === true);
  // Stable: entries with an id are sorted by id (codepoint); others keep file order after them.
  const withId = list.filter((e) => typeof e.id === "string").sort((a, b) => compareStrings(a.id, b.id));
  return [...withId, ...list.filter((e) => typeof e.id !== "string")];
}

/** Skills of a pack ("core" | "internal"). */
export function skillsOfPack(model, pack) {
  return model.skills.filter((s) => s.manifest.pack === pack);
}

/**
 * Computed install profiles (§2.1): { core, connector, internal } → sorted skill ids.
 */
export function installProfiles(model) {
  const core = skillsOfPack(model, "core").map((s) => s.id);
  const connector = skillsOfPack(model, "core")
    .filter((s) => s.manifest.owns.some((t) => isOAuth(model, t)))
    .map((s) => s.id);
  const internal = skillsOfPack(model, "internal").map((s) => s.id);
  return { core: sortStrings(core), connector: sortStrings(connector), internal: sortStrings(internal) };
}
