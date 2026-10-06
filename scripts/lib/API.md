# agents-skills v2 build library: API

This is the contract between `scripts/skills.mjs` and the modules in `scripts/lib/`. It covers the model shape, every exported function, the file formats that the build reads, and the rules the renderer follows. Section numbers (§) refer to the final design, revision 2.

Common rules:
- Node 20 or later, ESM, no npm dependencies.
- No module prints secrets or environment values, and none makes a network call.
- All output is deterministic: arrays and object keys are sorted, line endings are LF, and there are no timestamps.

## Modules

| Module | Owner | Exports (summary) |
|---|---|---|
| `fs.mjs` | build core | deterministic I/O, sorting, sha256, walk, minimal `.gitignore` |
| `model.mjs` | build core | `loadModel(root)` and derived helpers (authority, access, routing rows, profiles) |
| `render.mjs` | build core | `renderAll(model)`, plus the per-skill renderer and routing renderer |
| `coverage.mjs` | build core | `coverage.json` v2, `sourcesHash`, coverage matrix, README block, compat files |
| `snapshot.mjs` | build core | `runSnapshot`, `computeHashes`, stub cards |
| `build.mjs` | build core | `buildOutputs(model)`, `writeOutputs`, `runBuild`, `scaffoldSkill` (`new`) |
| `playbook.mjs` | build core | playbook standard (spec revision 3): `playbookIndex(src)`, `isPlaybookSkill(skill)`, `playbookRefNames(skill)`, `parsePlaybook(text)`, `savedNames(text)`, `checkPlaybookSkill(model, skill, {readRendered?})` → V20/V21 findings `[{validator, level, message}]` |
| `validate.mjs` | validators agent | `runCheck(opts)` or `runCheck(model, opts)` → `{exitCode, ok, failures, warnings}`; `validate(model, {lpm?, today?, only?, evalRouter?, runSnapshot?})` (pure, prints nothing); `VALIDATORS`. A finding is `{validator, skill \| null, message}`. Human output: `<validator> <skill\|infra> <message>`; `--json`: `{ok, failures, warnings}` |
| `router.mjs` | router agent | `evalRouter(opts \| model, opts)`, `evalTriggers(opts \| model, opts)`, `matchRequest(rows, text)`, `routerTable(model)` (rows + legacy row max+1 + fallback row), `runRouterEval(model)`, `tokenize`, `compileTerm`, `termMatches`, `evaluateRow` (see "Router" below) |
| `trace.mjs` | trace agent | `evalTrace(opts)`, fake MCP server, flow validation and checker (see "Trace eval") |
| `install.mjs` | install agent | `install`, `update`, `verify`, `doctor`, `prune` (each `(opts)`) |

### Delegated command contract (`check`, `eval`, `install`, `update`, `verify`, `doctor`, `prune`)

`skills.mjs` calls `await fn(opts)`, where `opts = { root, flags, args, log }`:
- `root`: absolute repository root. The default is the checkout that holds `scripts/skills.mjs`; `--root <dir>` overrides it, which tests use.
- `flags`: parsed flags, e.g. `{ agent: "codex", scope: "user", profile: "core", skills: "a,b", all: true, "include-internal": true, prune: true, "adopt-legacy": true, "dry-run": true, "allow-untracked": true, router: true, trace: "<flow>", model: "<id>", verbose: true }`.
  - Value flags are strings; boolean flags are `true`.
  - Delegated commands also receive unknown flags. `--x v` becomes `"v"`, and `--x` alone becomes `true`.
  - `eval --trace` also receives `opts.flow`.
- `args`: positional arguments.
- `log`: `{ info, warn, error }`. `info` writes to stdout; `warn` and `error` write to stderr.

Return a number (the exit code), or an object with `exitCode` (a number) or `ok` (a boolean). A thrown error prints `error: <message>` and exits 1.

The dispatcher already validates these before delegating, and exits 2 on a usage error:
- `install` and `verify` need `--agent`.
- `--agent` is one of `codex`, `claude-code`, `antigravity`, `generic`.
- `--scope` is `user` or `project`.
- `--profile` is `core`, `connector` or `internal`.
- At most one of `--profile`, `--skills` and `--all` is given.
- `eval` takes exactly one of `--router`, `--triggers` and `--trace <flow>`.

Exit codes: 0 ok, 1 failures, 2 usage.

## Model shape (`loadModel(root)`)

`loadModel` never throws on a missing or malformed source. Each problem becomes a warning `{ code, message, file? }` in `model.warnings`, with one of these codes:

`missing-source`, `invalid-json`, `invalid-snapshot`, `invalid-card`, `duplicate-card`, `duplicate-shared-ref`, `skill-id-mismatch`, `legacy-skill-dirs`, `duplicate-skill`, `duplicate-owner`

