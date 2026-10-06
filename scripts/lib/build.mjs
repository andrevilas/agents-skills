// build.mjs — `skills.mjs build [--skills a,b]` and `skills.mjs new <id>`.
// buildOutputs(model) is a pure function of the sources (§5.1); writeOutputs() writes it
// deterministically and prunes stale dist/ files. Validators (V15) call buildOutputs()
// and compare with the committed files.

import path from "node:path";
import fs from "node:fs";
import { exists, normalizeText, readText, removeFileAndEmptyParents, sortStrings, walk, writeFileDeterministic } from "./fs.mjs";
import { loadModel } from "./model.mjs";
import { renderAll, skillDistPrefixes } from "./render.mjs";
import { renderCoverageOutputs } from "./coverage.mjs";

/** Paths that a full build always (re)writes outside dist/. */
export const GLOBAL_OUTPUTS = ["catalog/coverage.json", "docs/lpm-coverage-matrix.md", "README.md"];

/**
 * Renders every output of `build` in memory.
 * @param {object} model loadModel() result
 * @returns {{outputs: Map<string,string>, coverage: object}}
 */
export function buildOutputs(model) {
  const dist = renderAll(model);
  const { files, coverage } = renderCoverageOutputs(model, dist);
  const outputs = new Map(dist);
  for (const [p, c] of files) outputs.set(p, normalizeText(c));
  return { outputs: new Map(sortStrings([...outputs.keys()]).map((k) => [k, outputs.get(k)])), coverage };
}

/**
 * Writes outputs under root. Full builds delete dist/ files that are no longer rendered;
 * `skills` limits writing and pruning to those skills' bundles (+ the global files).
 * @returns {{written: string[], unchanged: string[], removed: string[]}}
 */
export function writeOutputs(root, outputs, { skills = null } = {}) {
  const result = { written: [], unchanged: [], removed: [] };
  const prefixes = skills ? skills.flatMap(skillDistPrefixes) : null;
  const inScope = (rel) => {
    if (!prefixes) return true;
    if (!rel.startsWith("dist/")) return true;
    if (rel === "dist/generic/INDEX.md" || rel === "dist/generic/AGENTS-snippet.md") return true;
    return prefixes.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
  };
  for (const [rel, content] of outputs) {
    if (!inScope(rel)) continue;
    const r = writeFileDeterministic(path.join(root, rel), content);
    result[r === "written" ? "written" : "unchanged"].push(rel);
  }
  for (const rel of walk(path.join(root, "dist")).map((p) => `dist/${p}`)) {
    if (outputs.has(rel) || !inScope(rel)) continue;
    if (removeFileAndEmptyParents(path.join(root, rel), path.join(root, "dist"))) result.removed.push(rel);
  }
  return result;
}

/** Full build: load, render, write. */
export function runBuild(root, { skills = null } = {}) {
  const model = loadModel(root);
  if (skills) {
    for (const id of skills) {
      if (!model.skillById[id]) model.warnings.push({ code: "unknown-skill", message: `--skills: ${id} is not a v2 skill` });
    }
  }
  const { outputs, coverage } = buildOutputs(model);
  const result = writeOutputs(root, outputs, { skills });
  return { model, outputs, coverage, result, warnings: model.warnings };
}

// ─── new <id> ──────────────────────────────────────────────────────────────────

export const TEMPLATE_DIR = "templates/skill-v2";
export const SKILL_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Scaffolds skills/<id>/{skill.json, SKILL.src.md, references/} from templates/skill-v2.
 * Placeholders: __ID__ (or __SKILL_ID__) and __TITLE__.
 */
export function scaffoldSkill(root, id, { title = null } = {}) {
  if (!SKILL_ID_RE.test(id) || id.length > 64) throw new UsageError(`invalid skill id "${id}" (kebab-case, at most 64 characters)`);
  const dest = path.join(root, "skills", id);
  if (exists(dest)) throw new Error(`skills/${id} already exists`);
  const tpl = path.join(root, TEMPLATE_DIR);
  const files = walk(tpl);
  if (!files.length) throw new Error(`${TEMPLATE_DIR}/ is missing or empty`);
  const t = title || id.replace(/^lpm-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const written = [];
  for (const rel of files) {
    const text = readText(path.join(tpl, rel)) || "";
    const out = text.replace(/__SKILL_ID__|__ID__/g, id).replace(/__TITLE__/g, t);
    writeFileDeterministic(path.join(dest, rel.replace(/__SKILL_ID__|__ID__/g, id)), out);
    written.push(`skills/${id}/${rel}`);
  }
  fs.mkdirSync(path.join(dest, "references"), { recursive: true });
  return written;
}

export class UsageError extends Error {}
