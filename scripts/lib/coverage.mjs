// coverage.mjs — catalog/coverage.json (schema v2, §5.5), docs/lpm-coverage-matrix.md and the
// README generated block (§6.4), and the transition legacy-compat files (§6.6, catalog/compat.json).

import fs from "node:fs";
import path from "node:path";
import { compareStrings, jsonText, loadGitignore, readText, sha256, sortStrings, uniqSorted, walk } from "./fs.mjs";
import { SOURCE_REPO, accessClass, authorityCounts, installProfiles, isOAuth } from "./model.mjs";
import { escapeCell, generatedMarker, renderedPaths } from "./render.mjs";
import { computeHashes } from "./snapshot.mjs";

export const COVERAGE_PATH = "catalog/coverage.json";
export const MATRIX_PATH = "docs/lpm-coverage-matrix.md";
export const README_PATH = "README.md";
export const README_BEGIN = "<!-- GENERATED:catalog -->";
export const README_END = "<!-- /GENERATED:catalog -->";
export const SOURCE_ROOTS = ["catalog", "shared", "skills"];

// ─── sourcesHash ───────────────────────────────────────────────────────────────

/**
 * Repo-relative source paths that feed source.sourcesHash: catalog/** (minus coverage.json),
 * shared/**, skills/** — minus .gitignore'd files and generated compat outputs.
 */
export function sourcePaths(root, model = null) {
  const ignored = loadGitignore(root);
  const compatOutputs = new Set(model ? model.catalog.compat.files.map((f) => f.path) : []);
  const out = [];
  for (const dir of SOURCE_ROOTS) {
    for (const rel of walk(path.join(root, dir))) {
      const p = `${dir}/${rel}`;
      if (p === COVERAGE_PATH) continue;
      if (compatOutputs.has(p)) continue;
      if (ignored(p, false)) continue;
      out.push(p);
    }
  }
  return sortStrings(out);
}

/** sha256 over the lines `<path>\0<sha256 of bytes>\n`, sorted by path → "sha256:<hex>". */
export function computeSourcesHash(root, model = null) {
  const lines = sourcePaths(root, model).map((p) => `${p}\0${sha256(fs.readFileSync(path.join(root, p)))}\n`);
  return `sha256:${sha256(lines.join(""))}`;
}

// ─── coverage.json ─────────────────────────────────────────────────────────────

const toolRegex = (name) => new RegExp(`(?<![a-z0-9_])${name}(?![a-z0-9_])`);

function mainRenderedFiles(model) {
  const out = [];
  for (const s of model.skills) for (const p of Object.values(renderedPaths(s.id))) out.push(p);
  return out;
}

function resolveRenderIn(model, contract) {
  const paths = [];
  const ofSkill = (id) => {
    if (model.skillById[id]) paths.push(...Object.values(renderedPaths(id)));
  };
  if (Array.isArray(contract.renderIn)) paths.push(...contract.renderIn.filter((p) => typeof p === "string"));
  const scope = typeof contract.scope === "string" ? contract.scope : "";
  const anchor = contract.anchorTool || contract.ownerOf || (scope.startsWith("owner-of:") ? scope.slice(9) : null);
  if (anchor && model.tools[anchor] && model.tools[anchor].owner) ofSkill(model.tools[anchor].owner);
  for (const id of Array.isArray(contract.skills) ? contract.skills : []) ofSkill(id);
  if (contract.everySkill === true || scope === "every-skill") for (const s of model.skills) ofSkill(s.id);
  return uniqSorted(paths);
}

function snapshotSummary(model) {
  const meta = model.catalog.meta || {};
  const snap = model.catalog.snapshot;
  const computed = snap ? computeHashes(snap.tools, model.catalog.cli.map((c) => c.key)) : {};
  const pick = (k) => (meta[k] !== undefined && meta[k] !== null ? meta[k] : computed[k] || null);
  return {
    lpmCommit: meta.lpmCommit || (snap && snap.lpmCommit) || null,
    toolCount: meta.toolCount !== undefined ? meta.toolCount : snap ? snap.tools.length : 0,
    cliCount: meta.cliCount !== undefined ? meta.cliCount : model.catalog.cli.length,
    namesHash: pick("namesHash"),
    schemaHash: pick("schemaHash"),
    cliHash: pick("cliHash"),
  };
}

