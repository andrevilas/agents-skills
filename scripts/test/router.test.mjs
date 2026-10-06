// §5.2 deterministic matcher, E1 `eval --router` and E2 `eval --triggers` (§5.7).
// Uses a frozen copy of the §2.2 rows (fixtures/router-rows.json), so skill edits never change these tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureCopy, tempDir } from "./helpers.mjs";
import {
  compileTerm,
  evalRouter,
  evalTriggers,
  matchRequest,
  routerTable,
  runRouterEval,
  scoreTriggers,
  buildTriggersPrompt,
  termMatches,
  tokenize,
} from "../lib/router.mjs";
import { main } from "../skills.mjs";

const FIXTURE_ROWS = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "router-rows.json"), "utf8"),
);

/** A minimal model (the shape routingRows/routerTable read) built from the frozen rows. */
function fakeModel(examples = [], { rows = FIXTURE_ROWS.rows, legacy = FIXTURE_ROWS.legacy } = {}) {
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.skill)) byId.set(r.skill, []);
    const { skill, ...row } = r;
    byId.get(r.skill).push(row);
  }
  const skills = [...byId.keys()].sort().map((id) => ({
    id,
    manifest: {
      id,
      pack: byId.get(id).some((r) => r.internal) ? "internal" : "core",
      description: `Use when the request is about ${id}.`,
      routing: byId.get(id),
    },
  }));
  return {
    root: null,
    skills,
    skillById: Object.fromEntries(skills.map((s) => [s.id, s])),
    catalog: { routingExamples: examples, legacyIds: legacy.map((l) => ({ ...l, also: [] })) },
  };
}

const TABLE = routerTable(fakeModel());
const route = (text) => matchRequest(TABLE, text);

function expectRoute(text, skill, order) {
  const m = route(text);
  assert.equal(m.skill, skill, `"${text}" → ${m.skill} (row ${m.order}), expected ${skill} (row ${order})`);
  if (order !== undefined) assert.equal(m.order, order, `"${text}" won by row ${m.order}, expected row ${order}`);
}

// ─── Normalization and term matching ──────────────────────────────────────────

test("tokenize: lowercase, accent strip, joined tokens stay whole", () => {
  assert.deepEqual(tokenize("Decisão sobre a Transcrição"), ["decisao", "sobre", "a", "transcricao"]);
  assert.deepEqual(tokenize("LPM-Activity: trailer on lpm.rocks"), ["lpm-activity", "trailer", "on", "lpm.rocks"]);
  assert.deepEqual(tokenize("error NO_ACTIVE_INDEX / -32003."), ["error", "no_active_index", "32003"]);
  assert.deepEqual(tokenize("ação, coração; çÃÕ"), ["acao", "coracao", "cao"]);
  assert.deepEqual(tokenize(""), []);
});

test("terms: whole tokens only, consecutive words, trailing * prefix", () => {
  const hit = (term, text) => termMatches(compileTerm(term), tokenize(text));
  assert.equal(hit("commit", "make a commitment"), false, "no substring match");
  assert.equal(hit("commit", "commit it"), true);
  assert.equal(hit("bloquead*", "a tarefa está bloqueada"), true);
  assert.equal(hit("bloquead*", "bloqueio"), false);
  assert.equal(hit("set up", "set it up"), false, "multi-word terms are consecutive");
  assert.equal(hit("set up", "please set up codex"), true);
  assert.equal(hit("change set*", "publish the change sets"), true, "prefix on the last token");
  assert.equal(hit("artefato* de entrega", "os artefatos de entrega"), true, "a * on an inner word is a prefix too");
  assert.equal(hit("lpm_mcp_*", "token lpm_mcp_abc123"), true);
  assert.equal(hit("-32003", "got error -32003"), true);
  assert.equal(hit("decisao", "a decisão"), true, "terms and requests normalize the same way");
  assert.equal(hit("pedido de mudanca", "o pedido de mudança"), true);
  assert.deepEqual(compileTerm("***"), [], "a term that normalizes to nothing never matches");
  assert.equal(hit("***", "anything"), false);
});