```js
{
  root,                       // absolute path
  warnings: [{ code, message, file? }],
  catalog: {
    snapshot: null | { schemaVersion, hashes?, tools: [{ name, category, accessLevel, sensitive, oauthScope, profiles[], required[], params{}, description?, descriptionSha? }] },  // sorted by name
    cli: [{ key, usage }],    // from lpm-cli.snapshot.json (cli|commands|keys), sorted by key; usage = string[] | string | null
    meta: null | { schemaVersion, lpmCommit, lpmDirty, toolCount, cliCount, namesHash, schemaHash, cliHash },
    cards: { [tool]: Card },  // catalog/cards/*.json, see "Card"
    aliases: [{ alias, canonical, owner, note, ...raw }],                       // sorted by alias
    authorityOverrides: [{ tool, decision: "keep"|"raise", from: "A"|"C"|"O"|null, to: "A"|"C"|"O"|null, group?, reason, rule?, ...raw }],
    allowlist, denylist, behaviorContracts, cardErrata,                         // raw JSON or null
    contracts: [{ id, tools[], phrases[], scope?, anchorTool?, skills?, everySkill?, ...raw }],
    policy: { schemaDrift: "warn"|"fail" },                                    // contracts.json `policy.schemaDrift`, default "warn"
    routingExamples: [ entry ],                                                 // routing-examples.json `entries` (or examples/cases/array)
    legacyIds: [{ legacy, skill, also[], note? }],                              // sorted by legacy
    compat: { see: string|null, files: [{ path, kind?, tools[], phrases[], ...raw }] },  // sorted by path
    pending: [{ tool, reason, until, approvedBy }],                             // OPTIONAL catalog/pending.json
    processRules: [{ rule, enforcedBy }],                                       // OPTIONAL catalog/process-rules.json
  },
  shared: {
    partials: { [name]: text },       // shared/partials/<name>.md, e.g. "core-rules", "tool-naming.codex"
    references: { [name]: { name, path, internal: bool, content, summary, loadWhen, ownerSkill } }, // shared/references + shared/internal
  },
  skills: [{                          // v2 skills only, sorted by id
    id, dir, manifestPath, srcPath,
    manifest,                         // normalized skill.json (see below)
    src: string | null,               // SKILL.src.md (null → a stub body is rendered)
    references: [{ name, file: "references/x.md", path, content, summary, loadWhen }],
  }],
  skillById: { [id]: skill },
  legacySkillDirs: [dir],             // skills/<dir> with a legacy skill.json and no SKILL.src.md (skipped)
  external: [{ id, path, metadata | null }],
  tools: { [name]: ToolInfo },        // union of snapshot tools, cards, and every owns/uses name; sorted keys
}
```

**Normalized manifest.** All fields of `skill.json` are kept, with these defaults:
- `pack` `"core"`, `kind` `"tools"`, `invocation` `"implicit"`, `version` `"0.0.0"`;
- `title` falls back to `name`, then to `id`;
- these arrays default to `[]`: `jobs`, `routing`, `notFor`, `owns`, `uses`, `cli`, `sharedRefs`, `references`, `behaviorContracts`;
- `sharedRefs[]` is `{ name, loadWhen?, inlineSummary? }`; a bare string is accepted, and `name` is reduced to the base name;
- `references[]` is `{ file, loadWhen? }`;
- `codex` defaults to `{}`.

**Skill discovery.** A `skills/<dir>` directory is a v2 skill when it has `SKILL.src.md`, or when its `skill.json` has `pack`, `kind`, `routing`, `owns` or `doneWhen`. Other directories are legacy: they are skipped and never rendered, but their files still count in `sourcesHash`.

**Card** (normalized from the scratchpad or v2 shape; all original fields are kept):

```js
{ name, status: "verified"|"stub", purpose, useWhen[], avoidWhen[], inputs: [{ param, required, source, notes }],
  preconditions[], effect, authority /* "autonomous"|"confirm-with-user"|"owner-only"|null */, idempotency, returns,
  pairsWith[], errors: [{ when, fix }], oauthScope, cli, gotchas: [{ text, verifiedFrom }], file, group /* file basename */ }
```

A card file can be an array of cards, `{ cards: [...] }`, `{ tools: [...] }`, or a `{ name: card }` map. A string `gotchas` becomes one `{ text, verifiedFrom: card.verifiedFrom }`.

**ToolInfo:**

```js
{ name, snapshot | null, card | null, inSnapshot, category, accessLevel, effect, sensitive, oauthScope, profiles[], required[],
  cardAuthority,                // raw card authority string
  authority,                    // RENDERED "A"|"C"|"O": card authority, then the stricter `to` of every non-"keep" override; unknown → "C"
  overrides[], aliasOf | null, aliases[], owner | null, owners[], usedBy[] }
```

### `model.mjs` exports

| Function | Returns |
|---|---|
| `loadModel(root)` | the model above |
| `authorityLetter(value)` | `"A"\|"C"\|"O"\|null` from `autonomous`, `confirm-with-user`, `owner-only` or a letter |
| `stricterAuthority(a, b)` | the stricter letter (A < C < O) |
| `renderedAuthority(model, tool)` | the letter (`"C"` for an unknown tool) |
| `isOAuth(model, tool)` | true when the snapshot (or card) has an `oauthScope` |
| `accessTools(skill)` | `owns`, or `uses` when `owns` is empty (process skills) |
| `accessClass(model, skill)` | `"OAuth ok"\|"OAuth mostly"\|"mixed"\|"mostly KEY"\|"KEY"\|"process skill"` (§2.1 thresholds: 100 %, ≥60 %, ≥15 %, >0) |
| `authorityCounts(model, skill)` | `{A, C, O}` over the owned tools |
| `profileSizes(model)` / `smallestProfile(model, tools)` | preset sizes; the smallest API-key preset that holds every tool (`"full"` when unknown). `custom` and the owner-agent profiles (`roadmap-owner-*`, `NON_KEY_PROFILES`) never count: LPM rejects them on an API key |
| `routingRows(model)` | every `routing[]` row: `{ ...row, skill, pack, internal, all: string[][], unless: string[] }`, sorted by `order` |
| `collisionExamples(model)` | `routingExamples` with `collision: true`, sorted by `id` |
| `skillsOfPack(model, pack)` / `installProfiles(model)` | `{ core, connector, internal }` → sorted ids (`connector` = core skills that own ≥1 OAuth tool) |
| `extractSummary(md)` / `extractLine(md, "Load when:")` / `refName(name)` / `normalizeCard(raw, file)` | helpers |
| constants | `TARGETS`, `NATIVE_TARGETS`, `BASE_SHARED_REFS`, `ENDPOINT`, `SOURCE_REPO` |

