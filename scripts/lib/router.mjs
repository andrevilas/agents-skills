// agents-skills v2 router: the §5.2 deterministic matcher, E1 `eval --router` and E2 `eval --triggers` (§5.7).
// Zero dependencies, Node >= 20 ESM, no network and no model calls. See scripts/lib/API.md ("Router").
//
// Matcher (§5.2):
//   1. normalize: lowercase, NFD, drop combining marks; tokens = /[a-z0-9_]+([.-][a-z0-9_]+)*/g
//   2. terms are normalized the same way; a multi-word term matches consecutive tokens; a word ending
//      in `*` is a prefix on its last token; a term never matches a substring of a token
//   3. row = { order, all: [[term, …], …] (AND of OR-lists), unless: [term, …] }
//   4. a row matches when every group has ≥1 hit and no `unless` term hits
//   5. rows are tried by ascending `order` across all skills; first match wins; else the fallback row

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareStrings } from "./fs.mjs";
import { loadModel, routingRows } from "./model.mjs";

export const TOKEN_RE = /[a-z0-9_]+(?:[.-][a-z0-9_]+)*/g;
export const ROUTER_GATE = 100; // percent, E1
export const TRIGGERS_GATE = 95; // percent top-1, E2
export const FALLBACK_FIRST_CALL = "search_help_articles";

// ─── Normalization ─────────────────────────────────────────────────────────────

