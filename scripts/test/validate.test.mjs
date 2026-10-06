// Validators V1–V20 (§5.6): the check-repo fixture passes every validator after `build`;
// for each validator, one mutation of that fixture makes it fail (or warn, for ⚠ validators).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SCRIPTS, tempDir } from "./helpers.mjs";
import { loadModel } from "../lib/model.mjs";
import { runBuild } from "../lib/build.mjs";
import { cliMentions, exampleLines, globToRegExp, hasPtBr, runCheck, validate, VALIDATORS } from "../lib/validate.mjs";

const CHECK_FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "check-repo");
const OPTS = { today: "2026-10-06", evalRouter: async () => 0 };
const silent = { info() {}, warn() {}, error() {} };

/** Fresh copy of the check fixture: `before` edits sources, then build, then `after` edits outputs. */
function prepare(name, { before, after } = {}) {
  const root = tempDir(`check-${name}`);
  fs.cpSync(CHECK_FIXTURE, root, { recursive: true });
  if (before) before(root);
  runBuild(root);
  if (after) after(root);
  return root;
}

const check = (root, extra = {}) => validate(loadModel(root), { ...OPTS, ...extra });
const fails = (r, v) => r.failures.filter((f) => f.validator === v);
const warns = (r, v) => r.warnings.filter((f) => f.validator === v);

function edit(root, rel, fn) {
  const abs = path.join(root, rel);
  fs.writeFileSync(abs, fn(fs.readFileSync(abs, "utf8")));
}
function editJson(root, rel, fn) {
  edit(root, rel, (t) => {
    const v = JSON.parse(t);
    return JSON.stringify(fn(v) ?? v, null, 2) + "\n";
  });
}
const DELIVER_SRC = "skills/lpm-deliver-activity/SKILL.src.md";
/** Adds a line at the end of §2 Preconditions of the deliver skill. */
const addPrecondition = (root, line) => edit(root, DELIVER_SRC, (t) => t.replace("\n\n## 3. Inputs", `\n${line}\n\n## 3. Inputs`));

/** Asserts the base fixture passes `v` and the mutated result fails it. */
function assertFailsOnly(base, mutated, v, pattern) {
  assert.equal(fails(base, v).length, 0, `base fixture fails ${v}`);
  const hit = fails(mutated, v);
  assert.ok(hit.length > 0, `${v} did not fail; failures: ${JSON.stringify(mutated.failures.slice(0, 5))}`);
  if (pattern) assert.ok(hit.some((f) => pattern.test(f.message)), `${v}: no message matches ${pattern}: ${JSON.stringify(hit)}`);
}

const base = await check(prepare("base"));

test("the check fixture passes every validator with no warnings", () => {
  assert.deepEqual(base.failures, []);
  assert.deepEqual(base.warnings, []);
  assert.equal(base.ok, true);
});

test("V1 skill.json schema: description must start with Use when/first/only", async () => {
  const r = await check(prepare("v1", { before: (root) => editJson(root, "skills/lpm-start/skill.json", (m) => void (m.description = "Connects agents to LPM (conectar).")) }));
  assertFailsOnly(base, r, "V1", /must start with "Use when"/);
});

test("V1 skill.json schema: an \"Old name:\" in a description must be a legacy id routed to that skill", async () => {
  const ok = await check(prepare("v1old", { before: (root) => editJson(root, "skills/lpm-deliver-activity/skill.json", (m) => void (m.description += " Old name: software-project-orchestrator.")) }));
  assert.equal(fails(ok, "V1").length, 0, JSON.stringify(fails(ok, "V1")));
  const r = await check(
    prepare("v1old2", {
      before: (root) => {
        editJson(root, "skills/lpm-start/skill.json", (m) => void (m.description += " Old name: software-project-orchestrator."));
        editJson(root, "skills/lpm-deliver-activity/skill.json", (m) => void (m.description += " Old name: no-such-skill."));
      },
    }),
  );
  assertFailsOnly(base, r, "V1", /"Old name: software-project-orchestrator", but legacy-ids\.json routes it to lpm-deliver-activity/);
  assert.ok(fails(r, "V1").some((f) => /"Old name: no-such-skill", which is not in catalog\/legacy-ids\.json/.test(f.message)));
});