## Rendering (`render.mjs`)

| Function | Returns |
|---|---|
| `renderAll(model, { skills?, warn? })` | `Map<relPath, content>` (normalized, sorted keys) for every skill of every pack × 4 targets, plus `dist/generic/INDEX.md` and `AGENTS-snippet.md`. `skills` limits the per-skill bundles. Warnings are deduplicated and pushed to `model.warnings` |
| `renderSkill(model, skill, target, warn)` | `[[relPath, content]]` for one target |
| `renderRouting(model, "native" \| "generic")` | the `route.md` / `INDEX.md` body (§2.2, §2.3, tie-break, multi-domain, legacy rows) |
| `renderToolsRef(model, skill)` / `renderAliasesRef(model, skill)` | the body of `references/tools.md` / `aliases.md` |
| `bundleRefs(model, skill, warn)` | ordered `[{ name, kind: "local"\|"shared"\|"internal"\|"generated", loadWhen, sourcePath, content, summary, inlineSummary }]` |
| `generatedRefNames(model, skill)` | a subset of `["tools", "aliases", "route"]` |
| `makeContext(model, skill, target, "skill"\|"ref", warn)` + `expandText(text, ctx)` | expand any source text the way the build does |
| `renderedPaths(id)` | `{ codex, "claude-code", antigravity, generic }`: the 4 main files (coverage `rendered`) |
| `skillDistPrefixes(id)` | the `dist/` paths a skill's bundle owns |
| `connectorRows(model, src, localRefs?, owns?)` | `[{ row, tools[], access, connector }]` for the §4 decision rows. A row reaches the tools of its Do cell, of every `Pn` it names (a `### Pn` of §5, else of a local reference) and of every local reference it links with `{{ref:name}}`. `access` is `oauth` (every tool OAuth-exposed), `mixed`, `key` or `none` (no LPM tool); when the row names owned tools, only those decide. `connector` = `access == "oauth"` |
| `autoErrorRows(model, src, pinned?, localRefs?)` | card error rows for §9 (see `{{errors:auto}}`) |
| `catalogValue(model, key)` | the `{{catalog:<key>}}` count, or null |
| `shortPurpose(text)` / `compactRanges(nums)` / `genericToolsFile(id)` | §10 index purpose (first sentence, ≤56 chars); `1,2,3,6` → `1-3,6`; `<id>.tools.md` |
| `collisionRowsFor(model, id)` / `toolMentions(text)` / `sectionLines(text, n)` / `splitCells(line)` / `escapeCell(s)` / `demoteHeadings(text, by)` | helpers |
| `generatedMarker(source)` / `generatedYamlMarker(source)` | `<!-- GENERATED by agents-skills scripts/skills.mjs from <source> — do not edit -->` / `# GENERATED …` |

### Output files

- **Native targets** (`codex`, `claude-code`, `antigravity`): `dist/<target>/<id>/SKILL.md` and `dist/<target>/<id>/references/<name>.md` for every bundled reference. Codex also gets `dist/codex/<id>/agents/openai.yaml`.
- **Generic target:** `dist/generic/{INDEX.md, AGENTS-snippet.md, <id>.md, <id>.flows.md, <id>.refs.md, <id>.tools.md}`.
  - `<id>.flows.md` (only when the skill has `references/flow-*.md`) holds one `## § flow-<name>` section per playbook, in §5 index order (then any other flow file), with its headings demoted by 1 level. A playbook skill's `<id>.md` carries no "Reference summaries".
  - `<id>.refs.md` holds one `## § <name>` section per reference except `tools` and `flow-*`, with its headings demoted by 2 levels.
  - For `route`, that section points to `INDEX.md`.
  - `<id>.tools.md` holds the tool cards (the generated `tools` reference), so a generic agent that opens one reference does not load every card. `install --agent generic` copies it with `<id>.md`, `<id>.flows.md` and `<id>.refs.md`.
  - `INDEX.md` and `AGENTS-snippet.md` tell a generic agent to read `INDEX.md`, then exactly one `<id>.md`, then the one playbook it names in `<id>.flows.md`.
- **Playbook skills** (SKILL.src.md §5 holds `| Playbook | Use when | File |`, playbook-standard.md §9): R1 `{{refs:index}}` leaves out `flow-*` (§5 indexes them); R2 `{{tools:index}}` is `Owned tools (full cards: …):` + one line `` `name` [X] scope · … `` and `Used here (rules live in the owner skill):` + one line, in every target.

