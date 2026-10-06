# Flow: materialize an approved item
Load when: SKILL.md row 10

## Preconditions
1. SKILL.md P1 passed: the owner's order naming the item and the project is quoted. The server does not check the governance mode here. SKILL.md row 1 (read-only): step 2 only, no P1, no write.
2. API key whose profile lists the tool (tools.md): `full`, `requirements` or `custom`; not on connectors.
3. Load {{ref:materialization}}. itemId and roadmapId come from SKILL.md §3; the other ids from the table below.

| Input | Get it from (call → field) | If missing |
|---|---|---|
| projectId | {{tool:list_workspace_projects}}(workspaceId) → `id` | ask |
| baselineId | {{tool:list_requirement_baselines}}(projectId) → `id` where `isCurrent` | step 3 ask |
| requirementId | preview `candidates[].requirementId`, or {{tool:list_requirements}}(projectId, baselineId) → `id` | ask |
| rationale | the owner | ask; never invent |

## Steps
1. Item `lifecycle` (SKILL.md §3) is not `approved` → SKILL.md row 8 first, on the owner's decision.
2. {{tool:preview_roadmap_materialization}}(workspaceId, itemId, projectId) [A] → keep `item.updatedAt`, `candidates`.
3. Candidate `method == "deferred"` → STOP, report its rationale. `new_requirement` and no `isCurrent` baseline → ask (§ Stop and ask).
4. Show project, method, requirementId, baselineId; say "This is permanent"; wait for "yes".
5. {{tool:commit_roadmap_materialization}}(workspaceId, itemId, projectId, method, requirementId, baselineId, rationale, confirmed=true, idempotencyKey="mat:<itemId>:<projectId>:<method>:<yyyymmdd>", sourceItemVersion=`item.updatedAt`) [O]. Retry of the same call → SAME key; a new method or intent → a new key (an old key replays the old result).
6. Verify: {{tool:list_workspace_roadmap_materializations}}(workspaceId, roadmapId, projectId) has `itemId`; new requirement → {{tool:list_requirements}}(projectId, baselineId) lists `requirementId`.
7. Next project → step 2 (the commit changed `item.updatedAt`).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| before {{tool:commit_roadmap_materialization}} | "Record the materialization of <item> in <project> as your decision? Materialization is permanent." |
| `new_requirement` and no `isCurrent` baseline | "Link an existing requirement, or create a baseline first ({{skill:lpm-requirements-scope}})?" |
| "A productive materialization already exists" | check {{tool:list_workspace_roadmap_materializations}}; own earlier attempt → retry with the original key; else report it |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| materialization | {{tool:list_workspace_roadmap_materializations}} | record with this `itemId`, `projectId` and method |
| new requirement | {{tool:list_requirements}}(projectId, baselineId) | `requirementId` listed |

## Report fields
- itemId, projectId, method, requirementId, baselineId
- `materializationSummary.state`, `lineageState`
- next: new requirements → {{skill:lpm-requirements-scope}}