test("rows: AND of OR-groups, unless blocks, ascending order across skills, fallback", () => {
  const rows = [
    { order: 20, skill: "b", all: [["alpha"]], unless: [] },
    { order: 10, skill: "a", all: [["alpha", "beta"], ["gamma"]], unless: ["delta"] },
    { order: 30, skill: "empty", all: [], unless: [] },
  ];
  assert.equal(matchRequest(rows, "alpha gamma").skill, "a", "lower order wins even when listed later");
  assert.equal(matchRequest(rows, "alpha").skill, "b", "every group must hit");
  assert.equal(matchRequest(rows, "alpha gamma delta").skill, "b", "unless blocks the row");
  const none = matchRequest(rows, "zeta");
  assert.equal(none.fallback, true, "a row without groups never matches; nothing → fallback");
  assert.equal(none.skill, null);
  assert.deepEqual(matchRequest(rows, "beta gamma").hits, ["beta", "gamma"]);
});

test("router table: legacy row = max order + 1, fallback row after it", () => {
  const legacy = TABLE.filter((r) => r.legacy);
  assert.equal(legacy.length, 15);
  assert.ok(legacy.every((r) => r.order === 37));
  const fb = TABLE.at(-1);
  assert.equal(fb.fallback, true);
  assert.equal(fb.order, 38);
  assert.equal(fb.firstCall, "search_help_articles");
  expectRoute("use the software-project-orchestrator skill", "lpm-deliver-activity", 37);
  expectRoute("usar a skill portfolio-health-review", "lpm-review-health", 37);
  expectRoute("usar a skill requirements-lifecycle-manager", "lpm-requirements-scope", 22);
  const m = route("tell me a joke about penguins");
  assert.equal(m.fallback, true);
  assert.equal(m.order, 38);
  assert.equal(m.skill, null);
});

// ─── §5.7 seed cases that broke revision 1 ────────────────────────────────────

test("seed: close the AISH job → delivery row 8, not deliver-activity row 17", () => {
  expectRoute("close the AISH job", "lpm-aish-delivery", 8);
  expectRoute("feche o job do AISH", "lpm-aish-delivery", 8);
  expectRoute("approve the AISH job plan", "lpm-aish-jobs", 9);
  expectRoute("close the activity", "lpm-deliver-activity", 17);
  expectRoute("close the sprint", "lpm-plan-work", 36);
});

test("seed: enrollment token for the runner host → runners row 3, not access row 4", () => {
  expectRoute("enrollment token for the runner host", "lpm-aish-runners", 3);
  expectRoute("gerar o token de enroll do host do runner", "lpm-aish-runners", 3);
  expectRoute("create an api key token", "lpm-access", 4);
  expectRoute("rotate the runner api key", "lpm-access", 4);
});

test("seed: roadmap-item dependency → owner-ops row 27; activity dependency → unblock row 18", () => {
  expectRoute("add a dependency between two roadmap items", "lpm-roadmap-owner-ops", 27);
  expectRoute("criar dependência entre itens do roadmap", "lpm-roadmap-owner-ops", 27);
  expectRoute("this activity depends on another one", "lpm-unblock-work", 18);
  expectRoute("a atividade está bloqueada", "lpm-unblock-work", 18);
});

test("seed: unowned capability → executive-context row 33; capability alone → roadmap row 29", () => {
  expectRoute("list every unowned capability", "lpm-executive-context", 33);
  expectRoute("capacidades sem dono", "lpm-executive-context", 33);
  expectRoute("register a new capability", "lpm-roadmap", 29);
});

test("seed: compare commits → code-index row 23; commit code → deliver row 15", () => {
  expectRoute("compare commits abc and def", "lpm-code-index", 23);
  expectRoute("comparar commits da main", "lpm-code-index", 23);
  expectRoute("commit this fix", "lpm-deliver-activity", 15);
  expectRoute("add the LPM-Activity trailer", "lpm-deliver-activity", 15);
  expectRoute("what is our commitment?", null, 38);
});

test("seed: commit the roadmap import → owner-ops row 27", () => {
  expectRoute("commit the roadmap import", "lpm-roadmap-owner-ops", 27);
  expectRoute("commitar a importação do roadmap", "lpm-roadmap-owner-ops", 27);
});

test("seed: evidence from WhatsApp/protocol → intake row 30; from code → advisor row 25; on activity → row 16", () => {
  expectRoute("attach the WhatsApp evidence", "lpm-intake-triage", 30);
  expectRoute("evidência do protocolo 123", "lpm-intake-triage", 30);
  expectRoute("evidence from the code", "lpm-ask-advisor", 25);
  expectRoute("qual a evidência no código?", "lpm-ask-advisor", 25);
  expectRoute("attach evidence to the activity", "lpm-deliver-activity", 16);
  expectRoute("anexar print da tela", "lpm-deliver-activity", 16);
});