test("V1 skill.json schema: notFor target, shortDescription and duplicate routing order", async () => {
  const r = await check(
    prepare("v1b", {
      before: (root) =>
        editJson(root, "skills/lpm-deliver-activity/skill.json", (m) => {
          m.notFor.push({ when: "x", skill: "lpm-nope" });
          m.codex.shortDescription = "too short";
          m.routing[0].order = 1;
        }),
    }),
  );
  assertFailsOnly(base, r, "V1", /notFor\[2\]: skill "lpm-nope"/);
  assert.ok(fails(r, "V1").some((f) => /shortDescription/.test(f.message)));
  assert.ok(fails(r, "V1").some((f) => /routing order 1 is used 2 times/.test(f.message)));
});

test("V2 tool names: a backticked tool-like token must exist", async () => {
  const r = await check(prepare("v2", { before: (root) => addPrecondition(root, "3. Never call `get_secret_sauce`.") }));
  assertFailsOnly(base, r, "V2", /get_secret_sauce/);
});

test("V3 ownership: every snapshot tool is owned and every named tool is in owns ∪ uses", async () => {
  const r = await check(
    prepare("v3", { before: (root) => editJson(root, "skills/lpm-start/skill.json", (m) => void (m.owns = m.owns.filter((t) => t !== "search_help_articles"))) }),
  );
  assertFailsOnly(base, r, "V3", /search_help_articles has no owner/);
  assert.ok(fails(r, "V3").some((f) => /names search_help_articles, which is not in owns or uses/.test(f.message)));
});

test("V4 cards ↔ snapshot: required inputs must match", async () => {
  const r = await check(
    prepare("v4", {
      before: (root) =>
        editJson(root, "catalog/cards/portfolio.json", (cards) => {
          cards.find((c) => c.name === "get_issue").inputs[0].required = false;
        }),
    }),
  );
  assertFailsOnly(base, r, "V4", /get_issue: card required/);
});

test("V4 errata: a card that matches a badPattern fails", async () => {
  const r = await check(
    prepare("v4e", {
      before: (root) =>
        editJson(root, "catalog/cards/portfolio.json", (cards) => {
          cards.find((c) => c.name === "update_issue").gotchas[0].text = "Note: blocked is a valid status here.";
        }),
    }),
  );
  assertFailsOnly(base, r, "V4", /matches errata badPattern/);
});

test("V4 idempotency vocabulary: label, keyed param and declared idempotencyKey", async () => {
  const r = await check(
    prepare("v4i", {
      before: (root) =>
        editJson(root, "catalog/cards/portfolio.json", (cards) => {
          cards.find((c) => c.name === "update_issue").idempotency = "sometimes";
          cards.find((c) => c.name === "list_comments").idempotency = "keyed by commandId";
          cards.find((c) => c.name === "get_issue").idempotency = "idempotencyKey supported";
          cards.find((c) => c.name === "create_comment").idempotency = "not idempotent";
        }),
    }),
  );
  assertFailsOnly(base, r, "V4", /update_issue: idempotency "sometimes" is not one of/);
  const msgs = fails(r, "V4").map((f) => f.message);
  assert.ok(msgs.some((m) => /list_comments: idempotency "keyed by commandId" but the LPM schema has no parameter commandId/.test(m)), msgs.join("\n"));
  assert.ok(msgs.some((m) => /get_issue: idempotency "idempotencyKey supported" but the LPM schema declares no idempotencyKey/.test(m)));
  assert.ok(msgs.some((m) => /create_comment: the LPM schema declares idempotencyKey but the card says "not idempotent"/.test(m)));
});

test("V4 card files: LF, sorted by name, pairsWith without self or repeats", async () => {
  const r = await check(
    prepare("v4f", {
      before: (root) => {
        editJson(root, "catalog/cards/workspace.json", (cards) => {
          cards.reverse();
          const c = cards.find((x) => x.name === "list_workspaces");
          c.pairsWith = ["list_workspaces", "get_mcp_connection_info", "get_mcp_connection_info"];
        });
        edit(root, "catalog/cards/portfolio.json", (t) => t.replace(/\n/g, "\r\n"));
      },
    }),
  );
  assertFailsOnly(base, r, "V4", /workspace\.json: cards are not sorted by name/);
  const msgs = fails(r, "V4").map((f) => f.message);
  assert.ok(msgs.some((m) => /portfolio\.json: line endings must be LF/.test(m)));
  assert.ok(msgs.some((m) => /list_workspaces: pairsWith names the tool itself/.test(m)));
  assert.ok(msgs.some((m) => /list_workspaces: pairsWith repeats get_mcp_connection_info/.test(m)));
});