**Frontmatter.** `name` comes first, then `description` as a JSON-quoted YAML string.
- codex adds `metadata: {pack, kind, version}`.
- claude-code adds `disable-model-invocation: true` only when the skill is `invocation: "explicit"`.
- antigravity uses `name` and `description` only.
- The GENERATED marker is the line right after the frontmatter. Files without frontmatter have it on line 1.

**openai.yaml:**
- `interface.{display_name (codex.displayName or title), short_description, default_prompt}`;
- `policy.allow_implicit_invocation: false` only when the skill is explicit;
- `dependencies.tools[{type:"mcp", value:"LPM", transport:"streamable_http", url:"https://lpm.rocks/mcp"}]` when the skill names any tool.

**Bundled references, in order:**
1. the `skill.json.references[]` order (generated names listed there keep their `loadWhen`);
2. the other local files;
3. `sharedRefs[]`;
4. the base set (`connection-and-access`, `ids-and-sources`, `authority-and-owner-decisions`, `security-and-untrusted-text`), added even when not listed;
5. the generated references: `tools` (when owns ∪ uses ≠ ∅), `aliases` (when the skill names an alias or its canonical tool) and `route` (`lpm-start`, or any skill that lists `references/route.md`).

A local file named `tools.md`, `route.md` or `aliases.md` is ignored, with a warning.

### Placeholders