test("seed: decisão on a change request → roadmap row 29; plain decision → governance row 21", () => {
  expectRoute("registrar a decisão sobre o pedido de mudança", "lpm-roadmap", 29);
  expectRoute("decision on the CR", "lpm-roadmap", 29);
  expectRoute("qual foi a decisão?", "lpm-governance-decisions", 21);
  expectRoute("open a governance thread", "lpm-governance-decisions", 20);
});

test("seed: materializar item em requisitos → owner-ops row 27, not requirements row 22", () => {
  expectRoute("materializar item em requisitos", "lpm-roadmap-owner-ops", 27);
  expectRoute("materialize the roadmap item into requirements", "lpm-roadmap-owner-ops", 27);
  expectRoute("publish the requirements baseline", "lpm-requirements-scope", 22);
});

test("internal rows win regardless of install, and AISH deploys stay with delivery", () => {
  expectRoute("deploy the fix to lpm.rocks", "lpm-release-product", 11);
  expectRoute("rollback da revisão do LPM em produção", "lpm-release-product", 12);
  expectRoute("deploy the AISH job release", "lpm-aish-delivery", 8);
  expectRoute("o piloto reportou um erro", "lpm-pilot-feedback", 13);
});

// ─── E1 eval ──────────────────────────────────────────────────────────────────

const SEED_EXAMPLES = [
  { id: "seed/close-aish", prompt: ["close the AISH job", "feche o job do AISH"], lang: ["en", "pt-BR"], expected: "lpm-aish-delivery", decidedBy: 8, collision: true },
  { id: "seed/runner-token", prompt: "enrollment token for the runner host", expected: "lpm-aish-runners", decidedBy: 3 },
  { id: "seed/evidence", prompt: ["register the delivery artifact as DoD evidence", "anexar evidência ao job do AISH"], expected: "lpm-aish-delivery", decidedBy: [7, 8] },
  { id: "seed/legacy", prompt: "use the webhook-integration-operator skill", expected: "lpm-integrations", decidedBy: "31 or 37" },
  { id: "seed/no-row", prompt: "materializar item em requisitos", expected: "lpm-roadmap-owner-ops" },
];

test("runRouterEval: every variant is a case; decidedBy as number, list or text", () => {
  const report = runRouterEval(fakeModel(SEED_EXAMPLES));
  assert.equal(report.total, 7);
  assert.equal(report.failed, 0, JSON.stringify(report.misses, null, 2));
  assert.equal(report.score, 100);
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.results.map((r) => r.id),
    ["seed/close-aish[en]", "seed/close-aish[pt-BR]", "seed/runner-token", "seed/evidence[0]", "seed/evidence[1]", "seed/legacy", "seed/no-row"],
  );
});