test("V16 jobs: a skill.json job that routes elsewhere is a warning", async () => {
  const r = await check(prepare("v16j", { before: (root) => editJson(root, "skills/lpm-start/skill.json", (m) => void m.jobs.push("deploy the LPM product now")) }));
  assert.equal(warns(base, "V16").length, 0);
  assert.ok(warns(r, "V16").some((w) => /job "deploy the LPM product now" routes to lpm-release-product \(row 4\), not to lpm-start/.test(w.message)));
  assert.equal(fails(r, "V16").length, 0);
});

test("V20 trace flows: the flow's skill exists and names every expected tool", async () => {
  const flow = (skill, tool) => ({
    id: "demo",
    skill,
    request: "x",
    ownerInstruction: null,
    fixtures: { [tool]: {} },
    expect: { orderedCalls: [{ tool, args: {} }], forbiddenCalls: [], requiresVerify: [{ after: tool, read: "get_issue" }], ownerOnlyTools: [] },
  });
  const ok = prepare("v20-ok", { before: (root) => fs.mkdirSync(path.join(root, "evals/trace"), { recursive: true }) || fs.writeFileSync(path.join(root, "evals/trace/demo.json"), JSON.stringify(flow("lpm-deliver-activity", "get_issue"))) });
  assert.equal(fails(await check(ok), "V20").length, 0);
  const r = await check(
    prepare("v20", {
      before: (root) => {
        fs.mkdirSync(path.join(root, "evals/trace"), { recursive: true });
        fs.writeFileSync(path.join(root, "evals/trace/demo.json"), JSON.stringify(flow("lpm-deliver-activity", "search_help_articles")));
        fs.writeFileSync(path.join(root, "evals/trace/ghost.json"), JSON.stringify(flow("lpm-nope", "get_issue")));
      },
    }),
  );
  assertFailsOnly(base, r, "V20", /demo\.json: expects search_help_articles, which lpm-deliver-activity never names/);
  assert.ok(fails(r, "V20").some((f) => /ghost\.json: skill "lpm-nope" does not exist/.test(f.message)));
});

test("V4g gotcha provenance: warning first, failure when the policy says fail", async () => {
  const drop = (root) =>
    editJson(root, "catalog/cards/portfolio.json", (cards) => {
      delete cards.find((c) => c.name === "update_issue").gotchas[0].verifiedFrom;
    });
  const warned = await check(prepare("v4g", { before: drop }));
  assert.equal(warns(base, "V4g").length, 0);
  assert.ok(warns(warned, "V4g").some((w) => /update_issue: gotcha 1 has no verifiedFrom/.test(w.message)));
  assert.equal(fails(warned, "V4g").length, 0);
  const failed = await check(
    prepare("v4g-fail", {
      before: (root) => {
        drop(root);
        editJson(root, "catalog/contracts.json", (c) => void (c.policy.gotchaVerifiedFrom = "fail"));
      },
    }),
  );
  assertFailsOnly(base, failed, "V4g", /no verifiedFrom/);
});

test("V4w effect vs accessLevel mismatch is a warning", async () => {
  const r = await check(
    prepare("v4w", {
      before: (root) =>
        editJson(root, "catalog/cards/portfolio.json", (cards) => void (cards.find((c) => c.name === "list_comments").effect = "write")),
    }),
  );
  assert.equal(warns(base, "V4w").length, 0);
  assert.ok(warns(r, "V4w").some((w) => /list_comments: card effect "write" vs LPM accessLevel "read"/.test(w.message)));
  assert.equal(fails(r, "V4w").length, 0);
});

test("V5 authority: sensitive autonomous tools need a keep|raise decision", async () => {
  const r = await check(prepare("v5", { before: (root) => editJson(root, "catalog/authority-overrides.json", (o) => void (o.sensitiveAutonomous = [])) }));
  assertFailsOnly(base, r, "V5", /create_api_key is sensitive and carded autonomous/);
});

test("V5 authority: a step tag weaker than the rendered authority fails", async () => {
  const r = await check(prepare("v5b", { before: (root) => edit(root, DELIVER_SRC, (t) => t.replace("(workspaceId) [O]", "(workspaceId) [A]")) }));
  assertFailsOnly(base, r, "V5", /configure_aish_budget is tagged \[A\] but renders \[O\]/);
});