/** Lowercase, Unicode NFD, combining marks removed ("Decisão" → "decisao"). */
export function normalizeRequest(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Tokens of a request (§5.2 step 1). `lpm-activity`, `lpm.rocks`, `no_active_index` stay single tokens. */
export function tokenize(text) {
  return normalizeRequest(text).match(TOKEN_RE) || [];
}

/**
 * Compiles a term into `[{ t, prefix }]`. Every whitespace-separated word is normalized like a
 * request; a word ending in `*` makes the last token of that word a prefix ("change set*",
 * "artefato* de entrega"). Returns `[]` when nothing survives normalization (V16 reports those).
 */
export function compileTerm(term) {
  const out = [];
  for (const word of String(term ?? "").trim().split(/\s+/)) {
    if (!word) continue;
    const prefix = /\*+$/.test(word);
    const toks = tokenize(word.replace(/\*+$/, ""));
    toks.forEach((t, i) => out.push({ t, prefix: prefix && i === toks.length - 1 }));
  }
  return out;
}

/** True when the compiled term appears as consecutive tokens (whole tokens, or a prefix where marked). */
export function termMatches(compiled, tokens) {
  const k = compiled.length;
  if (!k) return false;
  for (let i = 0; i + k <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < k; j++) {
      const { t, prefix } = compiled[j];
      const tok = tokens[i + j];
      if (prefix ? !tok.startsWith(t) : tok !== t) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// ─── Rows ──────────────────────────────────────────────────────────────────────

const compiledRows = new WeakMap();

function asList(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function compileRow(row) {
  let c = compiledRows.get(row);
  if (!c) {
    const groups = asList(row.all).map((g) => asList(g).map((term) => ({ term: String(term), c: compileTerm(term) })));
    const unless = asList(row.unless).map((term) => ({ term: String(term), c: compileTerm(term) }));
    c = { groups, unless };
    compiledRows.set(row, c);
  }
  return c;
}

/**
 * Evaluates one row against tokens. Returns
 * `{ matched, hits: (term|null)[] per group, blockedBy: term|null, missingGroups: number[] (0-based) }`.
 * A non-fallback row with no groups never matches (a broken row must not swallow every request).
 */
export function evaluateRow(row, tokens) {
  if (row.fallback) return { matched: true, hits: [], blockedBy: null, missingGroups: [] };
  const { groups, unless } = compileRow(row);
  const hits = groups.map((g) => {
    const hit = g.find((x) => termMatches(x.c, tokens));
    return hit ? hit.term : null;
  });
  const missingGroups = hits.map((h, i) => (h === null ? i : -1)).filter((i) => i >= 0);
  const blocked = unless.find((x) => termMatches(x.c, tokens));
  const blockedBy = blocked ? blocked.term : null;
  const matched = groups.length > 0 && missingGroups.length === 0 && blockedBy === null;
  return { matched, hits, blockedBy, missingGroups };
}

function rowSortKey(a, b) {
  return (
    (Number(a.order) || 0) - (Number(b.order) || 0) ||
    Number(Boolean(a.fallback)) - Number(Boolean(b.fallback)) ||
    compareStrings(a.skill ?? "", b.skill ?? "") ||
    compareStrings(a.legacy ?? "", b.legacy ?? "")
  );
}

/** Rows sorted by ascending order (stable tie-break: fallback last, then skill id, then legacy id). */
export function sortRows(rows) {
  return [...rows].sort(rowSortKey);
}

/**
 * Runs the §5.2 matcher. `rows` are routing rows (`{order, skill, all, unless, …}`; a row with
 * `fallback: true` always matches). Returns
 * `{ skill, order, row, fallback, hits, tokens }`. When nothing matches and no fallback row is given,
 * `row`/`order`/`skill` are null and `fallback` is true.
 */
export function matchRequest(rows, text) {
  const tokens = tokenize(text);
  for (const row of sortRows(rows)) {
    const r = evaluateRow(row, tokens);
    if (r.matched) {
      return { skill: row.skill ?? null, order: row.order ?? null, row, fallback: Boolean(row.fallback), hits: r.hits, tokens };
    }
  }
  return { skill: null, order: null, row: null, fallback: true, hits: [], tokens };
}

/**
 * The full router table of a model: every `skill.json.routing[]` row, then one legacy row per
 * `catalog/legacy-ids.json` entry (order = max row order + 1, as `route.md` renders it), then the
 * fallback row (`search_help_articles`, then ask).
 */
export function routerTable(model) {
  const rows = routingRows(model).map((r) => ({ ...r }));
  let maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
  const legacy = (model.catalog && model.catalog.legacyIds) || [];
  if (legacy.length) {
    maxOrder += 1;
    for (const l of legacy) {
      rows.push({
        order: maxOrder,
        skill: l.skill,
        legacy: l.legacy,
        all: [[l.legacy]],
        unless: [],
        firstCall: l.skill ? `load ${l.skill}` : null,
      });
    }
  }
  rows.push({ order: maxOrder + 1, skill: null, fallback: true, all: [], unless: [], firstCall: FALLBACK_FIRST_CALL });
  return sortRows(rows);
}

// ─── E1: eval --router ─────────────────────────────────────────────────────────

function parseDecidedBy(v) {
  if (v === undefined || v === null || v === "") return null;
  const list = Array.isArray(v) ? v : [v];
  const nums = [];
  for (const x of list) {
    if (typeof x === "number") nums.push(x);
    else for (const m of String(x).match(/\d+/g) || []) nums.push(Number(m));
  }
  return nums.length ? [...new Set(nums)].sort((a, b) => a - b) : null;
}

function isNoneExpected(expected) {
  return expected === null || expected === "none" || expected === "fallback";
}

/** Expands `routingExamples` entries into one case per prompt variant (EN/PT arrays → 2 cases). */
export function routerCases(examples) {
  const cases = [];
  (examples || []).forEach((e, index) => {
    const prompts = asList(e.prompt).filter((p) => typeof p === "string" && p.trim());
    const langs = asList(e.lang);
    const baseId = typeof e.id === "string" ? e.id : `#${index}`;
    prompts.forEach((prompt, i) => {
      const suffix = prompts.length > 1 ? `[${typeof langs[i] === "string" ? langs[i] : i}]` : "";
      cases.push({
        id: `${baseId}${suffix}`,
        prompt,
        expected: e.expected === undefined ? null : e.expected,
        decidedBy: parseDecidedBy(e.decidedBy),
        collision: e.collision === true,
        kind: e.kind || null,
      });
    });
  });
  return cases;
}

function rowLabel(row) {
  if (!row) return "none";
  if (row.fallback) return `row ${row.order} (nothing matches → ${FALLBACK_FIRST_CALL})`;
  if (row.legacy) return `row ${row.order} \`${row.skill}\` (legacy id ${row.legacy})`;
  return `row ${row.order} \`${row.skill}\``;
}

function explainRow(row, tokens, winner) {
  const r = evaluateRow(row, tokens);
  let why;
  if (r.matched) why = winner && winner !== row ? `matches, but ${rowLabel(winner)} comes first` : "matches";
  else if (!compileRow(row).groups.length) why = "has no match groups";
  else {
    const parts = [];
    if (r.missingGroups.length) {
      const groups = compileRow(row).groups;
      parts.push(
        r.missingGroups
          .map((i) => `group ${i + 1} [${groups[i].map((x) => x.term).join(", ")}] has no hit`)
          .join("; "),
      );
    }
    if (r.blockedBy !== null) parts.push(`unless "${r.blockedBy}" blocks it`);
    why = parts.join("; ");
  }
  return { order: row.order ?? null, skill: row.skill ?? null, label: rowLabel(row), matched: r.matched, why };
}

/** Pure E1 run over a model. Returns `{ ok, total, passed, failed, score, gate, misses, results }`. */
export function runRouterEval(model) {
  const table = routerTable(model);
  const cases = routerCases(model.catalog ? model.catalog.routingExamples : []);
  const results = [];
  const misses = [];
  for (const c of cases) {
    const m = matchRequest(table, c.prompt);
    const skillOk = isNoneExpected(c.expected) ? m.fallback : m.skill === c.expected;
    const rowOk = !c.decidedBy || c.decidedBy.includes(m.order);
    const pass = skillOk && rowOk;
    results.push({ id: c.id, prompt: c.prompt, expected: c.expected, decidedBy: c.decidedBy, got: m.skill, order: m.order, pass });
    if (pass) continue;
    let expectedRows = c.decidedBy
      ? table.filter((r) => c.decidedBy.includes(r.order))
      : table.filter((r) => (isNoneExpected(c.expected) ? r.fallback : r.skill === c.expected));
    if (c.decidedBy && !isNoneExpected(c.expected)) {
      const sameSkill = expectedRows.filter((r) => r.skill === c.expected || r.fallback);
      if (sameSkill.length) expectedRows = sameSkill;
    }
    misses.push({
      id: c.id,
      prompt: c.prompt,
      tokens: m.tokens,
      expected: c.expected,
      decidedBy: c.decidedBy,
      winner: {
        order: m.order,
        skill: m.skill,
        label: rowLabel(m.row),
        hits: m.hits,
      },
      expectedRows: expectedRows.map((r) => explainRow(r, m.tokens, m.row)),
      reason: !skillOk ? "wrong skill" : "right skill, wrong row",
    });
  }
  const total = cases.length;
  const passed = total - misses.length;
  const score = total ? Math.round((passed / total) * 10000) / 100 : 0;
  return { ok: total > 0 && score >= ROUTER_GATE, total, passed, failed: misses.length, score, gate: ROUTER_GATE, misses, results };
}

function formatMiss(miss) {
  const lines = [
    `MISS ${miss.id} (${miss.reason})`,
    `  prompt:   ${JSON.stringify(miss.prompt)}`,
    `  tokens:   ${miss.tokens.join(" ")}`,
    `  expected: ${miss.expected === null ? "nothing (fallback)" : `\`${miss.expected}\``}${miss.decidedBy ? ` via row ${miss.decidedBy.join(" or ")}` : ""}`,
    `  winner:   ${miss.winner.label}${miss.winner.hits.length ? ` (hits: ${miss.winner.hits.map((h) => JSON.stringify(h)).join(" + ")})` : ""}`,
  ];
  if (!miss.expectedRows.length) lines.push("  expected row: none exists for this skill/order");
  for (const r of miss.expectedRows) lines.push(`  expected row: ${r.label}: ${r.why}`);
  return lines.join("\n");
}

function isModel(x) {
  return Boolean(x && typeof x === "object" && Array.isArray(x.skills) && x.catalog);
}

function resolveArgs(a, b) {
  if (isModel(a)) return { model: a, opts: b || {} };
  const opts = a || {};
  return { model: loadModel(opts.root), opts };
}

const silentLog = { info() {}, warn() {}, error() {} };

/**
 * `eval --router [--json]`. Called as `evalRouter(opts)` by skills.mjs (loads the model from
 * `opts.root`) or as `evalRouter(model, opts)`. Gate 100 %. Returns `{ exitCode, ok, … }`.
 */
export async function evalRouter(a, b) {
  const { model, opts } = resolveArgs(a, b);
  const log = opts.log || silentLog;
  const flags = opts.flags || {};
  const report = runRouterEval(model);
  if (flags.json) {
    const { results, ...rest } = report;
    log.info(JSON.stringify(flags.verbose ? report : rest, null, 2));
  } else {
    for (const miss of report.misses) log.info(formatMiss(miss));
    if (!report.total) log.error("eval --router: catalog/routing-examples.json has no cases");
    log.info(
      `eval --router: ${report.passed}/${report.total} passed (${report.score} %) · gate ${report.gate} % · ${report.ok ? "PASS" : "FAIL"}`,
    );
  }
  return { exitCode: report.ok ? 0 : 1, ...report };
}

// ─── E2: eval --triggers ───────────────────────────────────────────────────────

/** Default location of the E2 prompt file (outside the repository, so `dist/` and sources stay clean). */
export function defaultTriggersPath() {
  return path.join(os.tmpdir(), "agents-skills-eval", "triggers-prompt.md");
}

/** True when a legacy-name case's prompt names one of the old ids a description lists. */
function legacyNamed(c, named) {
  const tokens = new Set(tokenize(c.prompt));
  return [...named].some((id) => tokens.has(id));
}

/**
 * Builds the E2 prompt: only the skill descriptions plus the cases. Legacy-name cases are left out
 * unless a description says "Old name: <id>" for that id (otherwise a description-only picker cannot
 * know old ids). Returns `{ text, cases, skills }`.
 */
export function buildTriggersPrompt(model) {
  const skills = [...model.skills]
    .map((s) => ({ id: s.id, pack: s.manifest.pack, description: String(s.manifest.description || "").trim() }))
    .sort((x, y) => compareStrings(x.id, y.id));
  // A legacy-name case is description-routable only when some description says "Old name: <id>".
  const named = new Set(skills.flatMap((s) => [...s.description.matchAll(/\bOld names?: ([a-z0-9-]+(?:, [a-z0-9-]+)*)/g)].flatMap((m) => m[1].split(", "))));
  const cases = routerCases(model.catalog.routingExamples)
    .filter((c) => !isNoneExpected(c.expected) && (c.kind !== "legacy" || legacyNamed(c, named)))
    .map((c) => ({ id: c.id, prompt: c.prompt, expected: c.expected, collision: c.collision }));
  const lines = [
    "# LPM skill trigger eval (E2, §5.7)",
    "",
    "You are a skill router. For each request below, pick the ONE skill whose description fits best.",
    "Use only the descriptions. Answer with a single JSON object mapping each case id to a skill id, and nothing else:",
    '`{"<case id>": "<skill id>", …}`',
    "",
    `## Skills (${skills.length})`,
    "",
    ...skills.map((s) => `- \`${s.id}\`: ${s.description.replace(/\s+/g, " ")}`),
    "",
    `## Cases (${cases.length})`,
    "",
    ...cases.map((c) => `- \`${c.id}\`: ${JSON.stringify(c.prompt)}`),
    "",
    "## Scoring (for the operator, not the model)",
    "",
    `Save the model's JSON answer to a file and run \`node scripts/skills.mjs eval --triggers --answers <file>\`. Gate: ≥${TRIGGERS_GATE} % top-1; collision cases are mandatory.`,
    "",
  ];
  return { text: lines.join("\n"), cases, skills };
}

/** Scores an answers object (`{id: skill}` or `[{id, skill}]`) against the E2 cases. */
export function scoreTriggers(cases, answers) {
  const map = new Map();
  if (Array.isArray(answers)) {
    for (const a of answers) if (a && typeof a === "object") map.set(String(a.id), a.skill ?? a.answer ?? null);
  } else if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers)) map.set(k, typeof v === "string" ? v : v && v.skill);
  }
  const misses = [];
  for (const c of cases) {
    const got = map.has(c.id) ? map.get(c.id) : null;
    if (got !== c.expected) misses.push({ id: c.id, prompt: c.prompt, expected: c.expected, got, collision: c.collision });
  }
  const total = cases.length;
  const passed = total - misses.length;
  const score = total ? Math.round((passed / total) * 10000) / 100 : 0;
  const collisionMisses = misses.filter((m) => m.collision).length;
  return { ok: total > 0 && score >= TRIGGERS_GATE, total, passed, failed: misses.length, score, gate: TRIGGERS_GATE, collisionMisses, misses };
}