test("evalRouter: a miss reports prompt, expected skill, winning row and why the expected row lost", async () => {
  const examples = [
    ...SEED_EXAMPLES,
    { id: "bad/skill", prompt: "compare commits abc and def", expected: "lpm-deliver-activity", decidedBy: 15 },
    { id: "bad/row", prompt: "close the AISH job", expected: "lpm-aish-delivery", decidedBy: 7 },
    { id: "bad/earlier", prompt: "commit this fix", expected: "lpm-roadmap-owner-ops", decidedBy: 27 },
  ];
  const lines = [];
  const log = { info: (s) => lines.push(String(s)), warn() {}, error: (s) => lines.push(String(s)) };
  const res = await evalRouter(fakeModel(examples), { flags: { router: true }, log });
  assert.equal(res.exitCode, 1);
  assert.equal(res.ok, false);
  assert.equal(res.failed, 3);
  const text = lines.join("\n");
  assert.match(text, /MISS bad\/skill \(wrong skill\)/);
  assert.match(text, /prompt: {3}"compare commits abc and def"/);
  assert.match(text, /expected: `lpm-deliver-activity` via row 15/);
  assert.match(text, /winner: {3}row 23 `lpm-code-index` \(hits: "compare commits"\)/);
  assert.match(text, /expected row: row 15 `lpm-deliver-activity`: unless "compare" blocks it/);
  assert.match(text, /MISS bad\/row \(right skill, wrong row\)/);
  assert.match(text, /expected row: row 7 `lpm-aish-delivery`: group 1 \[definition of done/);
  assert.match(text, /expected row: row 27 `lpm-roadmap-owner-ops`: group 1 \[roadmap, item, itens, items\] has no hit/);
  assert.match(text, /eval --router: 7\/10 passed \(70 %\) · gate 100 % · FAIL/);
});

test("evalRouter --json prints a deterministic report", async () => {
  const run = async () => {
    const out = [];
    const log = { info: (s) => out.push(s), warn() {}, error() {} };
    const res = await evalRouter(fakeModel(SEED_EXAMPLES), { flags: { router: true, json: true }, log });
    return { res, out: out.join("\n") };
  };
  const a = await run();
  const b = await run();
  assert.equal(a.out, b.out);
  const json = JSON.parse(a.out);
  assert.equal(json.ok, true);
  assert.equal(json.gate, 100);
  assert.deepEqual(json.misses, []);
  assert.equal(json.results, undefined, "results only with --verbose");
  assert.equal(a.res.exitCode, 0);
});

test("evalRouter: no cases fails the gate", async () => {
  const res = await evalRouter(fakeModel([]), { flags: {}, log: { info() {}, warn() {}, error() {} } });
  assert.equal(res.exitCode, 1);
});

test("CLI: eval --router loads the model from --root and exits 1 on a miss", async () => {
  // The fixture repo has 2 simplified rows where "commita" (no prefix) and "the tool is missing" fall through.
  const root = fixtureCopy("router");
  const out = [];
  const { log: l, error: e } = console;
  console.log = (s) => out.push(String(s));
  console.error = () => {};
  let code;
  try {
    code = await main(["eval", "--router", "--json", "--root", root]);
  } finally {
    console.log = l;
    console.error = e;
  }
  assert.equal(code, 1);
  const json = JSON.parse(out.join("\n"));
  assert.equal(json.total, 5);
  assert.deepEqual(json.misses.map((m) => m.id).sort(), ["basic/start", "collision/c01[1]"]);
  const start = json.misses.find((m) => m.id === "basic/start");
  assert.equal(start.winner.order, 31, "fixture: 2 rows + 1 legacy row → fallback row 31");
  assert.equal(start.winner.skill, null);
});

// ─── E2 triggers ──────────────────────────────────────────────────────────────

test("evalTriggers: writes descriptions + cases offline, exits 0; --answers scores the run", async () => {
  const examples = [
    ...SEED_EXAMPLES,
    { id: "legacy/x", kind: "legacy", prompt: "use the portfolio-health-review skill", expected: "lpm-review-health", decidedBy: 37 },
  ];
  const model = fakeModel(examples);
  const dir = tempDir("triggers");
  const out = path.join(dir, "prompt.md");
  const res = await evalTriggers(model, { flags: { triggers: true, out, model: "cheap-model" }, log: { info() {}, warn() {}, error() {} } });
  assert.equal(res.exitCode, 0);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /- `lpm-aish-delivery`: Use when the request is about lpm-aish-delivery\./);
  assert.match(text, /- `seed\/close-aish\[pt-BR\]`: "feche o job do AISH"/);
  assert.doesNotMatch(text, /legacy\/x/, "legacy-name cases are not description-routable");
  assert.doesNotMatch(text, /decidedBy|lpm-aish-delivery`: "/, "the prompt never leaks expected answers");
  assert.equal(text, buildTriggersPrompt(model).text, "deterministic");

  const { cases } = buildTriggersPrompt(model);
  const perfect = Object.fromEntries(cases.map((c) => [c.id, c.expected]));
  const answers = path.join(dir, "answers.json");
  fs.writeFileSync(answers, JSON.stringify(perfect));
  const scored = await evalTriggers(model, { flags: { triggers: true, answers }, log: { info() {}, warn() {}, error() {} } });
  assert.equal(scored.exitCode, 0);
  assert.equal(scored.score, 100);

  const one = scoreTriggers(cases, { ...perfect, "seed/close-aish[en]": "lpm-deliver-activity" });
  assert.equal(one.ok, false, "1 miss in 7 is below 95 %");
  assert.equal(one.collisionMisses, 1);

  // A description that says "Old name: <id>" makes that legacy case description-routable.
  const named = fakeModel(examples);
  const target = named.skills.find((s) => s.id === "lpm-aish-delivery") || named.skills[0];
  target.manifest.description = `${target.manifest.description} Old name: portfolio-health-review.`;
  assert.match(buildTriggersPrompt(named).text, /legacy\/x/);
});