test("V5 authority: an [O] tool used in §4 needs a §6 row", async () => {
  const r = await check(
    prepare("v5c", { before: (root) => edit(root, DELIVER_SRC, (t) => t.replace(/^\| \{\{tool:configure_aish_budget\}\} without.*\n/m, "")) }),
  );
  assertFailsOnly(base, r, "V5", /\[O\] tool configure_aish_budget is used in §4–§5 but has no §6/);
});

test("V6 alias policy: steps never name an alias", async () => {
  const r = await check(prepare("v6", { before: (root) => addPrecondition(root, "3. Dates: never `update_project_issue_due_date`.") }));
  assertFailsOnly(base, r, "V6", /names the alias update_project_issue_due_date/);
});

test("V7 structure: headings, banned words and IDs passed in §5", async () => {
  const r = await check(
    prepare("v7", {
      before: (root) =>
        edit(root, DELIVER_SRC, (t) =>
          t
            .replace("## 7. Verify\n", "")
            .replace("2. Read-only request", "2. Maybe ask first. Read-only request")
            .replace("{{tool:get_issue}}(projectId, issueId) → keep `status`.", "{{tool:get_issue}}(projectId, activityId) → keep `status`."),
        ),
    }),
  );
  assertFailsOnly(base, r, "V7", /headings: missing "## 7\. Verify"/);
  assert.ok(fails(r, "V7").some((f) => /banned word "maybe"/.test(f.message)));
  assert.ok(fails(r, "V7").some((f) => /passes activityId to get_issue/.test(f.message)));
});

test("V7 structure: a write procedure must be closed by Verify:", async () => {
  const r = await check(prepare("v7b", { before: (root) => edit(root, DELIVER_SRC, (t) => t.replace(/^3\. Verify: \{\{tool:list_comments\}\}.*\n/m, "")) }));
  assertFailsOnly(base, r, "V7", /P2: no "Verify:" step after its last write/);
});

