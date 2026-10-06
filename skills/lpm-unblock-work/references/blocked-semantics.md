# Blocked semantics
Load when: background: why an activity is or is not blocked
Applies to: lpm-unblock-work    Source: `src/lib/projectResolution.ts:443-478,592-606`, `src/lib/projectResolution.test.ts:448-483`, `src/lib/issueLinkDirection.ts`, `src/services/dependencyIntelligence.ts`; cards {{tool:list_blocked_project_issues}}, {{tool:set_project_issue_blocker_context}}, {{tool:get_project_dependency_graph}}, {{tool:list_issue_links}}
## Summary
An open activity (status not `done`/`canceled`, not deleted) is blocked when ANY of these holds:
an open upstream activity through a `blocks` link, an ACTIVE blocker context, or the legacy status `blocked`.
Which links count depends on the tool: {{tool:list_blocked_project_issues}} reads only same-project links; graph, summary and the next-activity recommendation also read cross-project links of the workspace.
A link stops blocking by itself when its upstream activity is `done` or `canceled`.
A link whose upstream id no longer exists (dangling link) still blocks: remove it.
`blocked` is not an activity status. Record a block as a link or a blocker context.
One blocker context per activity: a second set REPLACES the first without a resolution.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| link `type == "blocks"` | `sourceIssueId` blocks `targetIssueId` | the blocked activity is the target |
| written `type == "is-blocked-by"` | stored as `blocks` with source and target swapped | {{tool:list_issue_links}} shows `blocks` with reversed ids |
| legacy row `type == "is-blocked-by"` | old row: the target blocks the source | read the direction from the type before you explain it |
| `duplicates`, `related-to` | no effect on blocked state, chains or the critical path | never use them to record a block |
| `blockerContext.status == "active"` | the activity is blocked by the recorded text | it IS listed by {{tool:list_blocked_project_issues}}, with or without a link (`projectResolution.ts:474-476`) |
| `blockerContext.status == "resolved"` | the cause was cleared with a resolution text | no effect on blocked state |
| upstream id "Issue not found" | dangling link | counts as an active blocker until the link is deleted |
| status `blocked` on an activity | legacy value written by an old API-key call | flagged as an integrity error (`invalid-issue-statuses`); OAuth rejects it; the valid statuses are `backlog`, `todo`, `in-progress`, `done`, `canceled` |
| {{tool:list_blocked_project_issues}} `details` | labels "Bloqueadores", "Bloqueado por", "Contexto do bloqueio" (Portuguese) | quote them; the activity id is `items[].id` |
| `details` "Bloqueadores: Status bloqueado" | printed whenever no same-project blocking link exists, whatever the cause (`projectResolution.ts:598-604`) | with "Contexto do bloqueio" present it is a blocker context; it is the legacy status only when {{tool:get_issue}} → `status == "blocked"` |
| cross-project (same workspace) link | counts in graph, summary and the next-activity recommendation; NOT in {{tool:list_blocked_project_issues}} nor the `delivery:blocked` risk (they read only the project's own `issue_links`) | verify it with {{tool:get_project_dependency_summary}} → `criticalBlockers[]` |
| graph node `metadata.blockerContext` | only `{status, capturedAt}`, no text | cause text: {{tool:get_issue}} → `blockerContext.content` |
| summary without `includeResolved` | drops `done`/`canceled` task nodes and the edges to them; `activeChains` list only the called project's tasks | for a finished upstream U call it with U's project and `includeResolved=true` |
| {{tool:list_blocked_project_issues}} access | needs project-owner, product-owner or delivery-lead role, or project ownership | denied → {{tool:get_project_dependency_graph}}(blockedOnly=true) or {{tool:get_project_dependency_summary}} |
| graph node `id` | `task:<issueId>`, `project:<projectId>` or a workspace node | use `taskId` as issueId; `criticalPathNodeIds` keep the prefix |
| graph `meta` | computed for the whole workspace, not filtered | do not report `meta.taskCount` as the project count; `hasDependencyCycle` may come from another project |
| `meta.criticalPathConfidence == "low"` | estimates or due dates are missing (`criticalPathMissingEstimateCount`, `criticalPathMissingDateCount`) | say the path is uncertain; estimates belong to {{skill:lpm-plan-work}} |
| `density.limited == true` | `maxTaskNodes` cut nodes (`omittedTaskCount`) | say the graph is truncated |
| summary chain status `blocked` | derived: open blocker link OR active context | summary `criticalBlockers[]` = chains with an open blocker |
| graph, summary, heatmap inputs | every issue, project link and same-workspace cross-project link of the workspace | slow on big workspaces; set `maxTaskNodes` |
| cross-workspace (portfolio) link | not among those inputs | also set a blocker context naming the link id so the block shows; resolve that context when the link is closed (playbook close-portfolio-link does both) |
| "Project is not linked to a workspace." | graph, summary and heatmap cannot run | use {{tool:list_blocked_project_issues}}, {{tool:list_issue_links}}, same-project links and blocker contexts (they need no workspace) |
| risk ids | `delivery:blocked`, `delivery:overdue`, `delivery:ownership-gaps`, `delivery:unestimated`, `governance:decision-needed`, `scope:*` | only firing risks are listed; titles are in Portuguese |
| {{tool:list_project_resolution_risks}} with an API key | may spend grounding quota and re-attach orphan requirements to the current baseline | the playbooks do not call it; health reports belong to lpm-review-health |
| portfolio link `status` | `active`, `resolved`, `archived` | pass `status="active"` to see current blockers only |

## Rules
1. Explain a block with the field that causes it: link id, context text, dangling id, or legacy status.
2. Never say a blocker is resolved without a read that shows it: upstream `status` `done`/`canceled`, context `resolved`, or link absent.
3. Unblock upstream first: the upstream activity on the critical path with the highest `impactCount`.
4. Keep the upstream activity and its downstream blast radius (`blocked[]`, `impactCount`) in every report.
5. Never collapse several blockers into one generic note: one link per upstream activity, one context listing every external cause.
6. Separate diagnosis from change: report the cause first, then apply the smallest fix.

## Examples
```text
example: list_blocked_project_issues → item id "abc123", details "Bloqueado por: def456".
list_issue_links → {type: "blocks", sourceIssueId: "def456", targetIssueId: "abc123"}.
get_issue(def456) → status "in-progress". Cause: open upstream link. Fix: finish def456.

example: get_issue(abc123) → blockerContext {status: "active", content: "Waiting for vendor API key — vendor ops — since 2026-09-30"}.
No link. Cause: external. Fix when the key arrives: resolve_project_issue_blocker_context.

example: list_issue_links → {type: "blocks", sourceIssueId: "zzz999", targetIssueId: "abc123"}; get_issue(zzz999) → "Issue not found".
Cause: dangling link. Fix: delete_issue_link after the user confirms.
```