/**
 * Builds the coverage.json object (§5.5) from the model and the rendered dist map.
 * @param {object} model
 * @param {Map<string,string>} dist renderAll() output
 * @param {{sourcesHash: string}} opts
 */
export function buildCoverage(model, dist, { sourcesHash }) {
  const snap = model.catalog.snapshot;
  const pending = model.catalog.pending.map((p) => ({
    tool: p.tool,
    reason: p.reason || "",
    until: p.until || null,
    approvedBy: p.approvedBy || null,
  }));
  const pendingTools = new Set(pending.map((p) => p.tool));

  const skills = model.skills.map((s) => ({
    id: s.id,
    version: s.manifest.version,
    pack: s.manifest.pack,
    kind: s.manifest.kind,
    owns: sortStrings(s.manifest.owns),
    uses: sortStrings(s.manifest.uses),
    rendered: renderedPaths(s.id),
  }));

  const mainFiles = mainRenderedFiles(model).filter((p) => dist.has(p));
  const tools = {};
  for (const t of Object.values(model.tools).sort((a, b) => compareStrings(a.name, b.name))) {
    if (!t.inSnapshot && !t.owners.length && !t.usedBy.length) continue;
    const re = toolRegex(t.name);
    tools[t.name] = {
      owner: t.owner,
      usedBy: t.usedBy,
      category: t.category,
      accessLevel: t.accessLevel,
      sensitive: t.sensitive,
      oauthScope: t.oauthScope,
      required: sortStrings(t.required),
      cardAuthority: t.cardAuthority,
      renderedAuthority: t.authority,
      renderedIn: sortStrings(mainFiles.filter((p) => re.test(dist.get(p)))),
    };
  }

  const contracts = model.catalog.contracts
    .map((c) => ({ id: c.id, tools: sortStrings(c.tools), phrases: sortStrings(c.phrases), renderIn: resolveRenderIn(model, c) }))
    .sort((a, b) => compareStrings(a.id, b.id));

  const live = snap ? snap.tools : [];
  const owned = live.filter((t) => tools[t.name] && tools[t.name].owner).length;
  const unowned = live.filter((t) => !(tools[t.name] && tools[t.name].owner) && !pendingTools.has(t.name)).length;

  return {
    schemaVersion: 2,
    generatedBy: "agents-skills scripts/skills.mjs build",
    source: { repo: SOURCE_REPO, sourcesHash },
    snapshot: snapshotSummary(model),
    policy: { schemaDrift: model.catalog.policy.schemaDrift },
    skills,
    tools,
    pending,
    contracts,
    totals: {
      tools: live.length,
      owned,
      pending: pending.length,
      unowned,
      skills: model.skills.length,
      oauthReachable: live.filter((t) => t.oauthScope).length,
    },
  };
}

// ─── docs/lpm-coverage-matrix.md ───────────────────────────────────────────────

const code = (s) => `\`${s}\``;

