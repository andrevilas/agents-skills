// coverage.json schema v2 (§5.5), sourcesHash, coverage matrix, README block, compat files (§6.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixtureCopy, read } from "./helpers.mjs";
import { runBuild } from "../lib/build.mjs";
import { loadModel } from "../lib/model.mjs";
import { applyReadmeBlock, computeSourcesHash, sourcePaths, README_BEGIN, README_END } from "../lib/coverage.mjs";
import { renderedPaths } from "../lib/render.mjs";
import { sha256 } from "../lib/fs.mjs";

test("coverage.json has exactly the schema v2 shape of §5.5", () => {
  const root = fixtureCopy("cov");
  runBuild(root);
  const cov = JSON.parse(read(root, "catalog/coverage.json"));
  assert.deepEqual(Object.keys(cov), ["schemaVersion", "generatedBy", "source", "snapshot", "policy", "skills", "tools", "pending", "contracts", "totals"]);
  assert.equal(cov.schemaVersion, 2);
  assert.equal(cov.generatedBy, "agents-skills scripts/skills.mjs build");
  assert.deepEqual(Object.keys(cov.source), ["repo", "sourcesHash"]);
  assert.equal(cov.source.repo, "andrevilas/agents-skills");
  assert.match(cov.source.sourcesHash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(cov.snapshot, {
    lpmCommit: "0000000000000000000000000000000000000000",
    toolCount: 11,
    cliCount: 2,
    namesHash: "sha256:fixture-names",
    schemaHash: "sha256:fixture-schema",
    cliHash: "sha256:fixture-cli",
  });
  assert.deepEqual(cov.policy, { schemaDrift: "warn" });
  assert.deepEqual(cov.skills.map((s) => s.id), ["lpm-deliver-activity", "lpm-release-product", "lpm-roadmap", "lpm-start"]);
  for (const s of cov.skills) {
    assert.deepEqual(Object.keys(s), ["id", "version", "pack", "kind", "owns", "uses", "rendered"]);
    assert.deepEqual(s.rendered, renderedPaths(s.id));
    assert.deepEqual(Object.keys(s.rendered), ["codex", "claude-code", "antigravity", "generic"]);
    for (const p of Object.values(s.rendered)) assert.ok(fs.existsSync(path.join(root, p)), p);
    assert.deepEqual(s.owns, [...s.owns].sort());
  }
  const keys = Object.keys(cov.tools);
  assert.deepEqual(keys, [...keys].sort());
  const up = cov.tools.upload_activity_attachment;
  assert.deepEqual(Object.keys(up), ["owner", "usedBy", "category", "accessLevel", "sensitive", "oauthScope", "required", "cardAuthority", "renderedAuthority", "renderedIn"]);
  assert.equal(up.owner, "lpm-deliver-activity");
  assert.deepEqual(up.usedBy, ["lpm-release-product"]);
  assert.equal(up.cardAuthority, "autonomous");
  assert.equal(up.renderedAuthority, "A");
  assert.ok(up.renderedIn.includes("dist/generic/lpm-deliver-activity.md"));
  assert.equal(cov.tools.create_workspace_roadmap.cardAuthority, "confirm-with-user");
  assert.equal(cov.tools.create_workspace_roadmap.renderedAuthority, "O");
  assert.equal(cov.tools.get_orphan_report.owner, null);
  assert.deepEqual(cov.pending, [{ tool: "get_orphan_report", reason: "fixture: card not written yet", until: "2099-01-01", approvedBy: "owner" }]);
  assert.deepEqual(cov.totals, { tools: 11, owned: 10, pending: 1, unowned: 0, skills: 4, oauthReachable: 3 });
});

test("contracts resolve renderIn to the rendered files of the owner, listed skills or every skill", () => {
  const root = fixtureCopy("contracts");
  runBuild(root);
  const cov = JSON.parse(read(root, "catalog/coverage.json"));
  const byId = Object.fromEntries(cov.contracts.map((c) => [c.id, c]));
  assert.deepEqual(cov.contracts.map((c) => c.id), ["activity-evidence", "delivery-trailer", "missing-tool-fallback"]);
  for (const c of cov.contracts) assert.deepEqual(Object.keys(c), ["id", "tools", "phrases", "renderIn"]);
  const deliver = Object.values(renderedPaths("lpm-deliver-activity")).sort();
  assert.deepEqual(byId["activity-evidence"].renderIn, deliver);
  assert.deepEqual(byId["delivery-trailer"].renderIn, [...deliver, ...Object.values(renderedPaths("lpm-release-product"))].sort());
  assert.equal(byId["missing-tool-fallback"].renderIn.length, 16);
  // The contracts actually hold in the rendered files (what LPM F6 checks).
  for (const c of cov.contracts) {
    for (const file of c.renderIn) {
      const text = read(root, file);
      for (const t of c.tools) assert.match(text, new RegExp(`(?<![a-z0-9_])${t}(?![a-z0-9_])`), `${c.id}: ${t} in ${file}`);
      for (const ph of c.phrases) assert.ok(text.includes(ph), `${c.id}: ${ph} in ${file}`);
    }
  }
});

test("sourcesHash is the §5.5 function of the source tree and ignores generated and gitignored files", () => {
  const root = fixtureCopy("hash");
  const model = loadModel(root);
  const paths = sourcePaths(root, model);
  assert.ok(paths.includes("catalog/aliases.json"));
  assert.ok(paths.includes("shared/references/repo-hygiene.md"));
  assert.ok(paths.includes("skills/lpm-start/skill.json"));
  assert.ok(!paths.includes("catalog/scratch.tmp"), ".gitignore respected");
  assert.ok(!paths.some((p) => p.startsWith("dist/") || p === "README.md"));
  const expected = `sha256:${sha256(paths.map((p) => `${p}\0${sha256(fs.readFileSync(path.join(root, p)))}\n`).join(""))}`;
  assert.equal(computeSourcesHash(root, model), expected);

  runBuild(root);
  const before = JSON.parse(read(root, "catalog/coverage.json")).source.sourcesHash;
  assert.equal(before, expected, "build writes the hash of the sources it read");
  assert.ok(!sourcePaths(root, loadModel(root)).includes("catalog/coverage.json"));
  assert.ok(!sourcePaths(root, loadModel(root)).some((p) => p.includes("targets/codex/legacy-orchestrator/SKILL.md")), "compat outputs excluded");
  runBuild(root);
  assert.equal(JSON.parse(read(root, "catalog/coverage.json")).source.sourcesHash, before, "stable across rebuilds");
  fs.appendFileSync(path.join(root, "skills/lpm-start/SKILL.src.md"), "\n<!-- edit -->\n");
  runBuild(root);
  assert.notEqual(JSON.parse(read(root, "catalog/coverage.json")).source.sourcesHash, before, "a source edit changes the hash");
});

test("compat files carry the LPM legacy tool mentions and the deprecation line", () => {
  const root = fixtureCopy("compat");
  runBuild(root);
  const model = loadModel(root);
  for (const f of model.catalog.compat.files) {
    const text = read(root, f.path);
    for (const t of f.tools) assert.ok(text.includes(t), `${f.path} mentions ${t}`);
    for (const ph of f.phrases) assert.ok(text.includes(ph), `${f.path} has "${ph}"`);
  }
  const skill = read(root, "skills/legacy-orchestrator/targets/codex/legacy-orchestrator/SKILL.md");
  assert.match(skill, /^---\nname: legacy-orchestrator\ndescription: "Deprecated: see lpm-deliver-activity\./);
  assert.ok(skill.includes("<!-- GENERATED by agents-skills scripts/skills.mjs from catalog/compat.json (transition only) — do not edit -->"));
  const playbook = read(root, "skills/legacy-orchestrator/targets/antigravity/legacy-orchestrator/PLAYBOOK.md");
  assert.ok(playbook.startsWith("<!-- GENERATED"), "non-SKILL compat files have no frontmatter");
  assert.ok(playbook.includes("Deprecated: see lpm-deliver-activity."));
  // compat outputs are excluded from skill discovery
  assert.ok(!model.skillById["legacy-orchestrator"]);
});

test("coverage matrix is generated from coverage.json with totals, tools by category, contracts and process rules", () => {
  const root = fixtureCopy("matrix");
  runBuild(root);
  const m = read(root, "docs/lpm-coverage-matrix.md");
  assert.ok(m.startsWith("<!-- GENERATED by agents-skills scripts/skills.mjs from catalog/coverage.json — do not edit -->\n# LPM coverage matrix"));
  assert.match(m, /\| 11 \| 10 \| 1 \| 0 \| 4 \| 3 \|/);
  assert.match(m, /^### portfolio$/m);
  assert.match(m, /^\| `create_workspace_roadmap` \| `lpm-roadmap` \| O \| roadmap:manage \| — \|$/m);
  assert.match(m, /^\| `get_orphan_report` \| \*\*unowned\*\* \|/m);
  assert.match(m, /^\| `lpm-deliver-activity` \| core \| tools \| 8 \| 7\/1\/0 \| 1 \| mostly KEY \| 1 \|$/m);
  assert.ok(m.includes("| get_mcp_connection_info first when a tool is missing | core rule 2; contract missing-tool-fallback |"));
  assert.ok(m.includes("| `get_orphan_report` | fixture: card not written yet | 2099-01-01 | owner |"));
  assert.ok(!m.includes("Cobertura funcional completa"));
});

test("README: only the block between the markers is regenerated", () => {
  const root = fixtureCopy("readme");
  runBuild(root);
  const r = read(root, "README.md");
  assert.ok(r.startsWith("# fixture\n\nHand-written intro (PT-BR).\n\n<!-- GENERATED:catalog -->\n"));
  assert.ok(r.endsWith("<!-- /GENERATED:catalog -->\n\nFooter kept.\n"));
  assert.ok(!r.includes("stale block"));
  assert.match(r, /\| `lpm-roadmap` \| Use when reading or changing the roadmap \(roadmap, pedido de mudanca\)\. \| OAuth ok \| 1 \|/);
  assert.match(r, /\| `connector` \| `lpm-deliver-activity`, `lpm-roadmap`, `lpm-start` \|/);
  assert.match(r, /\| `internal` \(`--include-internal`, user scope\) \| `lpm-release-product` \|/);
  assert.match(r, /\| `demo` \| active \| https:\/\/example\.invalid\/demo\.git \| abc123 \|/);
  assert.ok(r.includes("node scripts/skills.mjs install --agent generic --dest <dir> --profile core"));
  // markers absent → the block is appended once and then replaced in place
  const appended = applyReadmeBlock("# x\n", `${README_BEGIN}\nA\n${README_END}`);
  assert.equal(appended, `# x\n\n${README_BEGIN}\nA\n${README_END}\n`);
  assert.equal(applyReadmeBlock(appended, `${README_BEGIN}\nB\n${README_END}`), `# x\n\n${README_BEGIN}\nB\n${README_END}\n`);
});
