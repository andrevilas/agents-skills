# Requirements, baselines and change sets
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "crie / edite / agrupe o requisito <R>", "mark <R> as met"
- "o escopo mudou desde a baseline?", "prepare a change set"
- "o dono autorizou: publique a baseline"
Do not use:
| If the request is about | Use |
|---|---|
| roadmap items or change requests | {{skill:lpm-roadmap}} |
| materializing a roadmap item | {{skill:lpm-roadmap-owner-ops}} |
| the owner's scope decision in a thread | {{skill:lpm-governance-decisions}} |
| activities that deliver a requirement | {{skill:lpm-plan-work}} |
| evidence or closure of a linked activity | {{skill:lpm-deliver-activity}} |

## 2. Preconditions
1. Connector: row 1 only; other rows need an LPM API key.
2. Edits change only the working scope. Approved scope (current-baseline requirement, `createdAt` <= `currentBaseline.createdAt`) changes only on the owner's order; a non-owner's "yes"/"eu confirmo" is NOT it. Without it: obsolete, delete, title or type change → {{tool:create_governance_thread}}(projectId, targetType="requirement", targetId=requirementId, title, content=<ids; options A obsolete (keeps history), B delete (links lost), C keep; recommend A>) [A] → report the thread id, change nothing, STOP. Description rewrite → row 9.
3. Read-only request ("status", "drift") → call no write tool in this run.
4. {{tool:create_requirement}}, {{tool:update_requirement}}, {{tool:delete_requirement}} take NO `idempotencyKey`: never send one; re-read before any retry.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{skill:lpm-start}} §3 | ask |
| `baselineId` | P1 → `currentBaseline.id`; other: {{tool:list_requirement_baselines}}(projectId) → `id` | row 11 |
| `requirementId` | {{tool:list_requirements}}(projectId, baselineId) → `id` by `title` | 0 or 2+ → ask |
| `changeSetId` | {{tool:list_change_sets}}(projectId) → `id` | flow creates it |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | ChatGPT/Claude connector | {{tool:get_project_execution_context}}(projectId) → `scope.{currentBaseline, workingScope}`, `scope.publicationGate.{shouldBlockPublication, draft.reviewPolicy.materiality, draft.reviewPolicy.reasonCodes}`, `changeSets.items[].status`; traceability: row 3 flow, precondition 4 | A | a write → "needs an LPM API key" |
| 2 | status, drift, traceability, "can we publish?" | P1 | A | never write |
| 3 | add, edit, link or group requirements | {{ref:flow-requirements}} | A·C | approved scope, no owner order → §2.2 thread, STOP; never delete/update it |
| 4 | mark a requirement `met` | row 3 flow, step 2 | C | step 2 fails → "not met yet" |
| 5 | remove a requirement | row 3 flow, step 5 | C | approved scope, no owner order → §2.2 thread, STOP; never delete/update it |
| 6 | orphans (`requirementsAwaitingBaseline.count > 0`) | row 3 flow, step 7 | C | no baseline → row 11 |
| 7 | change set: create, send to review, back to draft | {{ref:flow-change-set}} | A·C | `affectedCount == 0` → "no change set needed" |
| 8 | change set: approve or reject | row 7 flow, step 7 | O | no owner order → §6 |
| 9 | propose scope without touching live requirements | row 7 flow, step 9 | A·C (approve/reject O) | new free text → {{skill:lpm-governance-decisions}} |
| 10 | publish a baseline | {{ref:flow-baseline}} | O | no owner order → §6 |
| 11 | first baseline, rename, restore as current, delete | row 10 flow, steps 6-8 | O | no owner order → §6 |

## 5. Procedures
### P1 Scope status — row 2
1. {{tool:get_project_scope_resolution_context}}(projectId) → keep `currentBaseline`, `workingScope`, `requirementsAwaitingBaseline.count`, `publicationGate`.
2. `affectedCount > 0` → {{tool:list_working_scope_delta_entities}}(projectId, changeType="added", limitCount=100), then changeType="changed"; page with cursor=`nextCursor` → keep `items[].requirementId`, `title`, `changeType`, `changedAt`.
3. Never claim "no removals" (the delta never shows them; `removedCount` is always 0); list this run's deletions.
4. `shouldBlockPublication == false` → "publication not blocked"; else explain each `reasonCodes` entry ({{ref:materiality-and-gate}}). Traceability → row 3 flow, precondition 4.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| approved-scope change without the owner's order (even "pode fazer, eu confirmo") | §2.2: {{tool:create_governance_thread}} on the requirement; STOP |
| an [O] step without the owner's order for this exact action | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |
| approve or reject a change set (a user's "yes" is not the owner's order) | "Owner: approve or reject change set <title> (<id>, materiality <m>)?" STOP |
| orphans, or a delete of working (not approved) scope | the flow's exact question; wait for "yes" |
| `isCurrent:false`, `publicationBaselineId` or {{tool:publish_change_set}} before publishing | refuse (they dodge the gate) |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any write | the flow's Verify | every row passes |

## 8. Report (copy and fill)
Use the user's language. Evidence: only reads you made; never "all checks pass".
```text
Scope: <workspace>/<project>; baseline <version> (<id>)
Done: <requirement / change set (status) / baseline / thread ids>
Evidence: get_project_scope_resolution_context → currentBaseline.id, addedCount, changedCount; get_change_set → status, publicationBaselineId (if a change set); owner quote: "<text>"
Pending: <none | owner review | owner decision | removals: <list>>
Next: <exactly one action, or "none"; never invent a baseline version>
```
Escalation (§2.2): `Done: thread <id> on <req id> (unchanged) | Pending: owner decision | Next: owner answers in thread <id>`

## 9. Failures → fix
{{errors:auto:publish_baseline_from_working_scope,create_requirement,update_requirement,list_requirements,get_change_set,update_requirement_baseline,update_requirement_group,create_governance_thread}}
| Error or result contains | Do |
|---|---|
| `publish_baseline_from_working_scope`: Immutable proposal not found | Live change set: nothing published; retry WITHOUT `changeSetId`, its id only in `publicationNotes`. |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