test("V8 links: {{ref:}} must be bundled and generic files hold no relative links", async () => {
  const r = await check(
    prepare("v8", {
      before: (root) => addPrecondition(root, "3. See {{ref:missing-ref}}."),
      after: (root) => edit(root, "dist/generic/lpm-start.md", (t) => `${t}See [x](references/x.md).\n`),
    }),
  );
  assertFailsOnly(base, r, "V8", /\{\{ref:missing-ref\}\} is not in this skill's bundle/);
  assert.ok(fails(r, "V8").some((f) => /generic files must not hold relative links/.test(f.message)));
});

test("V8 links: a relative link must resolve inside the bundle", async () => {
  const r = await check(prepare("v8b", { after: (root) => edit(root, "dist/codex/lpm-start/SKILL.md", (t) => `${t}[gone](references/gone.md)\n`) }));
  assertFailsOnly(base, r, "V8", /link references\/gone\.md does not resolve/);
});

test("V9 CLI mentions must match a CLI snapshot key", async () => {
  const r = await check(prepare("v9", { before: (root) => addPrecondition(root, "3. Run `lpm issues frobnicate --all`.") }));
  assertFailsOnly(base, r, "V9", /`lpm issues frobnicate` matches no CLI snapshot key/);
});

test("V10 endpoint: run.app URLs are rejected outside the internal candidate exemption", async () => {
  const r = await check(prepare("v10", { before: (root) => addPrecondition(root, "3. Candidate: https://lpm-candidate---lpm-abc123-uc.a.run.app") }));
  assertFailsOnly(base, r, "V10", /\*\.run\.app URLs are not allowed/);
  const mcp = await check(prepare("v10b", { before: (root) => addPrecondition(root, "3. Endpoint http://lpm.rocks/mcp") }));
  assert.ok(fails(mcp, "V10").some((f) => /must be exactly https:\/\/lpm\.rocks\/mcp/.test(f.message)));
});

test("V11 target conformance: claude-code carries no prefixed allowed-tools", async () => {
  const r = await check(
    prepare("v11", { after: (root) => edit(root, "dist/claude-code/lpm-start/SKILL.md", (t) => t.replace("\n---\n", "\nallowed-tools: mcp__lpm__get_issue\n---\n")) }),
  );
  assertFailsOnly(base, r, "V11", /prefixed allowed-tools/);
});

test("V12 behavior contracts and LPM parity contracts hold in dist/", async () => {
  const r = await check(
    prepare("v12", {
      before: (root) => {
        editJson(root, "catalog/behavior-contracts.json", (b) => void b.contracts[0].assertions.push({ kind: "contains", text: "PHRASE-NOT-THERE", caseSensitive: true }));
        editJson(root, "catalog/contracts.json", (c) => void c.contracts[0].phrases.push("NOT-RENDERED"));
      },
    }),
  );
  assertFailsOnly(base, r, "V12", /behavior contract delivery-trailer \(codex\): "PHRASE-NOT-THERE" is missing/);
  assert.ok(fails(r, "V12").some((f) => /parity contract activity-evidence: .* does not contain "NOT-RENDERED"/.test(f.message)));
});

test("V13 secrets and denylist literals (example: lines are exempt)", async () => {
  const r = await check(
    prepare("v13", {
      before: (root) => {
        addPrecondition(root, "3. Ask Rafael first.");
        edit(root, "shared/references/ids-and-sources.md", (t) => `${t}Key: lpm_mcp_ABCDEFGH1234\n`);
      },
    }),
  );
  assertFailsOnly(base, r, "V13", /denylisted literal \(pilot-person\)/);
  assert.ok(fails(r, "V13").some((f) => /possible secret \(lpm-mcp-credential\)/.test(f.message)));
  const ex = await check(prepare("v13-ex", { before: (root) => addPrecondition(root, "- example: Rafael asked for a report.") }));
  assert.equal(fails(ex, "V13").length, 0, JSON.stringify(fails(ex, "V13")));
});

test("V14 sizes: description above 330 characters fails", async () => {
  const r = await check(
    prepare("v14", { before: (root) => editJson(root, "skills/lpm-start/skill.json", (m) => void (m.description = `${m.description} ${"x".repeat(330)}`)) }),
  );
  assertFailsOnly(base, r, "V14", /description is \d+ characters \(max 330\)/);
});

test("V14 sizes: SKILL.md above 200 lines fails", async () => {
  const filler = Array.from({ length: 200 }, (_, i) => `${i + 3}. Rule ${i + 3}.`).join("\n");
  const r = await check(prepare("v14b", { before: (root) => addPrecondition(root, filler) }));
  assertFailsOnly(base, r, "V14", /SKILL\.md: \d+ lines \(max 200\)/);
});

test("V15 drift: a hand-edited or stale dist file and a stale sourcesHash fail", async () => {
  const r = await check(
    prepare("v15", {
      after: (root) => {
        edit(root, "dist/codex/lpm-start/SKILL.md", (t) => `${t}hand edit\n`);
        fs.writeFileSync(path.join(root, "dist/codex/lpm-start/references/stale.md"), "stale\n");
        edit(root, "shared/references/ids-and-sources.md", (t) => `${t}One more fact.\n`);
      },
    }),
  );
  assertFailsOnly(base, r, "V15", /dist\/codex\/lpm-start\/SKILL\.md differs from a fresh build/);
  assert.ok(fails(r, "V15").some((f) => /stale\.md is not produced by the build/.test(f.message)));
  assert.ok(fails(r, "V15").some((f) => /sourcesHash .* != recomputed/.test(f.message)));
});

test("V16 router: every core skill has a row and eval --router must pass", async () => {
  const r = await check(prepare("v16", { before: (root) => editJson(root, "skills/lpm-start/skill.json", (m) => void (m.routing = [])) }));
  assertFailsOnly(base, r, "V16", /core skill has no routing row/);
  const evalFail = await check(prepare("v16b"), { evalRouter: async ({ log }) => (log.info("miss: connect my agent"), 1) });
  assert.ok(fails(evalFail, "V16").some((f) => /eval --router is below 100 % \(exit 1\): miss: connect my agent/.test(f.message)));
});

test("V16 router: the real router.mjs scores the fixture at 100 %", async () => {
  const r = await validate(loadModel(prepare("v16-real")), { today: OPTS.today, only: ["V16"] });
  assert.deepEqual(r.failures, []);
});

test("V17 external: files_sha256 must match and status must be valid", async () => {
  const r = await check(
    prepare("v17", {
      before: (root) => {
        edit(root, "external/demo/codex/demo/SKILL.md", (t) => `${t}local patch\n`);
        editJson(root, "external/demo/metadata.json", (m) => void (m.upstream_ref = "main"));
      },
    }),
  );
  assertFailsOnly(base, r, "V17", /sha256 differs from files_sha256/);
  assert.ok(fails(r, "V17").some((f) => /must pin upstream_ref/.test(f.message)));
});

test("V18 snapshot --check runs only with --lpm", async () => {
  const root = prepare("v18");
  let calls = 0;
  const ok = await check(root, { lpm: "/nonexistent/lpm", runSnapshot: () => (calls++, { exitCode: 0, changed: [], stubs: [] }) });
  assert.equal(calls, 1);
  assert.equal(fails(ok, "V18").length, 0);
  const none = await check(root, { runSnapshot: () => (calls++, { exitCode: 1 }) });
  assert.equal(calls, 1, "V18 must not run without --lpm");
  assert.equal(fails(none, "V18").length, 0);
  const bad = await check(root, { lpm: "/nonexistent/lpm", runSnapshot: () => ({ exitCode: 1, changed: ["catalog/lpm-tools.snapshot.json"], stubs: [] }) });
  assertFailsOnly(ok, bad, "V18", /snapshot differs from LPM: changed catalog\/lpm-tools\.snapshot\.json/);
});

test("V19 rendered completeness: coverage.json rendered paths must exist", async () => {
  const r = await check(prepare("v19", { after: (root) => fs.rmSync(path.join(root, "dist/generic/lpm-start.md")) }));
  assertFailsOnly(base, r, "V19", /rendered\.generic dist\/generic\/lpm-start\.md does not exist/);
});

test("every validator id is covered by this file", () => {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  for (const v of VALIDATORS) assert.ok(src.includes(`"${v}"`) || src.includes(`${v} `), v);
});

// ─── CLI and API ───────────────────────────────────────────────────────────────

const runCli = (args) => spawnSync(process.execPath, [path.join(SCRIPTS, "skills.mjs"), ...args], { encoding: "utf8" });

test("check --json prints {ok, failures, warnings} and exits 0 on the fixture", () => {
  const root = prepare("cli-ok");
  const res = runCli(["check", "--root", root, "--json"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(Object.keys(out), ["ok", "failures", "warnings"]);
  assert.equal(out.ok, true);
  assert.deepEqual(out.failures, []);
});

test("check prints '<validator> <skill|infra> <message>' and exits 1 on failure", () => {
  const root = prepare("cli-fail", {
    before: (r) => {
      editJson(r, "skills/lpm-start/skill.json", (m) => void (m.description = "Connects agents to LPM (conectar)."));
      editJson(r, "catalog/cards/workspace.json", (cards) => void (cards.find((c) => c.name === "list_workspaces").oauthScope = null));
    },
  });
  const res = runCli(["check", "--root", root]);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /^V1 lpm-start description must start with "Use when"/m);
  assert.match(res.stdout, /^V4 infra list_workspaces: card oauthScope null != snapshot workspace:read$/m);
  assert.match(res.stdout, /check: FAILED · \d+ failures/);
  const json = JSON.parse(runCli(["check", "--root", root, "--json"]).stdout);
  assert.equal(json.ok, false);
  assert.ok(json.failures.some((f) => f.validator === "V1" && f.skill === "lpm-start"));
  assert.ok(json.failures.some((f) => f.validator === "V4" && f.skill === null));
});

test("runCheck accepts (model, opts) as well as the dispatcher opts", async () => {
  const root = prepare("api");
  const a = await runCheck(loadModel(root), { log: silent, ...OPTS });
  assert.equal(a.exitCode, 0);
  const b = await runCheck({ root, flags: { json: true }, args: [], log: silent, ...OPTS });
  assert.equal(b.exitCode, 0);
  assert.deepEqual(a.failures, b.failures);
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

test("helpers: glob, example blocks, PT-BR detection and CLI mentions", () => {
  assert.ok(globToRegExp("dist/**").test("dist/codex/x/SKILL.md"));
  assert.ok(globToRegExp("dist/*/lpm-x/**").test("dist/codex/lpm-x/references/a.md"));
  assert.ok(!globToRegExp("dist/*/lpm-x/**").test("dist/codex/lpm-y/a.md"));
  const ex = exampleLines("a\n- example: b\n```text\nexample: c\nd\n```\ne");
  assert.deepEqual([...ex].sort(), [2, 3, 4, 5, 6]);
  assert.ok(hasPtBr("fechar a atividade"));
  assert.ok(hasPtBr("decisão"));
  assert.ok(!hasPtBr("close the activity"));
  assert.deepEqual(
    cliMentions("Run `lpm aish jobs list --json` and `lpm` alone.\n```bash\nlpm issues get --project x\n```").map((m) => m.key.join(" ")),
    ["aish jobs list", "issues get"],
  );
});