| Placeholder | Native (`SKILL.md` / `references/x.md`) | Generic |
|---|---|---|
| `{{title}}`, `{{doneWhen}}` | manifest value | same |
| `{{banner:access}}` | §3.3 text from `connectorRows`: rows that work on a connector, rows that work only in part because some of their tools are KEY-only (`mixed`), rows that need an API key and rows that call no LPM tool. The profile is the smallest API-key preset of the KEY tools (owner-agent profiles never count; `full` is written "full or custom"). A process skill whose §3–§5 run at least two kinds of shell command (`git`, `gcloud`, `npx`, `npm`, `node`, `bash`) says it needs a shell. Process skills compute it from `uses`. | same |
| `{{banner:authority}}` | `Authority: [A] a · [C] c · [O] o. <authorityCeiling>` | same |
| `{{partial:<name>}}` | `shared/partials/<name>.<target>.md`, else `<name>.md`. A missing `core-rules` or `tool-naming` falls back to the §4.1 text, with a warning. | same |
| `{{tool:x}}` (also `` `{{tool:x}}` ``) | `` `x` `` | same |
| `{{skill:id}}` | `` `id` `` | `` `id.md` `` |
| `{{skill:<internal id>}}` in a core skill | `` `id` (LPM maintainers only) `` (never a link; the suffix is not doubled) | same |
| `{{ref:name[#anchor]}}` | `[name](references/name.md#anchor)` in SKILL.md; `[name](name.md#anchor)` inside a reference | ``see `<id>.refs.md` § name (#anchor)``; a `flow-*` name → ``see `<id>.flows.md` § flow-x``. "see " is dropped after see/follow/read/load/per/in/playbook, and before a `flow-*` link that starts a table cell. `route` becomes `` `INDEX.md` `` |
| `{{ref-summary:name}}` | the reference's `## Summary` body | same. Generic also appends a "Reference summaries" section for each `inlineSummary: true` ref that was not inlined |
| `{{errors:auto}}` or `{{errors:auto:tool_a,tool_b}}` | card `errors[]` of the tools named in §4–§5, then of the local references §4–§5 link: at most 8 rows (the full list stays in `tools.md`), deduplicated by `when`, as `` | `tool`: when | fix | ``. Order: pinned tools, then write tools (`[C]`/`[O]` or a non-read card), then reads; rows are taken round-robin (at most 3 per tool) and grouped by tool. `-32003` rows whose fix is `get_mcp_connection_info` are skipped (core rule 2). The rows go into the hand table that follows, ahead of its rows; with no table, a table is emitted. | same |
| `{{tools:index}}` | `Owned tools (full cards: …):` then `` - `name` [X] · scope\|KEY · purpose `` (first sentence, ≤56 chars), then `Used here (rules live in the owner skill):`. Aliases (`aliases.json`) are left out; `tools.md` keeps their cards | a compact table: Tool, Auth, Scope, Owner, Required inputs ← source (full cards: `<id>.tools.md`) |
| `{{refs:index}}` | `Load a reference only when its condition holds:` then `` - `references/<name>.md` — <loadWhen> ``; a playbook skill leaves out `flow-*` | `` - `<id>.refs.md` § <name> — … ``; `tools` → `` `<id>.tools.md` ``; `flow-*` → `` `<id>.flows.md` § flow-x `` |
| `{{catalog:<key>}}` (inline) | a count computed at build time: `tools`, `oauth-tools`, `oauth-scopes`, `scope:<oauthScope>`, `sensitive`, `profile:<name>`, `idempotency-keyed` (`idempotencyKey supported` + `keyed by …`), `idempotency-not`. Shared references use it so their numbers never drift | same |

A block placeholder must sit alone on its line. Unknown placeholders are left as they are, so validators can report them. `{{banner:*}}` and `{{partial:*}}` blocks get a blank line before and after, so CommonMark never folds them into the `> Done when` quote or into each other.

**Collision rows (§2.3 in "Do not use").** Entries with `collision: true` are grouped by the first word of `says` (accents stripped, lowercased). For skill S, every entry of S's groups whose `expected` is another skill adds the row `| <says> — <about> | <skill mention> |` at the end of the first table after the `Do not use` line in §1. An entry may set `affects: [ids]` to override the grouping. A row is skipped when the table already names that skill.

## Coverage (`coverage.mjs`)

| Function | Returns |
|---|---|
| `renderCoverageOutputs(model, dist)` | `{ files: Map, coverage }`. `files` holds `catalog/coverage.json`, `docs/lpm-coverage-matrix.md`, `README.md` and the compat files |
| `buildCoverage(model, dist, { sourcesHash })` | the §5.5 object. Key order: `schemaVersion, generatedBy, source{repo, sourcesHash}, snapshot, policy, skills, tools, pending, contracts, totals` |
| `computeSourcesHash(root, model)` / `sourcePaths(root, model)` | `sha256:` over the sorted lines `<path>\0<sha256 hex of bytes>\n` |
| `renderCoverageMatrix(model, coverage)` / `renderReadmeBlock(model)` / `applyReadmeBlock(readme, block)` / `renderCompatFiles(model)` | the individual outputs |

`sourcesHash` covers every file under `catalog/`, `shared/` and `skills/`, except:
- `catalog/coverage.json`;
- files matched by the root `.gitignore`;
- the compat output paths of `catalog/compat.json`.

The hash covers the working tree, legacy skill directories included.

**`coverage.json` fields:**
- `skills[]` is `{id, version, pack, kind, owns, uses, rendered, playbooks}`; `playbooks` lists the §5-indexed playbook names of a playbook skill (`[]` until it is migrated). The matrix "Skills" table shows their count in a "Playbooks" column.
- `tools` covers every snapshot tool, plus every tool that a skill owns or uses. Each entry is `{owner, usedBy, category, accessLevel, sensitive, oauthScope, required, cardAuthority, renderedAuthority, renderedIn}`. `renderedIn` lists the 4 main rendered files where `/(?<![a-z0-9_])tool(?![a-z0-9_])/` matches.
- `contracts[].renderIn` is the union of:
  - the explicit `renderIn[]`;
  - the 4 files of the owner of `anchorTool` (or `ownerOf`, or `scope: "owner-of:<tool>"`);
  - the 4 files of each id in `skills[]`;
  - with `everySkill: true` or `scope: "every-skill"`, the 4 files of every skill.
- `totals`: `tools` is the snapshot count; `owned` counts snapshot tools that have an owner; `pending` is the number of entries; `unowned` counts snapshot tools with no owner that are not pending; `oauthReachable` counts snapshot tools with an `oauthScope`.

**README block.** Only the text between `<!-- GENERATED:catalog -->` and `<!-- /GENERATED:catalog -->` is replaced. When the markers are absent, the block is appended.

**Compat files** come from `catalog/compat.json` `files[]`:
- An entry with `kind: "coverage-matrix"`, or the matrix path, is not written separately. Instead, the matrix gains a "Legacy parity mentions" line if one of the entry's tools or phrases is missing from it.
- A `SKILL.md` gets a legacy frontmatter (`name` = the legacy id from the path). Other files get only the marker.
- Every compat file says `Deprecated: see <compat.see>.`, lists the entry's tools, and appends any of its phrases that are still missing.

## Snapshot (`snapshot.mjs`)

| Function | Returns |
|---|---|
| `runSnapshot(root, { lpm?, json?, check?, log })` | `{ exitCode, changed[], stubs[], warnings[] }`. It runs `node --import tsx/esm <lpm>/scripts/export-mcp-catalog.ts` (cwd = lpm). `--json <file>` reads a saved exporter output instead. `--check` writes nothing and exits 1 on any difference or tool without a card; it ignores `lpmCommit` and `lpmDirty` |
| `snapshotFiles(exported)` | `{ files: Map, warnings, tools }` for the 3 files below |
| `computeHashes(tools, cli)` | `{ namesHash, schemaHash, cliHash }`: sha256 of the sorted lines, each ending in `\n`. A schema line is `name\|category\|accessLevel\|0/1\|oauthScope or -\|required sorted, joined by ","` |
| `stubCard(tool)` / `stubCardFiles(root, tools)` | a `"status":"stub"` card, appended to `catalog/cards/<category>.json`. The file keeps its shape and is sorted by name |

The 3 files, all from the exporter output:
- `lpm-tools.snapshot.json`: `{schemaVersion, tools (sorted), hashes}`;
- `lpm-cli.snapshot.json`: `{schemaVersion, cli (sorted, entries as exported)}`;
- `snapshot.meta.json`: `{schemaVersion, lpmCommit, lpmDirty, toolCount, cliCount, namesHash, schemaHash, cliHash}`.

When the exporter's hashes differ from the local computation, the exporter's values are stored and a warning is printed.

## Build (`build.mjs`)

| Function | Returns |
|---|---|
| `buildOutputs(model)` | `{ outputs: Map<relPath, content>, coverage }`. This is every output of `build`; V15 compares it with the committed files |
| `writeOutputs(root, outputs, { skills? })` | `{ written[], unchanged[], removed[] }`. A file is written only when its content changed. A full build deletes `dist/` files that are no longer rendered and removes empty directories. `skills` limits writing and pruning to those bundles plus the global files |
| `runBuild(root, { skills? })` | `{ model, outputs, coverage, result, warnings }` |
| `scaffoldSkill(root, id, { title? })` | the written paths. It copies `templates/skill-v2/**` to `skills/<id>/` and replaces `__ID__` / `__SKILL_ID__` and `__TITLE__`. A bad id throws `UsageError` (exit 2); an existing directory throws `Error` (exit 1) |

## Source formats added by the build core

These two catalog files are not listed in §3.1. Both are optional, and both count in `sourcesHash`:
- `catalog/pending.json`: `{ "pending": [{ "tool", "reason", "until": "YYYY-MM-DD", "approvedBy": "owner" }] }`. It feeds `coverage.json pending[]`.
- `catalog/process-rules.json`: `{ "rules": [{ "rule", "enforcedBy" }] }`. It holds the §8 matrix rendered into `docs/lpm-coverage-matrix.md`.
- `docs/provenance/card-migration-decisions.jsonl` (not a build input): the per-gotcha `verifiedFrom` decisions of the one-time card migration (§6.5), kept for provenance. Its checks now live in V4/V4g.

## Router (`router.mjs`)

| Function | Returns |
|---|---|
| `tokenize(text)` | §5.2 tokens: lowercase, NFD, combining marks dropped, `/[a-z0-9_]+([.-][a-z0-9_]+)*/g` |
| `compileTerm(term)` / `termMatches(compiled, tokens)` | `[{t, prefix}]`; each whitespace word is normalized like a request and a word ending in `*` is a prefix on its last token (so `artefato* de entrega` works). Whole tokens only, consecutive for multi-word terms |
| `evaluateRow(row, tokens)` | `{matched, hits[], blockedBy, missingGroups[]}`. A row with `fallback: true` always matches; any other row with no `all` groups never matches |
| `matchRequest(rows, text)` | `{skill, order, row, fallback, hits, tokens}` of the first matching row by ascending `order` (ties: fallback last, then skill id, then legacy id). Nothing matches and no fallback row → `skill/order/row` null, `fallback: true` |
| `routerTable(model)` | `routingRows(model)` + one row per `legacyIds` entry at `max order + 1` (`all: [[legacy id]]`, skill = primary) + the fallback row (`max + 2`, `firstCall: search_help_articles`), the same numbering `renderRouting` prints |
| `routerCases(examples)` / `runRouterEval(model)` | one case per prompt variant (id `<id>[<lang>]` for EN/PT arrays). A case passes when the winner's skill equals `expected` (`null`/`"none"` = fallback) and, when `decidedBy` is set (number, list, or text such as `"7 or 8"`), the winning `order` is listed. Report `{ok, total, passed, failed, score, gate: 100, misses[{id, prompt, tokens, expected, decidedBy, winner{order, skill, label, hits}, expectedRows[{order, skill, label, matched, why}], reason}], results[]}` |
| `evalRouter(opts)` or `evalRouter(model, opts)` | E1. Text mode prints one block per miss (prompt, tokens, expected skill/row, winning row, why each expected row lost) and a summary line; `--json` prints the report (`results` only with `--verbose`). Exit 1 below 100 % or with 0 cases |
| `buildTriggersPrompt(model)` / `scoreTriggers(cases, answers)` | E2 prompt: every v2 skill's `description` + the cases, no expected answers; a legacy-name case is included only when some description says `Old name: <id>` for it (V1 checks that id routes to that skill). Scoring: `{id: skill}` or `[{id, skill}]`, gate ≥95 % top-1, `collisionMisses` counted |
| `evalTriggers(opts)` or `evalTriggers(model, opts)` | E2. No model is ever called: writes the prompt to `--out <file>` (default `<os.tmpdir()>/agents-skills-eval/triggers-prompt.md`) and exits 0. With `--answers <file>` (the model's JSON answer from a manual run) it scores and exits 1 below the gate |

## Trace eval (`trace.mjs`, §5.7 E3)

Commands (`opts.flow` = the `--trace` value; extra flags pass through the dispatcher):

| Command | Does | Exit |
|---|---|---|
| `eval --trace <flow> --serve [--port N] [--log file]` | Starts the fake LPM MCP server on `127.0.0.1` (port 0 = any free port), prints the url, the log path and the agent prompt, and runs until SIGINT/SIGTERM. The log defaults to `<os tmpdir>/agents-skills-trace-<flow>.jsonl` and is truncated at start. | 0 |
| `eval --trace <flow> --log <file> [--json] [--transcript file] [--answer file]` | Checks a call log against the flow; `--answer` (the agent's final answer) runs `expect.answer`. | 0 pass, 1 fail |
| `eval --trace <flow>` / `eval --trace all [--json]` | Validates the flow file(s) against the catalog; one flow also prints its prompt. | 0 / 1 |

Usage errors (no flow name, bad or unknown flow, `--serve`/`--log` with `all`, `--port` out of range, a value flag without a value) exit 2. An invalid flow exits 1.

**Fake server** (MCP Streamable HTTP, JSON responses only, no SSE; `POST /mcp` or `/`; `GET` → 405; `DELETE` → 200):
- `initialize` echoes a supported `protocolVersion` (`2024-11-05`, `2025-03-26`, `2025-06-18`; else `2025-06-18`), `serverInfo.name` `LPM`, header `Mcp-Session-Id: trace-<flow>-<n>`.
- `tools/list` returns every snapshot tool: `{name, description (card purpose), inputSchema {type: object, properties (snapshot param types; "a|b" → [a, b]; "unknown" → {}), required}, annotations.readOnlyHint}`.
- `tools/call` answers from the flow's fixtures as `{content: [{type: "text", text}], isError?}`; a tool with no fixture gets an `isError` result; a tool outside the snapshot gets JSON-RPC error -32602. With `requireArgs`, a call missing a snapshot-required argument gets `isError` `INVALID_ARGUMENT: field=<f> problem=missing_required` (logged with `missingRequired`). `ping`, `resources/list`, `resources/templates/list`, `prompts/list` answer empty; notifications get HTTP 202; batches are supported.
- Log (JSONL, no timestamps): `{"seq", "kind": "initialize", "flow", "clientInfo", "protocolVersion"}` and `{"seq", "kind": "call", "flow", "tool", "arguments", "fixture", "isError", "unknown"?}`.

**Flow file** `evals/trace/<flow>.json` (id = file name, `[a-z0-9-]`):

```js
{ id, title, skill, source,              // documentation: the skill and the procedure the flow follows
  request,                               // the user's prompt; {{scratch}} → the run's scratch dir (the log's dir), {{run}} → the log's base name
  ownerInstruction,                      // null, or the owner's verbatim order (appended to the prompt)
  requireArgs?,                          // true, or [tool]: reject calls missing snapshot-required args (the LPM handler would)
  fixtures: { tool: response },          // object → JSON text; string → text; {"$error": "text"} → isError;
                                         // {"$when": [{after?: <spec>, args?: <partial>, response}], "$default": response}: first entry
                                         // whose `after` call already ran AND whose `args` match THIS call's arguments wins (≥1 of the two);
                                         // templates in responses: {{call.args.<path>}} (this call), {{last.<tool>.args.<path>}} (latest earlier call)
  expect: {
    orderedCalls: [<step>],              // must appear as a subsequence of the calls (other calls may come between)
    forbiddenCalls: [<spec>],            // any match fails ("tool" globs allowed: "answer_*")
    requiresVerify: [{ after: <spec>, read: <spec> }],   // `read` must run after the LAST call matching `after`
    ownerOnlyTools: [tool],              // the [O] tools the owner instruction authorizes
    maxCalls?: { tool: n },              // optional cap for once-only / non-idempotent writes
    answer?: { mustInclude?: [text], mustNotInclude?: [text] } } }   // final-answer text checks (case/space-insensitive), run with --answer
```

A `<spec>` is `"tool"` (glob `*` allowed outside `orderedCalls`), `{tool, args}` (args = deep partial match; arrays and scalars compare exactly) or `{anyOf: [spec]}`. Inside `args` (and `$when.args`) a value may be an operator: `{"$absent": true}` (missing or null), `{"$present": true}`, `{"$contains": [partial]}` (an array where each partial matches some element), `{"$anyOf": [value]}`, `{"$not": value}`. A `<step>` is a spec or `{unordered: [spec]}` (all members, any order, before the next step).

**Checker** (`checkTrace(flow, entries, {knownTools, ownerOnly, transcript})` → `{ok, calls, failures: [{code, message}]}`). Failure codes:
`no-session` (no initialize and no call), `flow-mismatch`, `invalid-log`, `unknown-tool`, `order`, `forbidden`, `owner-only` (an [O] tool, i.e. `ownerOnlyTools` ∪ every catalog tool rendered `[O]`, called without an owner instruction, or not listed in `ownerOnlyTools`), `transcript` (`--transcript` given, an [O] tool called, and the owner instruction is not in it), `max-calls`, `verify`, `answer` (`--answer` given and an `expect.answer` text is missing or forbidden text is present).

**Flow validation** (`validateFlow(flow, catalog, id)`): id = file name; non-empty request; `ownerInstruction` null or non-empty; fixtures and every named tool exist in the snapshot; every ordered tool has a fixture; no glob in `orderedCalls`; every forbidden glob matches a catalog tool; no tool is both ordered and forbidden by name; `ownerOnlyTools` are `[O]` in the catalog; an ordered `[O]` tool is listed in `ownerOnlyTools` and the flow has an owner instruction; orderedCalls or forbiddenCalls is non-empty.

Other exports: `loadTraceCatalog(root)` (`{tools: Map, ownerOnly: Set, purposes: Map, warnings}`), `toolDefinitions`, `listFlows`, `loadFlow`, `flowExpect`, `flowPrompt`, `resolveFixture`, `fillTemplates`, `missingRequired`, `exampleArgs`, `defaultScratchDir`, `startTraceServer({flow, catalog, logFile, port, host})` → `{url, port, logFile, calls, close()}`, `parseLog`, `callMatches`, `partialMatch`, `specLabel`, `specTools`, `synthesizeLog(flow)` (a log that follows the flow exactly; used by the self-tests).

## Validators added after revision 2

- **V4 card files and idempotency** (ported from the card migration's `validate_cards.py`): every `catalog/cards/*.json` is LF with a final newline and sorted by `name`; `pairsWith` never names the card itself or repeats a name; `idempotency` is `not idempotent`, `naturally idempotent`, `idempotencyKey supported` or `keyed by <param>`, optionally followed by `: <note>`; `keyed by <param>` names a parameter of the LPM schema (first segment for `a.b`); `idempotencyKey supported` needs a declared `idempotencyKey`; a declared `idempotencyKey` needs `idempotencyKey supported`, except the five `NATURALLY_IDEMPOTENT_WITH_KEY` tools (another `naturally idempotent` card is a warning). Errata may also target `inputs`.
- **V16 jobs** (warning): every `skill.json` job is routed like a request; a job that lands on another skill (or the fallback) is reported, so it can be fixed in the routing rows and added to `routing-examples.json`.
- **V20 playbook structure** (playbook-standard.md §8.1, `playbook.mjs`): for a skill whose §5 holds `| Playbook | Use when | File |` — §5 is that one table (≤ 10 rows, no `### P<n>`); every `references/flow-*.md` is in exactly one row with File `{{ref:flow-<name>}}`; row Use when = the playbook's `Use when:` line = `skill.json` loadWhen minus `playbook <name>: `; every §4 Do cell is `playbook {{ref:flow-x}}` (Auth = the playbook's strictest tag) or one read `CALL {{tool:x}} {json}`; ⚠ `{{errors:auto}}` in §9; rendered native body ≤ 9,216 bytes (⚠ > 8,192). Each playbook: line 1 `# Playbook: <name>`, line 2 `Use when: …`, line 3 `{{partial:playbook-rules}}`, H2 exactly You need / Steps / Answer; the You need header; steps 1..N (N ≤ 15) that start with CALL, RUN, SAVE:, ASK:, ONLY IF, IF or FOR EACH (ASK, ONLY IF, IF and FOR EACH in their exact grammar); only the default error line before step 1; 3-space sub-lines (5+ = continuation); CALL/RUN sub-lines only in FOR EACH (one per body, no write); every write (snapshot `accessLevel` write, or `git [-C dir] commit|push|tag|merge|rebase|reset|worktree add`, `gcloud`, `npm publish`, `curl -X POST|PUT|PATCH|DELETE`) has a `VERIFY:` read in its step, each VERIFY directly followed by an IF (`IF the call returns an error or …` after `VERIFY: CALL`); every CALL/RUN has its own error line or a default error line that covers it; `[C]` follows an ASK step, `[O]` the ONLY IF step; jumps go forward, never onto a `[C]`/`[O]` CALL step; `switch to playbook` names a sibling; no `{{ref:`, `references/`, `§<n>` or "see/load/read <skill doc>"; `{{skill:x}}` only in `STOP. This belongs to skill {{skill:x}}. Say: …`; one fenced Answer block of exactly Scope/Done/Evidence/Pending/Next, then a `Never claim` line (⚠ a status slot with no ` | ` value list); source ≤ 7,168 bytes (⚠ > 6,144) and ≤ 110 lines. `catalog/contracts.json` `policy.playbookRouter` `"warn"`/`"fail"` also reports every `kind: tools` skill without the index (absent: not reported).
- **V21 CALL lines** (§8.2): every playbook CALL (numbered, FOR EACH, VERIFY) and §4 CALL row: shape `CALL {{tool:x}} {json} [A|C|O]` (§4: no tag); tool in the snapshot and in `owns ∪ uses`; `JSON.parse` gives an object; keys ⊇ required and ⊆ params; number/integer/boolean params take literals of that type; strings hold only `<input:x>`/`<saved:x>`/`<each:x>` slots; every `<input:x>` has a You need row (§4: a §3 Inputs row); every `<saved:x>` is SAVEd on an earlier line or earlier on the same SAVE line (Answer: anywhere in the steps); `<each:x>` only in FOR EACH; tag lower than the rendered authority ✖, stricter ⚠.
- **V7** skips its `### P<n>` checks and the "§9 has no {{errors:auto}}" warning for playbook skills. **V14**: a playbook skill's `dist/generic/<id>.md` is at most 12 KB (others 24 KB); `<id>.flows.md` warns above 48 KB. **V12**: the default `bundle` scope for generic adds `<id>.flows.md`, which is skipped when the skill has none.
- **V22 trace flows** (V20 before revision 3): each `evals/trace/<flow>.json` names an existing skill, and every tool the flow expects to be called (`orderedCalls`, `requiresVerify`) is named in that skill's `SKILL.src.md`, its references or a shared reference it bundles.
- **V14**: `dist/generic/<id>.tools.md` warns above 128 KB (the cards of every owned and used tool); `<id>.refs.md` keeps the 64 KB warning.

## Install files

- `<root>/install-targets.json` (optional, not committed by default): `{ "projects": [ "<path>" | { "path": "<path>", "agents": ["codex" | "claude-code" | "antigravity"] } ] }` (a bare array is accepted). Paths may start with `~/` and resolve against the repository root. `verify --scope project` without `--project` checks `<path>/.agents/skills` (`<path>/.claude/skills` for Claude Code) of every entry whose `agents` list includes the agent (no list = every agent); without the file it checks the current repository only.
- `<dest>/.agents-skills-manifest.json` (written by `install`/`update`, read by `verify`, `update`, `prune` and `doctor`): `{ schemaVersion: 1, generatedBy, sourceCommit (agents-skills HEAD or null), agent, scope ("user" | "project"), selection { mode "profile" | "skills" | "all", profile, skills[], includeInternal, includeExternal }, shared { files { path: sha256 } } (generic only: INDEX.md, AGENTS-snippet.md), skills { id: { version, pack, files { path: sha256 } } } }`. Only ids listed in `skills` are ever removed.