export function renderCoverageMatrix(model, coverage) {
  const out = [generatedMarker(COVERAGE_PATH), "# LPM coverage matrix", ""];
  out.push(
    "Generated from `catalog/coverage.json` by `node scripts/skills.mjs build`. Every LPM MCP tool has exactly one owner skill (or a dated pending entry); the totals below are computed, not claimed.",
    "",
    "## Snapshot",
    "",
    "| Field | Value |",
    "|---|---|",
  );
  const s = coverage.snapshot;
  for (const k of ["lpmCommit", "toolCount", "cliCount", "namesHash", "schemaHash", "cliHash"]) {
    out.push(`| ${k} | ${s[k] === null || s[k] === undefined ? "—" : code(s[k])} |`);
  }
  out.push(`| sourcesHash | ${code(coverage.source.sourcesHash)} |`, "");
  const t = coverage.totals;
  out.push(
    "## Totals",
    "",
    "| Tools | Owned | Pending | Unowned | Skills | OAuth-reachable |",
    "|---|---|---|---|---|---|",
    `| ${t.tools} | ${t.owned} | ${t.pending} | ${t.unowned} | ${t.skills} | ${t.oauthReachable} |`,
    "",
    "## Skills",
    "",
    "| Skill | Pack | Kind | Owned | A/C/O | OAuth | Access | Used |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const sk of model.skills) {
    const c = authorityCounts(model, sk);
    const oauth = sk.manifest.owns.filter((x) => isOAuth(model, x)).length;
    out.push(
      `| ${code(sk.id)} | ${sk.manifest.pack} | ${sk.manifest.kind} | ${sk.manifest.owns.length} | ${c.A}/${c.C}/${c.O} | ${oauth} | ${accessClass(model, sk)} | ${sk.manifest.uses.length} |`,
    );
  }
  out.push("", "## Tools by category", "");
  const byCat = {};
  for (const [name, tool] of Object.entries(coverage.tools)) (byCat[tool.category || "uncategorized"] ||= []).push(name);
  for (const cat of sortStrings(Object.keys(byCat))) {
    out.push(`### ${cat}`, "", "| Tool | Owner | Authority | Scope | Used by |", "|---|---|---|---|---|");
    for (const name of sortStrings(byCat[cat])) {
      const tool = coverage.tools[name];
      out.push(
        `| ${code(name)} | ${tool.owner ? code(tool.owner) : "**unowned**"} | ${tool.renderedAuthority} | ${tool.oauthScope || "KEY"} | ${tool.usedBy.length ? tool.usedBy.map(code).join(", ") : "—"} |`,
      );
    }
    out.push("");
  }
  out.push("## Contracts", "", "| Contract | Tools | Phrases | Rendered in |", "|---|---|---|---|");
  for (const c of coverage.contracts) {
    out.push(
      `| ${code(c.id)} | ${c.tools.length ? c.tools.map(code).join(", ") : "—"} | ${c.phrases.length ? c.phrases.map((p) => code(p)).join(", ") : "—"} | ${c.renderIn.length} files |`,
    );
  }
  out.push("", "## Process rules", "");
  if (model.catalog.processRules.length) {
    out.push("| Process rule | Where it is enforced |", "|---|---|");
    for (const r of model.catalog.processRules) out.push(`| ${escapeCell(r.rule)} | ${escapeCell(r.enforcedBy || r.where || "")} |`);
  } else {
    out.push("No process-rule matrix yet (`catalog/process-rules.json`).");
  }
  out.push("", "## Pending", "");
  if (coverage.pending.length) {
    out.push("| Tool | Reason | Until | Approved by |", "|---|---|---|---|");
    for (const p of coverage.pending) out.push(`| ${code(p.tool)} | ${escapeCell(p.reason)} | ${p.until || "—"} | ${p.approvedBy || "—"} |`);
  } else {
    out.push("None.");
  }
  // Transition: the LPM legacy parity gate reads this path for fixed tool mentions.
  const compat = model.catalog.compat.files.find((f) => f.path === MATRIX_PATH);
  if (compat) {
    const text = out.join("\n");
    const missing = compat.tools.filter((x) => !toolRegex(x).test(text));
    const missingPhrases = compat.phrases.filter((p) => !text.includes(p));
    if (missing.length || missingPhrases.length) {
      out.push("", "## Legacy parity mentions", "", ...[missing.map(code).join(", "), ...missingPhrases].filter(Boolean));
    }
  }
  return out.join("\n");
}

// ─── README generated block ────────────────────────────────────────────────────

export function renderReadmeBlock(model) {
  const profiles = installProfiles(model);
  const out = [README_BEGIN, generatedMarker("skills/*/skill.json and external/*/metadata.json"), ""];
  out.push("### Skills", "", "| Skill | Use when | Access | Owner-only |", "|---|---|---|---|");
  for (const s of model.skills) {
    const c = authorityCounts(model, s);
    out.push(
      `| \`${s.id}\`${s.manifest.pack === "internal" ? " (internal)" : ""} | ${escapeCell(s.manifest.description)} | ${accessClass(model, s)} | ${c.O} |`,
    );
  }
  out.push(
    "",
    "### Install",
    "",
    "```bash",
    "node scripts/skills.mjs install --agent codex --profile core",
    "node scripts/skills.mjs install --agent claude-code --profile core",
    "node scripts/skills.mjs install --agent antigravity --profile core",
    "node scripts/skills.mjs install --agent generic --dest <dir> --profile core",
    "# first v2 install on a machine that still has the legacy skills:",
    "node scripts/skills.mjs install --agent codex --profile core --prune --adopt-legacy",
    "# LPM maintainers only (user scope, never inside the lpm checkout):",
    "node scripts/skills.mjs install --agent claude-code --scope user --include-internal",
    "node scripts/skills.mjs verify --agent codex",
    "```",
    "",
    "### Profiles",
    "",
    "| Profile | Skills |",
    "|---|---|",
    `| \`core\` (default) | ${profiles.core.length ? profiles.core.map((x) => `\`${x}\``).join(", ") : "—"} |`,
    `| \`connector\` | ${profiles.connector.length ? profiles.connector.map((x) => `\`${x}\``).join(", ") : "—"} |`,
    `| \`internal\` (\`--include-internal\`, user scope) | ${profiles.internal.length ? profiles.internal.map((x) => `\`${x}\``).join(", ") : "—"} |`,
    "",
    "### External bundles",
    "",
  );
  if (model.external.length) {
    out.push("| Bundle | Status | Source | Upstream ref |", "|---|---|---|---|");
    for (const e of model.external) {
      const m = e.metadata || {};
      out.push(`| \`${e.id}\` | ${m.status || "—"} | ${escapeCell(m.upstream_repo || m.source_type || "—")} | ${escapeCell(m.upstream_ref || "—")} |`);
    }
  } else {
    out.push("None.");
  }
  out.push("", README_END);
  return out.join("\n");
}