/**
 * `eval --triggers [--model <id>] [--out <file>] [--answers <file>] [--json]`. Offline there is no
 * model to call: it writes the prompt file (descriptions + cases) for an optional manual run and
 * exits 0. With `--answers <file>` (the model's JSON answer) it scores the run against the gate.
 */
export async function evalTriggers(a, b) {
  const { model, opts } = resolveArgs(a, b);
  const log = opts.log || silentLog;
  const flags = opts.flags || {};
  const { text, cases, skills } = buildTriggersPrompt(model);
  if (typeof flags.answers === "string") {
    const answers = JSON.parse(fs.readFileSync(path.resolve(flags.answers), "utf8"));
    const report = scoreTriggers(cases, answers);
    if (flags.json) log.info(JSON.stringify(report, null, 2));
    else {
      for (const m of report.misses) {
        log.info(`MISS ${m.id}${m.collision ? " (collision)" : ""}: ${JSON.stringify(m.prompt)} → expected \`${m.expected}\`, got ${m.got ? `\`${m.got}\`` : "nothing"}`);
      }
      log.info(`eval --triggers: ${report.passed}/${report.total} top-1 (${report.score} %) · gate ${report.gate} % · ${report.ok ? "PASS" : "FAIL"}`);
    }
    return { exitCode: report.ok ? 0 : 1, ...report };
  }
  const out = path.resolve(typeof flags.out === "string" ? flags.out : defaultTriggersPath());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  const modelNote = typeof flags.model === "string" ? ` (--model ${flags.model} is not called: no model runs offline)` : "";
  if (flags.json) log.info(JSON.stringify({ ok: true, promptFile: out, skills: skills.length, cases: cases.length }, null, 2));
  else {
    log.info(`eval --triggers: wrote ${out} (${skills.length} descriptions, ${cases.length} cases)${modelNote}.`);
    log.info("Optional manual run: give the file to a cheap model, save its JSON answer, then run eval --triggers --answers <file>.");
  }
  return { exitCode: 0, ok: true, promptFile: out, skills: skills.length, cases: cases.length };
}
