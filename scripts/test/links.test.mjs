// Link rendering per target (§4.3, V8): {{ref:}}, {{ref-summary:}}, {{skill:}} and {{tool:}}.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixtureCopy } from "./helpers.mjs";
import { runBuild } from "../lib/build.mjs";

const NATIVE = ["codex", "claude-code", "antigravity"];

function build() {
  const root = fixtureCopy("links");
  return { root, outputs: runBuild(root).outputs };
}

test("native targets render {{ref:}} as relative links that resolve inside the bundle", () => {
  const { root, outputs } = build();
  for (const t of NATIVE) {
    const md = outputs.get(`dist/${t}/lpm-deliver-activity/SKILL.md`);
    assert.ok(md.includes("follow [repo-hygiene](references/repo-hygiene.md)."), t);
    assert.ok(md.includes("([authority-and-owner-decisions](references/authority-and-owner-decisions.md#decision-request))"), t);
    assert.ok(md.includes("Owned tools (full cards: [tools](references/tools.md)):"), t);
    // links inside a reference file are relative to the references/ folder
    const ref = outputs.get(`dist/${t}/lpm-deliver-activity/references/closure-checklist.md`);
    assert.ok(ref.includes("see [repo-hygiene](repo-hygiene.md)"), t);
    // every relative link of every bundle file resolves inside that bundle
    for (const [rel, content] of outputs) {
      if (!rel.startsWith(`dist/${t}/`) || !rel.endsWith(".md")) continue;
      for (const m of content.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
        if (/^[a-z]+:/.test(m[1])) continue;
        const target = path.join(root, path.dirname(rel), m[1]);
        assert.ok(fs.existsSync(target), `${rel} → ${m[1]}`);
      }
    }
  }
  assert.ok(outputs.get("dist/codex/lpm-start/SKILL.md").includes("[route](references/route.md)"));
});

test("generic renders refs as same-folder section pointers and never as relative links", () => {
  const { outputs } = build();
  const md = outputs.get("dist/generic/lpm-deliver-activity.md");
  assert.ok(md.includes("follow `lpm-deliver-activity.refs.md` § repo-hygiene."), "no extra 'see' after 'follow'");
  assert.ok(md.includes("(see `lpm-deliver-activity.refs.md` § authority-and-owner-decisions (#decision-request))"));
  assert.ok(md.includes("- `lpm-deliver-activity.refs.md` § closure-checklist — before update_issue status done"));
  assert.ok(md.includes("- `lpm-deliver-activity.tools.md` — a call fails or a parameter is unclear"), "tool cards have their own file");
  assert.ok(outputs.get("dist/generic/lpm-start.md").includes("see `INDEX.md`"), "route maps to INDEX.md");
  const refs = outputs.get("dist/generic/lpm-deliver-activity.refs.md");
  assert.match(refs, /^## § closure-checklist$/m);
  assert.ok(!/^## § tools$/m.test(refs), "tool cards are not in <id>.refs.md");
  assert.match(refs, /^### Closure checklist$/m, "reference headings are demoted under the § section");
  const cards = outputs.get("dist/generic/lpm-deliver-activity.tools.md");
  assert.match(cards, /^### `upload_activity_attachment` \[A\]/m, "tool cards are in <id>.tools.md");
  for (const [rel, content] of outputs) {
    if (!rel.startsWith("dist/generic/")) continue;
    assert.ok(!/\]\((?![a-z]+:)[^)]+\)/.test(content), `${rel} has a relative link`);
  }
});

test("{{ref-summary:}} inlines the ## Summary; generic appends summaries that were not inlined", () => {
  const { root, outputs } = build();
  const md = outputs.get("dist/codex/lpm-deliver-activity/SKILL.md");
  assert.match(md, /follow \[repo-hygiene\]\(references\/repo-hygiene\.md\)\.\n- Work in a git worktree; never edit a checkout that is deploying\.\n- Before push, run every check that AGENTS\.md names\.\n/);
  assert.ok(!outputs.get("dist/generic/lpm-deliver-activity.md").includes("## Reference summaries"), "already inlined");
  // remove the placeholder: generic must still carry the inlineSummary ref's summary
  const src = path.join(root, "skills/lpm-deliver-activity/SKILL.src.md");
  fs.writeFileSync(src, fs.readFileSync(src, "utf8").replace("{{ref-summary:repo-hygiene}}\n", ""));
  const again = runBuild(root).outputs.get("dist/generic/lpm-deliver-activity.md");
  assert.match(again, /## Reference summaries\n\n### repo-hygiene\n- Work in a git worktree/);
});

test("{{skill:}} renders plain text; internal skills in core bundles say (LPM maintainers only) once", () => {
  const { outputs } = build();
  for (const t of NATIVE) {
    const md = outputs.get(`dist/${t}/lpm-deliver-activity/SKILL.md`);
    assert.ok(md.includes("| shipping the LPM product itself | `lpm-release-product` (LPM maintainers only) |"), t);
    assert.ok(md.includes("| a second mention | `lpm-release-product` (LPM maintainers only) |"), t);
    assert.ok(!md.includes("(LPM maintainers only) (LPM maintainers only)"), t);
    assert.ok(!/\]\([^)]*lpm-release-product/.test(md), `${t}: never a link to an internal skill`);
  }
  const generic = outputs.get("dist/generic/lpm-deliver-activity.md");
  assert.ok(generic.includes("`lpm-release-product` (LPM maintainers only)"), "internal stays plain text in generic too");
  assert.ok(outputs.get("dist/generic/lpm-start.md").includes("| delivering an activity | `lpm-deliver-activity.md` |"), "core sibling → file name");
  assert.ok(outputs.get("dist/codex/lpm-start/SKILL.md").includes("| delivering an activity | `lpm-deliver-activity` |"));
  assert.ok(outputs.get("dist/codex/lpm-deliver-activity/references/closure-checklist.md").includes("`lpm-roadmap`"));
});

test("{{tool:}} renders as one code span even when the source already wraps it in backticks", () => {
  const { outputs } = build();
  const md = outputs.get("dist/codex/lpm-deliver-activity/SKILL.md");
  assert.ok(md.includes("| 1 | read the activity | `get_issue` | A | — |"));
  assert.ok(md.includes("`list_activity_attachments` → `delete_activity_attachment`"));
  assert.ok(!md.includes("``"));
  assert.ok(outputs.get("dist/codex/lpm-deliver-activity/references/repo-hygiene.md").includes("Use `get_issue` to read"));
});
