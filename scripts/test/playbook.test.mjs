// Playbook standard (spec revision 3, playbook-standard.md): V20 playbook structure, V21 CALL lines,
// and the R1–R3 rendering of playbook skills. The fixture is the check-repo fixture with its
// lpm-deliver-activity converted to a playbook router (fixtures/playbook-skill overlays it).
// Every rule has a passing case (the base overlay) and a failing mutation of that overlay.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, read, tempDir } from "./helpers.mjs";
import { loadModel } from "../lib/model.mjs";
import { runBuild } from "../lib/build.mjs";
import { validate } from "../lib/validate.mjs";
import { install } from "../lib/install.mjs";
import { isPlaybookSkill, parsePlaybook, playbookIndex, savedNames } from "../lib/playbook.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const OPTS = { today: "2026-10-06", evalRouter: async () => 0 };
const ID = "lpm-deliver-activity";
const SRC = `skills/${ID}/SKILL.src.md`;
const MANIFEST = `skills/${ID}/skill.json`;
const flow = (name) => `skills/${ID}/references/flow-${name}.md`;

function edit(root, rel, fn) {
  const abs = path.join(root, rel);
  const before = fs.readFileSync(abs, "utf8");
  const after = fn(before);
  assert.notEqual(after, before, `mutation of ${rel} changed nothing`);
  fs.writeFileSync(abs, after);
}
/** Replaces exactly one occurrence of `a` with `b` (fails the test when `a` is absent). */
const sub = (a, b) => (t) => {
  assert.ok(t.includes(a), `fixture text not found: ${a}`);
  return t.replace(a, b);
};

/** Fresh check-repo copy with the playbook overlay, then `mutate`, then build. */
function prepare(name, mutate) {
  const root = tempDir(`pb-${name}`);
  fs.cpSync(path.join(FIXTURES, "check-repo"), root, { recursive: true });
  fs.rmSync(path.join(root, `skills/${ID}/references/closure-checklist.md`));
  fs.cpSync(path.join(FIXTURES, "playbook-skill"), root, { recursive: true });
  if (mutate) mutate(root);
  runBuild(root);
  return root;
}

const check = (root, extra = {}) => validate(loadModel(root), { ...OPTS, ...extra });
const PB = ["V20", "V21"];
const findings = (r, list) => list.filter((f) => PB.includes(f.validator));

const base = await check(prepare("base"));

test("the playbook overlay passes every validator with no warnings", () => {
  assert.deepEqual(base.failures, []);
  assert.deepEqual(base.warnings, []);
});

/**
 * Asserts the base overlay has no V20/V21 finding matching `pattern` (passing case) and the
 * mutation fails with it; every V20/V21 failure of the mutation matches `pattern` (one rule broken).
 */
async function assertRule(name, mutate, pattern, { level = "fail", only = true } = {}) {
  const pick = (r) => (level === "fail" ? r.failures : r.warnings);
  assert.equal(findings(base, pick(base)).filter((f) => pattern.test(f.message)).length, 0, `base overlay already reports ${pattern}`);
  const r = await check(prepare(name, mutate), { only: PB });
  const hit = findings(r, pick(r));
  assert.ok(hit.some((f) => pattern.test(f.message)), `no ${level} matches ${pattern}: ${JSON.stringify(findings(r, [...r.failures, ...r.warnings]))}`);
  if (only) {
    const other = findings(r, r.failures).filter((f) => !pattern.test(f.message));
    assert.deepEqual(other, [], `unexpected V20/V21 failures besides ${pattern}`);
  }
  return r;
}

// ─── V20 router ────────────────────────────────────────────────────────────────

test("V20 uses verified effects for reads even when the API requires write access", async () => {
  const root = prepare("read-with-write-access", root => {
    edit(root, "catalog/lpm-tools.snapshot.json", text => {
      const snapshot = JSON.parse(text);
      snapshot.tools.find(t => t.name === "get_issue").accessLevel = "write";
      return JSON.stringify(snapshot, null, 2) + "\n";
    });
  });
  const result = await check(root, { only: PB });
  assert.deepEqual(findings(result, result.failures), []);
});

