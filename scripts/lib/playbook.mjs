// playbook.mjs — the playbook standard (spec revision 3, playbook-standard.md).
// Shared by render.mjs (R1–R3: router index, tools line, generic <id>.flows.md) and
// validate.mjs (V20 playbook structure, V21 CALL lines).
//
//   playbookIndex(src)                 → { tables, rows: [{playbook, useWhen, file}] } | null
//   isPlaybookSkill(skill)             → true when SKILL.src.md §5 holds `| Playbook | Use when | File |`
//   playbookRefNames(skill)            → flow-* reference names in §5 order (then any other flow-* file)
//   parsePlaybook(text)                → structural parse of one references/flow-<name>.md
//   checkPlaybookSkill(model, skill, opts) → [{ validator: "V20"|"V21", level: "fail"|"warn", message }]
//
// The module imports nothing from render.mjs (render.mjs imports this one).

// ─── Constants ─────────────────────────────────────────────────────────────────

export const PLAYBOOK_INDEX_HEADER = ["Playbook", "Use when", "File"];
export const ANSWER_HEADING = "## Answer (reply with exactly this block, filled in; write nothing before or after it)";
export const PLAYBOOK_H2 = ["## You need", "## Steps", ANSWER_HEADING];
export const PLAYBOOK_RULES_LINE = "{{partial:playbook-rules}}";
export const YOU_NEED_HEADER = ["Input", "Where it comes from", "If missing"];
export const REPORT_LABELS = ["Scope", "Done", "Evidence", "Pending", "Next"];

/** §8.1 rule 7 / §3.4: rendered native SKILL.md body (after the frontmatter). */
export const ROUTER_BODY_TARGET = 8 * 1024;
export const ROUTER_BODY_MAX = 9 * 1024;
/** §8.1 rule 18 / §4.5: playbook source file. */
export const PLAYBOOK_BYTES_TARGET = 6 * 1024;
export const PLAYBOOK_BYTES_MAX = 7 * 1024;
export const PLAYBOOK_LINES_MAX = 110;
export const PLAYBOOK_STEPS_MAX = 15;
/** §3.2: at most 10 playbooks per router. */
export const PLAYBOOK_INDEX_ROWS_MAX = 10;

const RANK = { A: 0, C: 1, O: 2 };
const LETTER = ["A", "C", "O"];