/** Replaces the README block between the markers; appends it when the markers are absent. */
export function applyReadmeBlock(readme, block) {
  const text = String(readme || "").replace(/\r\n?/g, "\n");
  const b = text.indexOf(README_BEGIN);
  const e = text.indexOf(README_END);
  if (b >= 0 && e > b) return text.slice(0, b) + block + text.slice(e + README_END.length);
  return (text.replace(/\n+$/, "") ? text.replace(/\n+$/, "") + "\n\n" : "") + block + "\n";
}

// ─── Legacy-compat files (§6.6) ────────────────────────────────────────────────

/** [[path, content]] for every compat.json entry except the coverage matrix (rendered above). */
export function renderCompatFiles(model) {
  const see = model.catalog.compat.see || (model.tools.upload_activity_attachment && model.tools.upload_activity_attachment.owner) || "lpm-deliver-activity";
  const files = [];
  for (const f of model.catalog.compat.files) {
    if (f.path === MATRIX_PATH || f.kind === "coverage-matrix" || f.format === "coverage-matrix") continue;
    const legacyId = f.legacyId || (f.path.match(/^skills\/([^/]+)\//) || [])[1] || "legacy";
    const marker = generatedMarker("catalog/compat.json (transition only)");
    const toolsLine = f.tools.map((t) => `- \`${t}\``);
    const body = [
      `# ${legacyId} (deprecated)`,
      "",
      `Deprecated: see ${see}.`,
      "",
      `This file exists only for the LPM legacy parity gate during the v2 transition (\`catalog/compat.json\`). It is not a skill and is never installed. Install \`${see}\` with \`node scripts/skills.mjs install\`.`,
      "",
      "Activity-evidence tools (owned by the v2 skill above):",
      ...toolsLine,
    ];
    const missingPhrases = f.phrases.filter((p) => !body.join("\n").includes(p));
    if (missingPhrases.length) body.push("", ...missingPhrases);
    const isSkill = /(^|\/)SKILL\.md$/.test(f.path) || f.format === "codex-skill";
    const content = isSkill
      ? ["---", `name: ${legacyId}`, `description: ${JSON.stringify(`Deprecated: see ${see}. Legacy compatibility file for the LPM parity gate; not installed.`)}`, "---", marker, ...body].join("\n")
      : [marker, ...body].join("\n");
    files.push([f.path, content]);
  }
  return files;
}

// ─── All coverage outputs ──────────────────────────────────────────────────────

/**
 * @returns {Map<string,string>} catalog/coverage.json, docs/lpm-coverage-matrix.md, README.md, compat files.
 */
export function renderCoverageOutputs(model, dist) {
  const sourcesHash = computeSourcesHash(model.root, model);
  const coverage = buildCoverage(model, dist, { sourcesHash });
  const files = new Map();
  files.set(COVERAGE_PATH, jsonText(coverage));
  files.set(MATRIX_PATH, renderCoverageMatrix(model, coverage));
  files.set(README_PATH, applyReadmeBlock(readText(path.join(model.root, README_PATH)) || "", renderReadmeBlock(model)));
  for (const [p, c] of renderCompatFiles(model)) files.set(p, c);
  return { files, coverage };
}