test("hybrid skills validate their playbooks even without a router index", async () => {
  const root = prepare("hybrid-invalid", root => {
    edit(root, SRC, sub("| Playbook | Use when | File |", "| Procedure | Use when | File |"));
    edit(root, flow("due-date"), sub('"dueDate":"<input:dueDate>"', '"wrongDate":"<input:dueDate>"'));
  });
  const result = await check(root, { only: PB });
  assert.ok(result.failures.some(f => /has no param wrongDate/.test(f.message)));
});

test("V20 rule 1: the router keeps the 10 V7 headings", async () => {
  const r = await check(prepare("r1", (root) => edit(root, SRC, sub("## 7. Verify\n", ""))), { only: ["V7"] });
  assert.ok(r.failures.some((f) => f.validator === "V7" && /headings: missing "## 7\. Verify"/.test(f.message)));
  assert.equal(base.failures.filter((f) => f.validator === "V7").length, 0);
});

test("V20 rule 2: §5 is one index table and holds no ### P<n> procedures", async () => {
  await assertRule("r2", (root) => edit(root, SRC, sub("\n## 6. Stop and ask", "\n### P1 Old procedure\n1. Do it.\n\n## 6. Stop and ask")), /holds no ### P<n>/);
  await assertRule("r2b", (root) => edit(root, SRC, sub("\n## 6. Stop and ask", "\n| A | B |\n|---|---|\n| 1 | 2 |\n\n## 6. Stop and ask")), /§5 must hold exactly one table/);
});

test("V20 rule 3: every playbook file appears in exactly one §5 row", async () => {
  await assertRule("r3", (root) => edit(root, SRC, sub("| budget | change the AISH budget on the owner's order | {{ref:flow-budget}} |\n", "")), /flow-budget\.md must appear in exactly one §5 row \(appears in 0\)/);
  await assertRule("r3b", (root) => edit(root, SRC, sub("| due-date | set the due date of one activity | {{ref:flow-due-date}} |", "| due-date | set the due date of one activity | {{ref:flow-close}} |")), /§5 row due-date: File must be \{\{ref:flow-due-date\}\}/);
});

test("V20 rule 4: §5 Use when = the playbook's Use when line = skill.json loadWhen", async () => {
  await assertRule("r4", (root) => edit(root, SRC, sub("| commit | commit with the LPM-Activity trailer, then comment progress |", "| commit | commit the change |")), /§5 row commit: Use when "commit the change" differs/);
  await assertRule(
    "r4b",
    (root) => edit(root, MANIFEST, sub('"playbook due-date: set the due date of one activity"', '"set a due date"')),
    /skill\.json loadWhen of references\/flow-due-date\.md must be "playbook due-date: set the due date of one activity"/,
  );
});

test("V20 rule 5: a §4 Do cell is one playbook or one read CALL; Auth = the strictest playbook tag", async () => {
  await assertRule(
    "r5",
    (root) =>
      edit(root, SRC, sub('| 1 | read the activity | CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} |', '| 1 | read the activity | CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} then CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} |')),
    /§4 row 1: Do must be "playbook \{\{ref:flow-<name>\}\}"/,
  );
  await assertRule("r5b", (root) => edit(root, SRC, sub("| playbook {{ref:flow-api-key}} | C |", "| playbook {{ref:flow-api-key}} | A |")), /§4 row 5: Auth must be C, the strictest tag in playbook api-key/);
  await assertRule(
    "r5c",
    (root) => edit(root, SRC, sub('CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} | A |', 'CALL {{tool:update_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} | A |')),
    /§4 row 1: a CALL row calls a read tool \(update_issue is write\)/,
  );
});

test("V20 rule 6: a playbook router warns on {{errors:auto}} (V7 does not warn on its absence)", async () => {
  assert.equal(base.warnings.filter((w) => /errors:auto/.test(w.message)).length, 0);
  await assertRule("r6", (root) => edit(root, SRC, sub("## 9. Failures → fix\n", "## 9. Failures → fix\n{{errors:auto}}\n")), /§9 holds \{\{errors:auto\}\}/, { level: "warn" });
});

test("V20 rule 7: the rendered router body is at most 9 KB (warning above 8 KB)", async () => {
  const filler = (n) => Array.from({ length: n }, (_, i) => `${i + 3}. Rule ${i + 3}: ${"keep this router short and move every procedure into a playbook ".repeat(1)}.`).join("\n");
  await assertRule("r7", (root) => edit(root, SRC, sub("\n\n## 3. Inputs", `\n${filler(70)}\n\n## 3. Inputs`)), /SKILL\.md: body is \d+ bytes \(max 9216\)/);
  await assertRule("r7w", (root) => edit(root, SRC, sub("\n\n## 3. Inputs", `\n${filler(32)}\n\n## 3. Inputs`)), /SKILL\.md: body is \d+ bytes \(target ≤ 8192\)/, { level: "warn" });
});

// ─── V20 playbooks ─────────────────────────────────────────────────────────────

test("V20 rule 8: line 1, line 2, the legend line and exactly the three H2 headings", async () => {
  await assertRule("r8", (root) => edit(root, flow("due-date"), sub("# Playbook: due-date\n", "# Due date\n")), /line 1 must be "# Playbook: due-date"/);
  await assertRule("r8b", (root) => edit(root, flow("due-date"), (t) => `${t}\n## Notes\nNothing.\n`), /H2 headings must be exactly/);
  await assertRule("r8c", (root) => edit(root, flow("due-date"), sub("{{partial:playbook-rules}}\n", "\n")), /line 3 must be \{\{partial:playbook-rules\}\}/);
});

test('V20 rule 9: "You need" is | Input | Where it comes from | If missing |', async () => {
  await assertRule("r9", (root) => edit(root, flow("due-date"), sub("| Input | Where it comes from | If missing |", "| Input | Source | If missing |")), /"## You need" must hold a table/);
});

test("V20 rule 10: steps 1..N, at most 15, each a known statement; only the default error line before step 1", async () => {
  await assertRule("r10", (root) => edit(root, flow("close"), sub("3. CALL {{tool:list_comments}}", "4. CALL {{tool:list_comments}}")), /steps must be numbered 1\.\.N without gaps \(expected 3\)/);
  await assertRule("r10b", (root) => edit(root, flow("due-date"), sub("\n## Answer", "3. Tell the user the result.\n\n## Answer")), /step 3: a step starts with CALL/);
  await assertRule("r10c", (root) => edit(root, flow("due-date"), sub("## Steps\n", "## Steps\nRead everything first.\n")), /only the default error line may precede step 1/);
  const many = Array.from({ length: 14 }, (_, i) => `${i + 3}. SAVE: extra${i + 3} = ${i + 3}`).join("\n");
  await assertRule("r10d", (root) => edit(root, flow("due-date"), sub("\n## Answer", `${many}\n\n## Answer`)), /16 steps \(max 15\)/);
});

test("V20 rule 11: sub-lines are indented by 3 spaces, IF lines end in a known then, CALL sub-lines only in FOR EACH", async () => {
  await assertRule("r11", (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", "    SAVE: title = result.title")), /sub-lines are indented by exactly 3 spaces/);
  await assertRule("r11b", (root) => edit(root, flow("api-key"), sub('→ STOP. Say: "Creating an API key needs an LPM API key connection."', "→ stop here")), /IF needs a known "→ …" ending/);
  await assertRule(
    "r11c",
    (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", '   SAVE: title = result.title\n   CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]')),
    /a CALL or RUN sub-line is allowed only inside FOR EACH/,
  );
});

test("V20 rule 12: every write has a VERIFY read and an IF right after it, in its own step", async () => {
  const verify = '   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]\n   IF the call returns an error or result.dueDate != <input:dueDate> → STOP. Say: "The due date of <input:issueId> is not <input:dueDate>."\n';
  await assertRule("r12", (root) => edit(root, flow("due-date"), sub(verify, "")), /write set_project_issue_due_date has no VERIFY sub-line in its step/);
  await assertRule(
    "r12b",
    (root) => edit(root, flow("due-date"), sub('   IF the call returns an error or result.dueDate != <input:dueDate> → STOP. Say: "The due date of <input:issueId> is not <input:dueDate>."\n', "")),
    /VERIFY get_issue must be followed by an IF line/,
  );
  // the IF group after a VERIFY may test an expected result first (a delete reads back "not found")
  const group = await check(
    prepare("r12ok", (root) =>
      edit(root, flow("due-date"), sub("   IF the call returns an error or result.dueDate", '   IF result.dueDate == <input:dueDate> → go to Answer.\n   IF the call returns an error or result.dueDate')),
    ),
    { only: PB },
  );
  assert.deepEqual(findings(group, group.failures), []);
  await assertRule("r12c", (root) => edit(root, flow("due-date"), sub("IF the call returns an error or result.dueDate", "IF result.dueDate")), /the IF after VERIFY get_issue must start "IF the call returns an error or …"/);
  await assertRule("r12d", (root) => edit(root, flow("commit"), sub("   VERIFY: RUN `git -C <input:repo> log -1 --format=%B`\n   IF the output", "   IF the output")), /step 2: write command has no VERIFY sub-line/);
});

test("V20 rule 13: every CALL/RUN has an error line or a default error line that covers it", async () => {
  await assertRule("r13", (root) => edit(root, flow("due-date"), (t) => t.replace(/^Every CALL with no error line: .*\n/m, "")), /has no "IF the call returns an error" line and no default error line covers it/);
  await assertRule(
    "r13b",
    (root) => {
      edit(root, flow("commit"), sub("Every CALL or RUN with no error line", "Every CALL with no error line"));
      edit(root, flow("commit"), sub('   IF the command fails → STOP. Say: "The commit failed: <first error line>."\n', ""));
    },
    /step 2: RUN has no "IF the command fails" line/,
  );
});

test("V20 rule 14: a [C] CALL follows an ASK step, an [O] CALL follows the ONLY IF step", async () => {
  await assertRule(
    "r14",
    (root) =>
      edit(root, flow("api-key"), (t) =>
        sub('2. ASK: "Create API key <input:keyName> in workspace <input:workspaceId>? It is shown once. (yes/no)" — continue only if the user says yes; otherwise STOP.\n', "")(t).replace("3. CALL {{tool:create_api_key}}", "2. CALL {{tool:create_api_key}}"),
      ),
    /\[C\] create_api_key must follow an ASK: step/,
  );
  await assertRule(
    "r14b",
    (root) =>
      edit(root, flow("budget"), (t) =>
        t.replace(/^2\. ONLY IF .*\n/m, "").replace("3. CALL {{tool:configure_aish_budget}}", "2. CALL {{tool:configure_aish_budget}}"),
      ),
    /\[O\] configure_aish_budget must follow an ONLY IF step/,
  );
});

test("V20 rule 15: jumps go forward, never onto a gated CALL; switch names another playbook", async () => {
  await assertRule("r15", (root) => edit(root, flow("close"), sub("   IF <saved:missing> is not empty", "   IF <saved:missing> is empty → go to step 2.\n   IF <saved:missing> is not empty")), /"go to step 2" must jump forward/);
  await assertRule("r15b", (root) => edit(root, flow("api-key"), sub('   IF result.credential == "oauth"', '   IF result.credential == "key" → go to step 3.\n   IF result.credential == "oauth"')), /"go to step 3" lands on a \[C\]\/\[O\] CALL/);
  await assertRule("r15c", (root) => edit(root, flow("api-key"), sub('→ STOP. Say: "Creating an API key needs an LPM API key connection."', "→ switch to playbook connector-only.")), /"switch to playbook connector-only" must name another playbook of this skill/);
});

test("V20 rule 16: a playbook is self-contained (no {{ref:}}, references/, §n; {{skill:}} only in a hand-off STOP)", async () => {
  await assertRule("r16", (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", "   SAVE: title = result.title\n   Follow {{ref:repo-hygiene}} first.")), /must not link another file \(\{\{ref:…\}\}\)/);
  await assertRule("r16b", (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", "   SAVE: title = result.title\n   The rules of SKILL.md §6 apply.")), /must not point to a SKILL\.md section/);
  await assertRule("r16c", (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", "   SAVE: title = result.title\n   Ask {{skill:lpm-start}} for ids.")), /\{\{skill:lpm-start\}\} only in "STOP\. This belongs to skill/);
});

test("V20 rule 17: the Answer is one fenced 5-line block followed by the never-claim rule", async () => {
  await assertRule("r17", (root) => edit(root, flow("due-date"), sub("Pending: none\n", "")), /the Answer block has exactly the lines Scope, Done, Evidence, Pending, Next \(has Scope, Done, Evidence, Next\)/);
  await assertRule("r17b", (root) => edit(root, flow("due-date"), sub("Pending: none\n", "Pending: none\nNotes: x\n")), /the Answer block has exactly the lines/);
  await assertRule("r17c", (root) => edit(root, flow("due-date"), sub("Never claim a date", "Do not report a date")), /never-claim rule/);
  await assertRule(
    "r17d",
    (root) => edit(root, flow("close"), sub("status: backlog | todo | in-progress | done | canceled, from your last get_issue. ", "")),
    /mentions a status but no " \| "-separated list/,
    { level: "warn" },
  );
});

test("V20 rule 18: a playbook source is at most 7 KB (warning above 6 KB) and 110 lines", async () => {
  await assertRule("r18", (root) => edit(root, flow("close"), sub("   Always make this call.", `   Always make this call. ${"Read the comments in order. ".repeat(150)}`)), /flow-close\.md: \d+ bytes \(max 7168\)/);
  await assertRule("r18w", (root) => edit(root, flow("close"), sub("   Always make this call.", `   Always make this call. ${"Read the comments in order. ".repeat(110)}`)), /flow-close\.md: \d+ bytes \(target ≤ 6144\)/, { level: "warn" });
  const cont = Array.from({ length: 80 }, () => "     and keep reading.").join("\n");
  await assertRule("r18b", (root) => edit(root, flow("close"), sub("   Always make this call.", `   Always make this call.\n${cont}`)), /flow-close\.md: \d+ lines \(max 110\)/);
});

test("V20 policy: a kind-tools skill without a playbook index is reported only when policy.playbookRouter is set", async () => {
  const legacy = await check(prepare("pol-off", (root) => fs.rmSync(path.join(root, `skills/${ID}`), { recursive: true }) || fs.cpSync(path.join(FIXTURES, "check-repo", "skills", ID), path.join(root, "skills", ID), { recursive: true })), { only: PB });
  assert.deepEqual(findings(legacy, [...legacy.failures, ...legacy.warnings]), []);
  const setPolicy = (level) => (root) => {
    fs.rmSync(path.join(root, `skills/${ID}`), { recursive: true });
    fs.cpSync(path.join(FIXTURES, "check-repo", "skills", ID), path.join(root, "skills", ID), { recursive: true });
    const p = path.join(root, "catalog/contracts.json");
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    c.policy.playbookRouter = level;
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
  };
  const warned = await check(prepare("pol-warn", setPolicy("warn")), { only: PB });
  assert.ok(warned.warnings.some((w) => w.validator === "V20" && w.skill === ID && /has no \| Playbook \| Use when \| File \| index/.test(w.message)));
  assert.equal(findings(warned, warned.failures).length, 0);
  const failed = await check(prepare("pol-fail", setPolicy("fail")), { only: PB });
  assert.ok(failed.failures.some((f) => f.validator === "V20" && f.skill === ID));
  // lpm-start is kind "tools" too: both legacy skills are reported, never the process skill.
  assert.deepEqual([...new Set(failed.failures.map((f) => f.skill))].sort(), [ID, "lpm-start"]);
});

// ─── V21 CALL lines ────────────────────────────────────────────────────────────

test("V21 rule 1: CALL {{tool:x}} {json} [A|C|O]; a §4 CALL row carries no tag", async () => {
  await assertRule("v1", (root) => edit(root, flow("due-date"), (t) => t.replace('{"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]\n   SAVE: title', '{"projectId":"<input:projectId>","issueId":"<input:issueId>"}\n   SAVE: title')), /CALL must read "CALL \{\{tool:<name>\}\} \{json\} \[A\|C\|O\]"/);
  await assertRule(
    "v1b",
    (root) => edit(root, SRC, sub('{"projectId":"<input:projectId>","issueId":"<input:issueId>"} | A | not found', '{"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A] | A | not found')),
    /§4 row 1: CALL must read "CALL \{\{tool:<name>\}\} \{json\}" with no tag/,
  );
});

test("V21 rule 2: the tool is in the snapshot and in owns ∪ uses", async () => {
  await assertRule("v2", (root) => edit(root, flow("api-key"), sub("1. CALL {{tool:get_mcp_connection_info}} {} [A]", "1. CALL {{tool:list_workspaces}} {} [A]")), /list_workspaces is not in owns ∪ uses/);
  await assertRule("v2b", (root) => edit(root, flow("api-key"), sub("1. CALL {{tool:get_mcp_connection_info}} {} [A]", "1. CALL {{tool:get_secret_sauce}} {} [A]")), /get_secret_sauce is not in the snapshot/);
});

test("V21 rule 3: the arguments are one JSON object", async () => {
  await assertRule("v3", (root) => edit(root, flow("due-date"), sub('1. CALL {{tool:get_issue}} {"projectId":', "1. CALL {{tool:get_issue}} {projectId:")), /get_issue arguments are not valid JSON/);
});

test("V21 rule 4: every required param, no unknown param (the eval failures F2/F3)", async () => {
  await assertRule("v4", (root) => edit(root, flow("due-date"), sub('{"projectId":"<input:projectId>","issueId":"<input:issueId>","dueDate"', '{"projectId":"<input:projectId>","dueDate"')), /set_project_issue_due_date misses required param issueId/);
  await assertRule("v4b", (root) => edit(root, flow("due-date"), sub('"dueDate":"<input:dueDate>"}', '"dueDate":"<input:dueDate>","targetId":"x","limitCount":5}')), /set_project_issue_due_date has no param (targetId|limitCount)/);
});

test("V21 rule 5: scalar params accept typed bindings and literals, never free slots", async () => {
  const addLimit = (root) => {
    const p = path.join(root, "catalog/lpm-tools.snapshot.json");
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    s.tools.find((t) => t.name === "list_comments").params.limit = "number";
    fs.writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
  };
  const withLimit = (value) => (root) => {
    addLimit(root);
    edit(root, flow("close"), sub('3. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"}', `3. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","limit":${value}}`));
  };
  const ok = await check(prepare("v5ok", withLimit("200")), { only: PB });
  assert.deepEqual(findings(ok, ok.failures), []);
  const bound = await check(prepare("v5bound", withLimit('"<saved:status>"')), { only: PB });
  assert.deepEqual(findings(bound, bound.failures), []);
  await assertRule("v5", withLimit('"<limit>"'), /list_comments param limit requires a whole sourced placeholder/);
  await assertRule("v5missing", withLimit('"<saved:unknown>"'), /<saved:unknown> is used before any SAVE/);
  await assertRule("v5b", withLimit('"200"'), /list_comments param limit must be a number literal \(has string\)/);
  await assertRule("v5c", (root) => edit(root, flow("close"), sub('"content":"Closure check: <input:testResults>"', '"content":"Closure check: <the results>"')), /create_comment param content holds the free slot <the results>/);
});

test("V21 rule 6: every <input:x> has a You need row (a §3 Inputs row in a §4 CALL row)", async () => {
  await assertRule("v6", (root) => edit(root, flow("due-date"), sub('Say: "Which due date? (yyyy-mm-dd)"', 'Say: "Which due date for <input:ghost>?"')), /<input:ghost> has no "You need" row/);
  await assertRule("v6b", (root) => edit(root, SRC, sub('{"projectId":"<input:projectId>","issueId":"<input:issueId>"} | A | not found', '{"projectId":"<input:projectId>","issueId":"<input:activityId>"} | A | not found')), /§4 row 1: <input:activityId> \(get_issue param issueId\) has no §3 Inputs row/);
});

test("V21 rule 7: every <saved:x> is SAVEd on an earlier line (the Answer: anywhere in the steps)", async () => {
  await assertRule("v7", (root) => edit(root, flow("close"), sub('Say: "<input:issueId> is already <saved:status>."', 'Say: "<input:issueId> is already <saved:status> (<saved:closeKey>)."')), /step 1: <saved:closeKey> is used before any SAVE of it/);
  await assertRule("v7b", (root) => edit(root, flow("due-date"), sub("Pending: none\n", "Pending: none | <saved:ghost>\n")), /Answer: <saved:ghost> is never SAVEd in the steps/);
  // a SAVE may put one assignment per continuation line (5+ spaces): every name counts
  const cont = await check(
    prepare("v7c", (root) => edit(root, flow("due-date"), sub("   SAVE: title = result.title", "   SAVE: from result, keep:\n     title = result.title\n     project = result.projectId"))),
    { only: PB },
  );
  assert.deepEqual(findings(cont, cont.failures), []);
  // a SAVE line may use a name assigned earlier on that same line
  const pb = parsePlaybook(read(path.join(FIXTURES, "playbook-skill"), flow("close")));
  assert.ok(pb.steps[0].subs[0].text.includes("<saved:description>"));
  assert.deepEqual(savedNames(pb.steps[0].subs[0].text), ["title", "status", "description", "related"]);
});

test("V21 rule 8: <each:x> only inside FOR EACH", async () => {
  await assertRule("v8", (root) => edit(root, flow("close"), sub("   Always make this call.", "   Always make this call for <each:issueId>.")), /step 3: <each:issueId> outside FOR EACH/);
});

test("V21 rule 9: a tag lower than the rendered authority fails, a stricter one warns", async () => {
  await assertRule("v9", (root) => edit(root, flow("api-key"), sub("[C]\n   SAVE: keyId", "[A]\n   SAVE: keyId")), /create_api_key is tagged \[A\] but renders \[C\]|§4 row 5: Auth must be A/);
  const r = await check(prepare("v9w", (root) => edit(root, flow("commit"), sub("3. CALL {{tool:list_comments}} {\"projectId\":\"<input:projectId>\",\"issueId\":\"<input:issueId>\"} [A]", "3. CALL {{tool:list_comments}} {\"projectId\":\"<input:projectId>\",\"issueId\":\"<input:issueId>\"} [C]"))), { only: PB });
  assert.ok(r.warnings.some((w) => w.validator === "V21" && /list_comments is tagged \[C\], stricter than its rendered \[A\]/.test(w.message)));
});

// ─── Rendering (playbook-standard §9 R1–R3) ────────────────────────────────────

const baseRoot = prepare("render");

test("parse helpers: the overlay router is a playbook skill with five indexed playbooks", () => {
  const model = loadModel(baseRoot);
  const s = model.skillById[ID];
  assert.ok(isPlaybookSkill(s));
  assert.ok(!isPlaybookSkill(model.skillById["lpm-start"]));
  assert.deepEqual(playbookIndex(s.src).rows.map((r) => r.playbook), ["close", "commit", "due-date", "api-key", "budget"]);
});

test("R1/R2: native routers link the contracts without duplicating the full tool catalog", () => {
  for (const target of ["codex", "claude-code", "antigravity"]) {
    const md = read(baseRoot, `dist/${target}/${ID}/SKILL.md`);
    const sec10 = md.slice(md.indexOf("## 10. Tools and references"));
    assert.ok(!/references\/flow-/.test(sec10), `${target}: refs index lists a playbook`);
    assert.match(sec10, /Tool contracts: \[tools\]\(references\/tools\.md\) \(\d+ owned, \d+ borrowed\)/);
    const cards = read(baseRoot, `dist/${target}/${ID}/references/tools.md`);
    assert.match(cards, /get_issue/);
    assert.match(cards, /get_mcp_connection_info/);
    assert.match(md, /\| 2 \| close the activity \| playbook \[flow-close\]\(references\/flow-close\.md\) \| A \|/);
    const pb = read(baseRoot, `dist/${target}/${ID}/references/flow-close.md`);
    assert.match(pb, /^# Playbook: close\nUse when: close the activity, or answer "can I close it\?"\n\nHow to run this playbook:/m);
    assert.match(pb, /^1\. CALL `get_issue` \{"projectId":"<input:projectId>","issueId":"<input:issueId>"\} \[A\]$/m);
  }
  // a legacy skill keeps its per-tool index lines
  assert.match(read(baseRoot, "dist/codex/lpm-start/SKILL.md"), /^- `list_workspaces` \[A\]/m);
});

test("R3: generic playbooks live in <id>.flows.md, in §5 order, headings demoted by one level", () => {
  const files = listFiles(path.join(baseRoot, "dist/generic"));
  assert.ok(files.includes(`${ID}.flows.md`));
  assert.ok(!files.includes("lpm-start.flows.md"), "no flows file for a skill without playbooks");
  const flows = read(baseRoot, `dist/generic/${ID}.flows.md`);
  assert.deepEqual([...flows.matchAll(/^## § (flow-[a-z-]+)$/gm)].map((m) => m[1]), ["flow-close", "flow-commit", "flow-due-date", "flow-api-key", "flow-budget"]);
  assert.match(flows, /^## § flow-close\n\n## Playbook: close\n/m);
  assert.match(flows, /^### You need$/m);
  assert.match(flows, /^### Answer \(reply with exactly this block/m);
  assert.match(flows, /Run only the playbook that `lpm-deliver-activity\.md` names/);
  const refs = read(baseRoot, `dist/generic/${ID}.refs.md`);
  assert.ok(!/§ flow-/.test(refs), "refs.md holds no playbook");
  const md = read(baseRoot, `dist/generic/${ID}.md`);
  assert.match(md, /\| 2 \| close the activity \| playbook `lpm-deliver-activity\.flows\.md` § flow-close \| A \|/);
  assert.match(md, /\| close \| close the activity, or answer "can I close it\?" \| `lpm-deliver-activity\.flows\.md` § flow-close \|/);
  assert.ok(!/see `lpm-deliver-activity\.flows\.md`/.test(md), 'no "see " before a playbook link');
  assert.ok(!/## Reference summaries/.test(md));
  assert.match(md, /Tool contracts: `lpm-deliver-activity\.tools\.md`/);
  const index = read(baseRoot, "dist/generic/INDEX.md");
  assert.match(index, /then exactly one `<id>\.md` from this folder\. When that file names a playbook, read that one playbook in `<id>\.flows\.md`/);
});

test("R3: install --agent generic copies <id>.flows.md and verify accepts it", async () => {
  const home = tempDir("pb-gen-home");
  const dest = path.join(home, "gen");
  const log = { info() {}, warn() {}, error() {} };
  const r = await install({ root: baseRoot, flags: { agent: "generic", dest }, args: [], log, env: { HOME: home }, cwd: home });
  assert.equal(r.exitCode, 0);
  const got = listFiles(dest);
  for (const f of [`${ID}.md`, `${ID}.flows.md`, `${ID}.refs.md`, `${ID}.tools.md`]) assert.ok(got.includes(f), f);
  assert.equal(read(dest, `${ID}.flows.md`), read(baseRoot, `dist/generic/${ID}.flows.md`));
});

test("V12 bundle scope: <id>.flows.md is part of a generic bundle when it exists", async () => {
  const r = await check(
    prepare("v12flows", (root) => {
      const p = path.join(root, "catalog/behavior-contracts.json");
      const b = JSON.parse(fs.readFileSync(p, "utf8"));
      b.scopes.bundle.generic = ["dist/generic/<id>.md", "dist/generic/<id>.flows.md", "dist/generic/<id>.refs.md", "dist/generic/<id>.tools.md"];
      b.contracts.push({ id: "playbook-phrase", skills: [ID, "lpm-start"], targets: ["generic"], scope: "bundle", section: null, assertions: [{ kind: "contains", text: "How to run this playbook:", caseSensitive: true }] });
      fs.writeFileSync(p, JSON.stringify(b, null, 2) + "\n");
    }),
    { only: ["V12"] },
  );
  const msgs = r.failures.map((f) => `${f.skill}: ${f.message}`);
  assert.ok(!msgs.some((m) => m.startsWith(`${ID}:`)), msgs.join("\n")); // found in lpm-deliver-activity.flows.md
  assert.ok(msgs.some((m) => /^lpm-start: behavior contract playbook-phrase \(generic\): "How to run this playbook:" is missing from the bundle/.test(m)), msgs.join("\n"));
  assert.ok(!msgs.some((m) => /lpm-start\.flows\.md does not exist/.test(m)), "a missing flows file is optional");
});
