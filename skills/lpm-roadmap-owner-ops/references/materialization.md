# Roadmap materialization
Load when: materializing
Applies to: lpm-roadmap-owner-ops    Source: cards {{tool:preview_roadmap_materialization}}, {{tool:commit_roadmap_materialization}}, {{tool:list_workspace_roadmap_materializations}} (`previewRoadmapMaterializationCommand`, `validateRoadmapMaterializationV2`, `computeRoadmapMaterializationSummary`)

## Summary
Materialization records that an approved roadmap item is covered in one project: it links an existing requirement or creates a new pending requirement in the project baseline.
It creates NO activities (issues). The item+project lineage claim is permanent: no tool undoes it.
Always preview right before the commit, copy `item.updatedAt` as `sourceItemVersion`, and retry with the SAME idempotencyKey.
After the commit, the new requirements belong to {{skill:lpm-requirements-scope}} (working scope, baseline, publication).

## Facts
### Methods
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `linked_existing` | links a requirement that already exists in the project | requires `requirementId` (preview candidate or {{tool:list_requirements}}) |
| `new_requirement` | creates a requirement: item title, type `business`, status `pending` | requires a project requirement baseline |
| `split_from_parent` | records a split of a parent requirement | requires `rationale` |
| `conflict` | records a conflict, no requirement | `requirementId` must be empty; requires `rationale` |
| `deferred` | records a deferred decision | requires `rationale` |
| productive methods | `linked_existing`, `new_requirement`, `split_from_parent` | only one productive lineage per item+project |
| `lineageState` | `productive` or `attention` (legacy records may lack it) | report it with the method |

### Preconditions and fields
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| item lifecycle `approved` | required | not approved → the owner decides the gate first (two calls from `imported`) |
| allocation for the project | active, role not `observer` | missing → the owner allocates first; observer is never eligible |
| preview candidate `method == "deferred"` with "must be approved" or "has no confirmed project allocation" | blocking reason | STOP; never commit that candidate |
| preview candidates | may include superseded or observer allocations | the commit rejects them; choose active non-observer ones |
| `projectId` on preview | matches only that project's current baseline and fills `baselineId` | always pass it |
| `sourceItemVersion` | preview `item.updatedAt`, copied exactly | item changed → "Roadmap item changed after preview" → preview again |
| `idempotencyKey` | `^[A-Za-z0-9._:-]{12,160}$`, e.g. `mat:<itemId>:<projectId>:<method>:<yyyymmdd>`; a completed key returns its old result (`idempotentReplay`) | retry of the same call → same key; a new method or intent (e.g. `new_requirement` after `deferred`) → new key; a new key can fail with "A productive materialization already exists" |
| `confirmed` | must be `true` | only after the owner's "yes" |
| `baselineId` | default: the project's current baseline | from {{tool:list_requirement_baselines}} (`isCurrent`) |
| commit changes the item's `updatedAt` | the next project needs a new version | preview again before the second project |
| stored item lifecycle | stays `approved` | progress is in `materializationSummary.state`; `delivered` then fails |
| `materializationSummary.state` | `unmaterialized`, `partial`, `complete`, `attention` | report it after each commit |
| governance mode | the commit does not check it | owner order is the only gate |

## Rules
1. One project per commit; one fresh preview per commit.
2. Show project, method, requirementId and baselineId and say "This is permanent" before the commit.
3. After a timeout or error, check {{tool:list_workspace_roadmap_materializations}} first, then retry with the SAME key.
4. Never create activities here; planning them is a later step outside this skill.

## Examples
```text
example: {{tool:commit_roadmap_materialization}}(workspaceId, itemId="<item>", projectId="<project>",
  method="new_requirement", confirmed=true, idempotencyKey="mat:<item>:<project>:new_requirement:<yyyymmdd>",
  sourceItemVersion="<preview item.updatedAt>")
→ returns id, requirementId, baselineId, lineageKey, materializationSummary{state}
```