/** Statement openers (§5.1 statement). */
const STATEMENT_RE = /^(CALL |RUN `|SAVE: |ASK: "|ONLY IF the owner ordered it in this conversation \(quote the order\); otherwise STOP\. Say: "|IF |FOR EACH )/;
const ASK_RE = /^ASK: ".*" — continue only if the user says yes; otherwise STOP\.(?: Say: ".*")?$/;
const ONLY_IF_RE = /^ONLY IF the owner ordered it in this conversation \(quote the order\); otherwise STOP\. Say: ".*"$/;
const FOR_EACH_RE = /^FOR EACH [a-z][A-Za-z0-9]* IN <saved:[A-Za-z][A-Za-z0-9]*> \(none → go to step \d+\):$/;
/** `then` of an IF line (§5.1), anchored at the end of the line. */
const THEN_RE = new RegExp(
  "→ (?:" +
    [
      'STOP\\. Say: ".*"',
      'STOP\\. This belongs to skill \\{\\{skill:[a-z0-9-]+\\}\\}\\. Say: ".*"',
      "go to step \\d+\\.?",
      "go to Answer\\.?",
      "switch to playbook [a-z0-9-]+\\.?",
      'ASK: ".*" — continue only if the user says yes; otherwise STOP\\.(?: Say: ".*")?',
      "SAVE: .*; (?:go to step \\d+|go to Answer)\\.?",
    ].join("|") +
    ")$",
);
const CALL_RE = /^(?:VERIFY: )?CALL \{\{tool:([a-z0-9_]+)\}\} (\{.*\}) \[(A|C|O)\](?: \(.*\))?$/;
/** One CALL in a §4 Do cell: the JSON never contains a second `{{tool:`. */
const ROUTER_CALL_RE = /^CALL \{\{tool:([a-z0-9_]+)\}\} (\{(?:(?!\{\{tool:).)*\})$/;
const ROUTER_TAGGED_CALL_RE = /^CALL \{\{tool:([a-z0-9_]+)\}\} (\{(?:(?!\{\{tool:).)*\}) \[(A|C|O)\]$/;
const ROUTER_PLAYBOOK_RE = /^playbook \{\{ref:flow-([a-z0-9-]+)\}\}$/;
/** §4 compound: "playbook {{ref:flow-A}}, then playbook {{ref:flow-B}}" (gate + operation). */
const ROUTER_COMPOUND_PLAYBOOK_RE = /^playbook \{\{ref:flow-([a-z0-9-]+)\}\}, then playbook \{\{ref:flow-([a-z0-9-]+)\}\}$/;
const DEFAULT_ERROR_RE = /^Every (CALL|CALL or RUN) with no error line: IF it returns an error → STOP\.(?: This belongs to skill \{\{skill:[a-z0-9-]+\}\}\.)? Say: ".*"$/;
const PLACEHOLDER_RE = /<(input|saved|each):([A-Za-z][A-Za-z0-9]*)>/g;
/** §5.7: a RUN whose command writes (git global options such as `-C <dir>` may precede the verb). */
const WRITE_RUN_RE = /^RUN `(?:git (?:(?:-C|-c) \S+ |--[a-z-]+(?:=\S+)? )*(?:commit|push|tag|merge|rebase|reset|worktree add)\b|gcloud\b|npm publish\b|curl (?:.* )?-X ?(?:POST|PUT|PATCH|DELETE)\b)/;
/** §4.3: a note that sends the agent to skill documentation. */
const FILE_POINTER_RE = /\b(?:see|load|open|read)\s+(?:the\s+)?(?:references?\b|SKILL(?:\.md)?\b|tools\.md\b|[A-Za-z0-9_.-]+\.(?:refs|flows|tools)\.md\b)/i;

// ─── Small helpers (local copies: render.mjs imports this module) ──────────────

const isSeparatorRow = (line) => /^\s*\|?\s*:?-{3,}/.test(line) && /^[\s|:-]+$/.test(line);
const isFence = (line) => /^\s*(```|~~~)/.test(line);

/** Lines of the `## <n>.` section of a SKILL.src.md (until the next `## ` heading). */
function sectionLines(text, n) {
  const lines = String(text || "").split("\n");
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${n}[.\\s]`).test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** Table cells of a Markdown row (escaped pipes and pipes inside backticks stay in the cell). */
function cells(line) {
  const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cur += "\\|";
      i++;
      continue;
    }
    if (c === "`") inCode = !inCode;
    if (c === "|" && !inCode) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Every Markdown table in `lines`: [{ header: [cells], rows: [[cells]] }]. */
function tables(lines) {
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      cur = null;
      continue;
    }
    if (!cur) {
      cur = { header: cells(line), rows: [], sep: false };
      out.push(cur);
      continue;
    }
    if (!cur.sep && isSeparatorRow(line)) {
      cur.sep = true;
      continue;
    }
    cur.rows.push(cells(line));
  }
  return out.map(({ header, rows }) => ({ header, rows }));
}

const sameCells = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const bare = (s) => String(s || "").replace(/`/g, "").trim();
const indentOf = (line) => line.match(/^ */)[0].length;

// ─── Router index ──────────────────────────────────────────────────────────────

/**
 * The §5 playbook index of a router: `{ tables, rows: [{playbook, useWhen, file}] }`, or null when
 * §5 holds no table with header `| Playbook | Use when | File |` (the skill is not a playbook skill).
 * `tables` counts every table of §5.
 */
export function playbookIndex(src) {
  const all = tables(sectionLines(src, 5));
  const index = all.find((t) => sameCells(t.header, PLAYBOOK_INDEX_HEADER));
  if (!index) return null;
  return {
    tables: all.length,
    rows: index.rows.map((r) => ({ playbook: bare(r[0]), useWhen: r[1] || "", file: r[2] || "" })),
  };
}

/** True when the skill's router indexes playbooks (§8.1: "playbook skill"). */
export function isPlaybookSkill(skill) {
  return Boolean(skill && typeof skill.src === "string" && playbookIndex(skill.src));
}

export const isFlowRefName = (name) => /^flow-/.test(String(name || ""));

/**
 * Names of the skill's flow-* references in execution-index order: the §5 rows first (playbook
 * skills), then the remaining flow-* files in `skill.references` order.
 */
export function playbookRefNames(skill) {
  const flows = (skill.references || []).map((r) => r.name).filter(isFlowRefName);
  const out = [];
  const idx = typeof skill.src === "string" ? playbookIndex(skill.src) : null;
  for (const row of idx ? idx.rows : []) {
    const name = `flow-${row.playbook}`;
    if (flows.includes(name) && !out.includes(name)) out.push(name);
  }
  for (const f of flows) if (!out.includes(f)) out.push(f);
  return out;
}

// ─── Playbook parse ────────────────────────────────────────────────────────────

/**
 * Parses one playbook source. Line numbers are 1-based.
 * @returns {{
 *   lines: string[], bytes: number,
 *   h2: {text: string, lineNo: number}[],
 *   sections: Record<string, {text: string, lineNo: number}[]>,
 *   youNeed: {header: string[] | null, rows: string[][], inputs: Set<string>},
 *   defaultError: null | {call: boolean, run: boolean, text: string, lineNo: number},
 *   stray: {text: string, lineNo: number}[],
 *   steps: {n: number, action: string, lineNo: number, subs: {text: string, lineNo: number, inFence: boolean, fence: boolean}[]}[],
 *   answer: {lines: {text: string, lineNo: number}[], fences: {text: string, lineNo: number}[][], fenceEnd: number}
 * }}
 */
export function parsePlaybook(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n");
  const lines = raw.replace(/\n$/, "").split("\n");
  const bytes = Buffer.byteLength(raw, "utf8");
  const h2 = [];
  const sections = { _head: [] };
  let cur = "_head";
  let inFence = false;
  lines.forEach((line, i) => {
    if (isFence(line)) inFence = !inFence;
    else if (!inFence && /^## /.test(line)) {
      cur = line.trim();
      h2.push({ text: cur, lineNo: i + 1 });
      sections[cur] ||= [];
      return;
    }
    (sections[cur] ||= []).push({ text: line, lineNo: i + 1, inFence: inFence || isFence(line) });
  });

  // You need
  const ynTables = tables((sections["## You need"] || []).map((l) => l.text));
  const yn = ynTables[0] || null;
  const youNeed = {
    header: yn ? yn.header : null,
    rows: yn ? yn.rows : [],
    // one row per input; a row may name several inputs that share a source ("newName, newVersion")
    inputs: new Set(yn ? yn.rows.flatMap((r) => bare(r[0]).split(/\s*,\s*/)).filter(Boolean) : []),
  };

  // Steps
  const steps = [];
  const stray = [];
  let defaultError = null;
  let step = null;
  let fence = false;
  for (const l of sections["## Steps"] || []) {
    const t = l.text;
    if (isFence(t)) {
      fence = !fence;
      if (step) step.subs.push({ text: t, lineNo: l.lineNo, inFence: true, fence: true });
      else stray.push({ text: t, lineNo: l.lineNo });
      continue;
    }
    if (fence) {
      if (step) step.subs.push({ text: t, lineNo: l.lineNo, inFence: true, fence: false });
      continue;
    }
    if (!t.trim()) continue;
    const m = t.match(/^(\d+)\. (.*)$/);
    if (m) {
      step = { n: Number(m[1]), action: m[2].trim(), lineNo: l.lineNo, subs: [] };
      steps.push(step);
      continue;
    }
    if (!step) {
      const d = t.match(DEFAULT_ERROR_RE);
      if (d && !defaultError) defaultError = { call: true, run: d[1] === "CALL or RUN", text: t, lineNo: l.lineNo };
      else stray.push({ text: t, lineNo: l.lineNo });
      continue;
    }
    step.subs.push({ text: t, lineNo: l.lineNo, inFence: false, fence: false });
  }

  // Answer
  const ansLines = (sections[ANSWER_HEADING] || []).map(({ text: t, lineNo }) => ({ text: t, lineNo }));
  const fences = [];
  let f = null;
  let fenceEnd = -1;
  ansLines.forEach((l, i) => {
    if (isFence(l.text)) {
      if (f) {
        fences.push(f);
        f = null;
        fenceEnd = i;
      } else f = [];
      return;
    }
    if (f) f.push(l);
  });
  if (f) fences.push(f);
  return { lines, bytes, h2, sections, youNeed, defaultError, stray, steps, answer: { lines: ansLines, fences, fenceEnd } };
}

/** Names assigned by a SAVE text ("SAVE: a, b = …; c = …"): every LHS of a complete assignment. */
export function savedNames(text) {
  const at = String(text).indexOf("SAVE: ");
  if (at < 0) return [];
  const names = [];
  for (const part of String(text).slice(at + 6).split(";")) {
    const eq = part.indexOf(" = ");
    if (eq < 0) continue;
    for (const n of part.slice(0, eq).split(",")) if (/^\s*[A-Za-z][A-Za-z0-9]*\s*$/.test(n)) names.push(n.trim());
  }
  return names;
}

/** Statement kind of a step action: call, run, save, ask, onlyif, if, foreach or null. */
function statementKind(action) {
  const m = action.match(STATEMENT_RE);
  if (!m) return null;
  const k = m[1];
  if (k === "CALL ") return "call";
  if (k === "RUN `") return "run";
  if (k === "SAVE: ") return "save";
  if (k === 'ASK: "') return "ask";
  if (k === "IF ") return "if";
  if (k === "FOR EACH ") return "foreach";
  return "onlyif";
}

// ─── Checks (V20, V21) ─────────────────────────────────────────────────────────

/** JSON types allowed by a snapshot param type ("string", "number|null", "unknown", …). */
function allowedTypes(type) {
  const parts = String(type || "unknown").split("|").map((p) => p.trim());
  return new Set(parts);
}

const SCALAR_TYPES = new Set(["number", "integer", "boolean", "null"]);

function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeAllowed(types, v) {
  if (types.has("unknown") || types.has("any")) return true;
  const t = jsonType(v);
  if (types.has(t)) return true;
  return t === "integer" && types.has("number");
}

/** Every string inside a JSON value (keys of nested objects excluded). */
function stringsIn(v) {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(stringsIn);
  if (v && typeof v === "object") return Object.values(v).flatMap(stringsIn);
  return [];
}

/**
 * Runs V20 and V21 on one skill. Returns [] for a skill that is not a playbook skill (the
 * "kind tools without a playbook index" policy is applied by the caller).
 * @param {object} model loadModel() result
 * @param {object} skill one model.skills entry
 * @param {{readRendered?: (target: string) => string|null, targets?: string[]}} [opts]
 *   readRendered(target) returns the rendered native SKILL.md of `target` (rule 7); skipped when absent.
 * @returns {{validator: string, level: "fail"|"warn", message: string}[]}
 */
export function checkPlaybookSkill(model, skill, opts = {}) {
  const out = [];
  const fail = (v, message) => out.push({ validator: v, level: "fail", message });
  const warn = (v, message) => out.push({ validator: v, level: "warn", message });
  const src = typeof skill.src === "string" ? skill.src : "";
  const index = playbookIndex(src);
  const flows = skill.references.filter(r => isFlowRefName(r.name) && (index || /^# Playbook: /.test(r.content || "")));
  if (!index && !flows.length) return out;
  const snap = Object.fromEntries((model.catalog.snapshot ? model.catalog.snapshot.tools : []).map((t) => [t.name, t]));
  const owned = new Set([...skill.manifest.owns, ...skill.manifest.uses]);
  const rendered = (tool) => (model.tools[tool] ? model.tools[tool].authority : null);
  // Permission level is not an effect: code search requires write access for
  // accounting but does not mutate the user's project. Use the verified card,
  // as the other validators do, and fall back to the snapshot for stub cards.
  const effectOf = (tool) => model.tools[tool]?.card?.effect || snap[tool]?.accessLevel;
  const isWriteTool = (tool) => Boolean(snap[tool] && effectOf(tool) !== "read");
  const isReadTool = (tool) => Boolean(snap[tool] && effectOf(tool) === "read");

  /** V21 rules 2–5 and 9 for one CALL's tool, JSON args and tag. */
  function checkCall(where, tool, json, tag, placeholderOk) {
    const t = snap[tool];
    if (!t) {
      fail("V21", `${where}: ${tool} is not in the snapshot`);
      return;
    }
    if (!owned.has(tool)) fail("V21", `${where}: ${tool} is not in owns ∪ uses`);
    let args;
    try {
      args = JSON.parse(json);
    } catch (err) {
      fail("V21", `${where}: ${tool} arguments are not valid JSON (${err.message})`);
      return;
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      fail("V21", `${where}: ${tool} arguments must be a JSON object`);
      return;
    }
    for (const r of t.required || []) if (!(r in args)) fail("V21", `${where}: ${tool} misses required param ${r}`);
    for (const [k, v] of Object.entries(args)) {
      if (!(k in (t.params || {}))) {
        fail("V21", `${where}: ${tool} has no param ${k}`);
        continue;
      }
      // A whole-value sourced placeholder retains its runtime type. Fencing
      // tokens and generations must come from reads, never invented literals.
      const types = allowedTypes(t.params[k]);
      if ([...types].every((x) => SCALAR_TYPES.has(x))) {
        const binding = typeof v === "string" && v.match(/^<(input|saved|each):([A-Za-z][A-Za-z0-9]*)>$/);
        if (binding) placeholderOk(binding[1], binding[2], `${tool} param ${k}`);
        else if (typeof v === "string" && /<[^>]*>/.test(v)) fail("V21", `${where}: ${tool} param ${k} requires a whole sourced placeholder or a ${t.params[k]} literal`);
        else if (!typeAllowed(types, v)) fail("V21", `${where}: ${tool} param ${k} must be a ${t.params[k]} literal (has ${jsonType(v)})`);
        continue;
      }
      for (const s of stringsIn(v)) {
        const free = s.replace(PLACEHOLDER_RE, "").match(/<[^>]*>/);
        if (free) fail("V21", `${where}: ${tool} param ${k} holds the free slot ${free[0]}; args take only <input:x>, <saved:x> and <each:x>`);
        for (const m of s.matchAll(PLACEHOLDER_RE)) placeholderOk(m[1], m[2], `${tool} param ${k}`);
      }
    }
    const r = rendered(tool);
    if (r && RANK[tag] < RANK[r]) fail("V21", `${where}: ${tool} is tagged [${tag}] but renders [${r}]`);
    else if (r && tag !== r) warn("V21", `${where}: ${tool} is tagged [${tag}], stricter than its rendered [${r}]`);
  }

  // ── playbooks ──
  const names = new Set(flows.map((r) => r.name.replace(/^flow-/, "")));
  const info = {};
  for (const ref of flows) {
    const name = ref.name.replace(/^flow-/, "");
    info[name] = lintPlaybook(ref, name);
    const decl = skill.manifest.references.find((x) => x.file === ref.file || x.file === `${ref.name}.md`);
    const want = `playbook ${name}: ${info[name].useWhen}`;
    if (!decl) fail("V20", `skill.json references[] has no entry for ${ref.file} (loadWhen "${want}")`);
    else if (decl.loadWhen !== want) fail("V20", `skill.json loadWhen of ${ref.file} must be "${want}" (is "${decl.loadWhen || ""}")`);
  }

  function lintPlaybook(ref, name) {
    const P = ref.file || `references/${ref.name}.md`;
    const pb = parsePlaybook(ref.content || "");
    const res = { useWhen: "", tag: 0 };
    // rule 18: size
    if (pb.bytes > PLAYBOOK_BYTES_MAX) fail("V20", `${P}: ${pb.bytes} bytes (max ${PLAYBOOK_BYTES_MAX})`);
    else if (pb.bytes > PLAYBOOK_BYTES_TARGET) warn("V20", `${P}: ${pb.bytes} bytes (target ≤ ${PLAYBOOK_BYTES_TARGET})`);
    if (pb.lines.length > PLAYBOOK_LINES_MAX) fail("V20", `${P}: ${pb.lines.length} lines (max ${PLAYBOOK_LINES_MAX})`);
    // rule 8: layout
    if (pb.lines[0] !== `# Playbook: ${name}`) fail("V20", `${P}: line 1 must be "# Playbook: ${name}"`);
    const uw = (pb.lines[1] || "").match(/^Use when: (\S.*)$/);
    if (!uw) fail("V20", `${P}: line 2 must be "Use when: <text>"`);
    res.useWhen = uw ? uw[1].trim() : "";
    if ((pb.lines[2] || "").trim() !== PLAYBOOK_RULES_LINE) fail("V20", `${P}: line 3 must be ${PLAYBOOK_RULES_LINE}`);
    const h2 = pb.h2.map((h) => h.text);
    if (!sameCells(h2, PLAYBOOK_H2)) fail("V20", `${P}: H2 headings must be exactly ${PLAYBOOK_H2.map((h) => `"${h}"`).join(", ")} (has ${h2.map((h) => `"${h}"`).join(", ") || "none"})`);
    // rule 9: You need
    if (!pb.youNeed.header || !sameCells(pb.youNeed.header, YOU_NEED_HEADER)) fail("V20", `${P}: "## You need" must hold a table | ${YOU_NEED_HEADER.join(" | ")} |`);
    const inputs = pb.youNeed.inputs;
    // rule 16: self-contained
    pb.lines.forEach((line, i) => {
      const W = `${P}:${i + 1}`;
      if (/\{\{ref:/.test(line)) fail("V20", `${W}: a playbook must not link another file ({{ref:…}})`);
      if (/references\//.test(line)) fail("V20", `${W}: a playbook must not point to references/`);
      if (/§\s?\d/.test(line)) fail("V20", `${W}: a playbook must not point to a SKILL.md section (§<n>)`);
      for (const m of line.matchAll(/\{\{skill:([a-z0-9-]+)\}\}/g)) {
        if (!line.includes(`STOP. This belongs to skill {{skill:${m[1]}}}. Say: "`)) fail("V20", `${W}: {{skill:${m[1]}}} only in "STOP. This belongs to skill {{skill:${m[1]}}}. Say: …"`);
      }
    });
    // rule 10: steps
    for (const s of pb.stray) fail("V20", `${P}:${s.lineNo}: only the default error line may precede step 1 ("${s.text.trim().slice(0, 60)}")`);
    if (!pb.steps.length) fail("V20", `${P}: "## Steps" has no numbered step`);
    if (pb.steps.length > PLAYBOOK_STEPS_MAX) fail("V20", `${P}: ${pb.steps.length} steps (max ${PLAYBOOK_STEPS_MAX})`);
    pb.steps.forEach((s, i) => {
      if (s.n !== i + 1) fail("V20", `${P} step ${s.n}: steps must be numbered 1..N without gaps (expected ${i + 1})`);
    });
    const byN = new Map(pb.steps.map((s) => [s.n, s]));
    const gated = (s) => {
      const m = s && s.action.match(CALL_RE);
      return Boolean(m && (m[3] === "C" || m[3] === "O"));
    };

    // placeholder bookkeeping (V21 rules 6–8)
    const saved = new Set();
    const placeholderCheck = (where, text, { inForEach, addSaves = true }) => {
      for (const m of String(text).matchAll(PLACEHOLDER_RE)) {
        const [, kind, nm] = m;
        if (kind === "input" && !inputs.has(nm)) fail("V21", `${where}: <input:${nm}> has no "You need" row`);
        if (kind === "each" && !inForEach) fail("V21", `${where}: <each:${nm}> outside FOR EACH`);
        if (kind === "saved" && !saved.has(nm)) {
          // earlier in the same SAVE line: a complete assignment before this placeholder
          const before = String(text).slice(0, m.index);
          const at = before.indexOf("SAVE: ");
          const segs = at >= 0 ? before.slice(at).split(";") : [];
          const earlier = savedNames(segs.slice(0, -1).join(";"));
          if (!earlier.includes(nm)) fail("V21", `${where}: <saved:${nm}> is used before any SAVE of it`);
        }
      }
      if (addSaves && /(^|\s|→ )SAVE: /.test(text)) for (const nm of savedNames(text)) saved.add(nm);
    };
    for (const row of pb.youNeed.rows) {
      for (const c of row.slice(1)) {
        for (const m of c.matchAll(PLACEHOLDER_RE)) {
          if (m[1] === "input" && !inputs.has(m[2])) fail("V21", `${P} You need: <input:${m[2]}> has no "You need" row`);
          if (m[1] !== "input") fail("V21", `${P} You need: <${m[1]}:${m[2]}> is not allowed in "You need" (only <input:x>)`);
        }
      }
    }
    if (pb.defaultError) placeholderCheck(`${P} default error line`, pb.defaultError.text, { inForEach: false, addSaves: false });

    for (const s of pb.steps) {
      const W = `${P} step ${s.n}`;
      const kind = statementKind(s.action);
      const isForEach = kind === "foreach";
      if (!kind) fail("V20", `${W}: a step starts with CALL, RUN \`, SAVE:, ASK: ", ONLY IF the owner ordered it…, IF or FOR EACH`);
      if (kind === "ask" && !ASK_RE.test(s.action)) fail("V20", `${W}: ASK must read 'ASK: "<question>" — continue only if the user says yes; otherwise STOP.'`);
      if (kind === "onlyif" && !ONLY_IF_RE.test(s.action)) fail("V20", `${W}: ONLY IF must end with 'otherwise STOP. Say: "<decision request>"'`);
      if (kind === "if" && !THEN_RE.test(s.action)) fail("V20", `${W}: IF needs a known "→ …" ending (STOP. Say: "…", go to step N, go to Answer, switch to playbook X, ASK: …, SAVE: …; go to …)`);
      if (isForEach && !FOR_EACH_RE.test(s.action)) fail("V20", `${W}: FOR EACH must read "FOR EACH <x> IN <saved:list> (none → go to step N):"`);
      const firstSub = s.subs.findIndex((l) => l.inFence || indentOf(l.text) < 5);
      const actionCont = (firstSub < 0 ? s.subs : s.subs.slice(0, firstSub)).map((l) => l.text.trim());
      const actionText = [s.action, ...actionCont].join("; ");
      if (kind === "save" && !savedNames(actionText).length) fail("V20", `${W}: SAVE needs "<name> = <value>"`);
      if (kind === "run" && !/^RUN `[^`]+`/.test(s.action)) fail("V20", `${W}: RUN needs one backticked command`);

      // rule 11: sub-lines
      const subs = s.subs;
      for (const l of subs) {
        if (l.inFence) {
          if (l.fence && indentOf(l.text) !== 3) fail("V20", `${W}: a fenced block inside a step is indented by exactly 3 spaces`);
          continue;
        }
        const ind = indentOf(l.text);
        if (ind >= 5) continue; // continuation of the previous sub-line
        if (ind !== 3 || /^\s*\t/.test(l.text)) {
          fail("V20", `${W}: sub-lines are indented by exactly 3 spaces (continuations by 5 or more): "${l.text.trim().slice(0, 50)}"`);
          continue;
        }
        const t = l.text.trim();
        if (/^IF /.test(t) && !THEN_RE.test(t)) fail("V20", `${W}: IF needs a known "→ …" ending: "${t.slice(0, 70)}"`);
        else if (/^ASK: /.test(t) && !ASK_RE.test(t)) fail("V20", `${W}: ASK must read 'ASK: "<question>" — continue only if the user says yes; otherwise STOP.'`);
        else if (/^VERIFY\b/.test(t) && !/^VERIFY: (CALL|RUN) /.test(t)) fail("V20", `${W}: VERIFY must be "VERIFY: CALL …" or "VERIFY: RUN \`…\`"`);
        else if (/^(CALL |RUN `)/.test(t) && !isForEach) fail("V20", `${W}: a CALL or RUN sub-line is allowed only inside FOR EACH (a re-read is "VERIFY: CALL …")`);
        else if (/^GO TO\b/.test(t) && !/^GO TO (step \d+|Answer)\.?$/.test(t)) fail("V20", `${W}: "GO TO step N" or "GO TO Answer"`);
        else if (FILE_POINTER_RE.test(t)) fail("V20", `${W}: a note must not send the agent to another file: "${t.slice(0, 60)}"`);
      }

      // placeholders + saves, in reading order. A continuation line (5+ spaces) continues the line
      // above it (§5.1): a SAVE split over continuation lines assigns one name per line.
      const logical = [{ text: s.action, foreach: false }];
      for (const l of subs) {
        const t = l.text.trim();
        if (l.inFence) logical.push({ text: t, foreach: isForEach, fenced: true });
        else if (indentOf(l.text) >= 5 && logical.length && !logical[logical.length - 1].fenced) logical[logical.length - 1].text += `; ${t}`;
        else logical.push({ text: t, foreach: isForEach });
      }
      for (const x of logical) placeholderCheck(W, x.text, { inForEach: x.foreach });

      // CALL / RUN lines of this step: [{kind, text, index (-1 = action), verify}]
      const items = [{ text: s.action, index: -1 }, ...subs.map((l, i) => ({ text: l.text.trim(), index: i, raw: l }))]
        .filter((x) => !(x.raw && (x.raw.inFence || indentOf(x.raw.text) >= 5)));
      const isSubIf = (x) => x && /^IF /.test(x.text);
      const nextSub = (i) => items.find((x) => x.index > i);
      // region of a CALL/RUN: the sub-lines after it, up to the next CALL, RUN or VERIFY line
      const regionAfter = (i) => {
        const out2 = [];
        for (const x of items) {
          if (x.index <= i) continue;
          if (/^(VERIFY: |CALL |RUN `)/.test(x.text)) break;
          out2.push(x);
        }
        return out2;
      };
      let callsInBody = 0;
      for (const x of items) {
        const isCall = /^(VERIFY: )?CALL /.test(x.text);
        const isRun = /^(VERIFY: )?RUN /.test(x.text);
        if (!isCall && !isRun) continue;
        const verify = /^VERIFY: /.test(x.text);
        if (isForEach && x.index >= 0 && !verify) callsInBody++;
        if (isCall) {
          const m = x.text.match(CALL_RE);
          if (!m) {
            fail("V21", `${W}: CALL must read "CALL {{tool:<name>}} {json} [A|C|O]": "${x.text.slice(0, 70)}"`);
            continue;
          }
          const [, tool, json, tag] = m;
          res.tag = Math.max(res.tag, RANK[tag]);
          checkCall(W, tool, json, tag, () => {});
          if (verify) {
            if (snap[tool] && !isReadTool(tool)) fail("V20", `${W}: VERIFY must call a read tool (${tool} is ${snap[tool].accessLevel})`);
            const nx = nextSub(x.index);
            // the IF lines right after the VERIFY: one of them stops on a failed re-read
            const ifs = [];
            for (const y of items) {
              if (y.index <= x.index) continue;
              if (!isSubIf(y)) break;
              ifs.push(y);
            }
            if (!isSubIf(nx)) fail("V20", `${W}: VERIFY ${tool} must be followed by an IF line`);
            else if (!ifs.some((y) => /^IF the call returns an error or /.test(y.text))) fail("V20", `${W}: the IF after VERIFY ${tool} must start "IF the call returns an error or …"`);
            continue;
          }
          // rule 13: error line
          const own = regionAfter(x.index).some((y) => /^IF the call returns an error\b/.test(y.text));
          if (!own && !(pb.defaultError && pb.defaultError.call)) fail("V20", `${W}: CALL ${tool} has no "IF the call returns an error" line and no default error line covers it`);
          // rule 12: writes are verified in their own step
          if (isWriteTool(tool)) {
            if (isForEach) fail("V20", `${W}: a FOR EACH body holds no write (${tool})`);
            const later = items.filter((y) => y.index > x.index && /^VERIFY: (CALL|RUN) /.test(y.text));
            if (!later.length) fail("V20", `${W}: write ${tool} has no VERIFY sub-line in its step`);
          }
          // rule 14: gates
          if (tag === "C" || tag === "O") {
            const prev = byN.get(s.n - 1);
            if (tag === "C" && !(prev && statementKind(prev.action) === "ask")) fail("V20", `${W}: [C] ${tool} must follow an ASK: step`);
            if (tag === "O" && !(prev && statementKind(prev.action) === "onlyif")) fail("V20", `${W}: [O] ${tool} must follow an ONLY IF step`);
          }
          continue;
        }
        // RUN
        if (!/^(?:VERIFY: )?RUN `[^`]+`/.test(x.text)) {
          fail("V20", `${W}: RUN needs one backticked command: "${x.text.slice(0, 60)}"`);
          continue;
        }
        if (verify) {
          const nx = nextSub(x.index);
          if (!isSubIf(nx)) fail("V20", `${W}: VERIFY: RUN must be followed by an IF line`);
          continue;
        }
        const own = regionAfter(x.index).some((y) => /^IF the command fails\b/.test(y.text));
        if (!own && !(pb.defaultError && pb.defaultError.run)) fail("V20", `${W}: RUN has no "IF the command fails" line and no "Every CALL or RUN" default error line covers it`);
        if (WRITE_RUN_RE.test(x.text)) {
          if (isForEach) fail("V20", `${W}: a FOR EACH body holds no write command`);
          if (!items.some((y) => y.index > x.index && /^VERIFY: (CALL|RUN) /.test(y.text))) fail("V20", `${W}: write command has no VERIFY sub-line in its step`);
        }
      }
      if (isForEach && callsInBody !== 1) fail("V20", `${W}: a FOR EACH body holds exactly one CALL or RUN (has ${callsInBody})`);

      // rule 15: jumps
      for (const l of [s.action, ...subs.filter((x) => !x.inFence).map((x) => x.text)]) {
        for (const j of l.matchAll(/\b(?:go to|GO TO) step (\d+)/g)) {
          const n = Number(j[1]);
          if (n <= s.n || n > pb.steps.length) fail("V20", `${W}: "go to step ${n}" must jump forward to an existing step`);
          else if (gated(byN.get(n))) fail("V20", `${W}: "go to step ${n}" lands on a [C]/[O] CALL and skips its gate; jump to the gate step`);
        }
        for (const j of l.matchAll(/switch to playbook ([a-z0-9-]+)/g)) {
          if (j[1] === name || !names.has(j[1])) fail("V20", `${W}: "switch to playbook ${j[1]}" must name another playbook of this skill`);
        }
      }
    }

    // rule 17 + V21 rule 7: Answer
    const fences = pb.answer.fences;
    if (fences.length !== 1) fail("V20", `${P}: Answer needs exactly one fenced block (has ${fences.length})`);
    else {
      const labels = fences[0].map((l) => (l.text.match(/^([A-Za-z]+):/) || [])[1] || "?");
      if (!sameCells(labels, REPORT_LABELS)) fail("V20", `${P}: the Answer block has exactly the lines ${REPORT_LABELS.join(", ")} (has ${labels.join(", ") || "none"})`);
    }
    for (const l of pb.answer.lines) {
      for (const m of l.text.matchAll(PLACEHOLDER_RE)) {
        if (m[1] === "input" && !inputs.has(m[2])) fail("V21", `${P} Answer: <input:${m[2]}> has no "You need" row`);
        if (m[1] === "saved" && !saved.has(m[2])) fail("V21", `${P} Answer: <saved:${m[2]}> is never SAVEd in the steps`);
        if (m[1] === "each") fail("V21", `${P} Answer: <each:${m[2]}> outside FOR EACH`);
      }
    }
    const after = pb.answer.fenceEnd >= 0 ? pb.answer.lines.slice(pb.answer.fenceEnd + 1).map((l) => l.text) : [];
    if (!after.some((t) => /Never (claim|write that a check passed)/.test(t))) fail("V20", `${P}: after the Answer block, a line must hold the never-claim rule ("Never claim …")`);
    if (fences.length === 1 && fences[0].some((l) => /\bstatus\b/i.test(l.text)) && !after.some((t) => /\S \| \S/.test(t))) {
      warn("V20", `${P}: the Answer block mentions a status but no " | "-separated list of allowed values follows it`);
    }
    return res;
  }

  // ── router ──
  // Hybrid skills keep established procedures, but every new playbook still
  // receives schema, data-flow, authority and verification checks.
  if (!index) return out;
  // rule 2: §5 is one index table, no ### P<n>
  const sec5 = sectionLines(src, 5);
  if (index.tables !== 1) fail("V20", `§5 must hold exactly one table, the playbook index (has ${index.tables})`);
  if (sec5.some((l) => /^###\s+P\d+\b/.test(l))) fail("V20", "§5 of a playbook skill holds no ### P<n> procedures");
  if (index.rows.length > PLAYBOOK_INDEX_ROWS_MAX) fail("V20", `§5 indexes ${index.rows.length} playbooks (max ${PLAYBOOK_INDEX_ROWS_MAX})`);
  // rules 3–4: §5 rows ↔ files ↔ Use when
  const listed = new Map();
  for (const row of index.rows) {
    const nm = row.playbook;
    listed.set(nm, (listed.get(nm) || 0) + 1);
    if (!info[nm]) {
      fail("V20", `§5 lists playbook ${nm}, but references/flow-${nm}.md does not exist`);
      continue;
    }
    if (row.file !== `{{ref:flow-${nm}}}`) fail("V20", `§5 row ${nm}: File must be {{ref:flow-${nm}}} (is "${row.file}")`);
    if (row.useWhen !== info[nm].useWhen) fail("V20", `§5 row ${nm}: Use when "${row.useWhen}" differs from the playbook's "Use when: ${info[nm].useWhen}"`);
  }
  for (const nm of names) {
    const n = listed.get(nm) || 0;
    if (n !== 1) fail("V20", `references/flow-${nm}.md must appear in exactly one §5 row (appears in ${n})`);
  }
  // rule 5: §4 Do cells (+ V21 for CALL rows)
  const sec3 = tables(sectionLines(src, 3))[0];
  const routerInputs = new Set((sec3 ? sec3.rows : []).flatMap((r) => bare(r[0]).split(/\s*,\s*/)).filter(Boolean));
  const sec4 = tables(sectionLines(src, 4))[0];
  for (const row of sec4 ? sec4.rows : []) {
    const num = (row[0] || "").trim();
    if (!/^\d+$/.test(num)) continue;
    const W = `§4 row ${num}`;
    const doCell = (row[2] || "").trim();
    const auth = bare(row[3]).replace(/^\[|\]$/g, "");
    const pb = doCell.match(ROUTER_PLAYBOOK_RE);
    const compound = !pb && doCell.match(ROUTER_COMPOUND_PLAYBOOK_RE);
    const call = doCell.match(ROUTER_CALL_RE);
    if (pb) {
      if (!info[pb[1]]) fail("V20", `${W}: playbook ${pb[1]} has no references/flow-${pb[1]}.md`);
      else if (auth !== LETTER[info[pb[1]].tag]) fail("V20", `${W}: Auth must be ${LETTER[info[pb[1]].tag]}, the strictest tag in playbook ${pb[1]} (is "${auth}")`);
    } else if (compound) {
      const [, first, second] = compound;
      for (const nm of [first, second]) {
        if (!info[nm]) fail("V20", `${W}: playbook ${nm} has no references/flow-${nm}.md`);
      }
      // Auth = strictest tag across both playbooks
      if (info[first] && info[second]) {
        const strictest = RANK[LETTER[info[first].tag]] >= RANK[LETTER[info[second].tag]] ? info[first].tag : info[second].tag;
        if (auth !== LETTER[strictest]) fail("V20", `${W}: Auth must be ${LETTER[strictest]}, the strictest tag across playbooks ${first} and ${second} (is "${auth}")`);
      }
    } else if (call) {
      const [, tool, json] = call;
      if (snap[tool] && !isReadTool(tool)) fail("V20", `${W}: a CALL row calls a read tool (${tool} is ${snap[tool].accessLevel}); a write needs a playbook`);
      if (!RANK.hasOwnProperty(auth)) fail("V20", `${W}: Auth must be A, C or O (is "${auth}")`);
      checkCall(W, tool, json, RANK.hasOwnProperty(auth) ? auth : "A", (kind, nm, what) => {
        if (kind === "input" && !routerInputs.has(nm)) fail("V21", `${W}: <input:${nm}> (${what}) has no §3 Inputs row`);
        if (kind !== "input") fail("V21", `${W}: <${kind}:${nm}> (${what}): a §4 CALL row takes only <input:x>`);
      });
    } else if (ROUTER_TAGGED_CALL_RE.test(doCell)) {
      fail("V21", `${W}: CALL must read "CALL {{tool:<name>}} {json}" with no tag (the Auth column holds it)`);
    } else {
      fail("V20", `${W}: Do must be "playbook {{ref:flow-<name>}}", "playbook {{ref:flow-A}}, then playbook {{ref:flow-B}}", or "CALL {{tool:x}} {json}"`);
    }
  }
  // rule 6: no {{errors:auto}} in §9
  if (sectionLines(src, 9).some((l) => /^\{\{errors:auto(?::[a-z0-9_,\s]+)?\}\}$/.test(l.trim()))) warn("V20", "§9 holds {{errors:auto}}; per-call errors live in the playbooks (all card errors stay in tools.md)");
  // rule 7: rendered router size
  if (typeof opts.readRendered === "function") {
    for (const target of opts.targets || ["codex", "claude-code", "antigravity"]) {
      const text = opts.readRendered(target);
      if (text === null || text === undefined) continue;
      const body = String(text).replace(/^---\n[\s\S]*?\n---\n/, "");
      const b = Buffer.byteLength(body, "utf8");
      if (b > ROUTER_BODY_MAX) fail("V20", `dist/${target}/${skill.id}/SKILL.md: body is ${b} bytes (max ${ROUTER_BODY_MAX})`);
      else if (b > ROUTER_BODY_TARGET) warn("V20", `dist/${target}/${skill.id}/SKILL.md: body is ${b} bytes (target ≤ ${ROUTER_BODY_TARGET})`);
    }
  }
  return out;
}
