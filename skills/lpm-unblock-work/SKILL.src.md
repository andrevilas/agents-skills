# Resolve blockers and dependencies
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "por que X está bloqueada?", "what blocks P?", "caminho crítico"
- "X depende de Y", "registre o bloqueio", "unblock X"
- "remova o vínculo errado", "needs an owner decision"
Do not use:
| If the request is about | Use |
|---|---|
| dependencies between roadmap items | {{skill:lpm-roadmap-owner-ops}} |
| closing the activity | {{skill:lpm-deliver-activity}} |
| owners, dates or estimates | {{skill:lpm-plan-work}} |
| deciding the thread | {{skill:lpm-governance-decisions}} |
| a health report | {{skill:lpm-review-health}} |

## 2. Preconditions
1. Connector: summary, graph, {{tool:list_project_resolution_risks}}, {{tool:get_issue}}, {{tool:list_issues}} and comments work; links and contexts need an API key. CLI: `lpm portfolio-links` list/create/update.
2. {{tool:list_blocked_project_issues}} needs a governance role (else P1 step 2).
3. "Project is not linked to a workspace." → graph, summary and heatmap are unavailable; use P1 step 1, {{tool:list_issue_links}}, P2 (same-project links, flow step 5) and P3.
4. Read-only request ("why", "show") → no write in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{skill:lpm-start}} §3 | ask |
| X (`issueId`) | user, P1 `items[].id`, graph `nodes[].taskId`; by title {{tool:list_issues}}(projectId, limitCount=100; cursor=`nextCursor` until null) → `items[].id` with exact `title` | 0 or 2+ → ask |
| U, `upstreamProjectId` | user, {{tool:get_project_dependency_summary}} → `criticalBlockers[].blockers[].issueId` / `.projectId`; by title: as X with upstreamProjectId. `upstreamProjectId` = projectId unless the user or the summary says otherwise | ask |
| `otherWorkspaceId` | user; {{tool:list_workspaces}} → `id` | ask |
| other project | {{tool:list_workspace_projects}}(workspaceId, or otherWorkspaceId) → `id` | ask |
| `<n>` in a comment key | 1; +1 per other comment of that kind on that day | — |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | connector (no {{tool:list_blocked_project_issues}}) AND what is blocked / why, or record a blocker | {{tool:get_project_dependency_graph}}(projectId, blockedOnly=true), {{tool:get_project_dependency_summary}}(projectId), {{tool:list_project_resolution_risks}}(projectId); only when the user asked to record it: {{tool:create_comment}}(key "blocker-<issueId>-<yyyymmdd>-<n>") | A | read-only; link/context → "needs an API key" |
| 2 | what is blocked / why | P1 | A | read-only |
| 3 | critical path or cycles | {{tool:get_project_dependency_graph}}(projectId, maxTaskNodes=50) → `criticalPathNodeIds` | A | `meta.hasDependencyCycle` → §6 |
| 4 | most coupled projects | {{tool:get_project_dependency_heatmap}}(projectId) → `strongestCoupling` | A | — |
| 5 | X waits for activity U | P2 ({{ref:flow-add-link}}) | A; C cross-workspace | link exists → report it |
| 6 | X waits for an external cause | P3 | A | — |
| 7 | X waits for an owner decision | {{ref:flow-owner-decision}} | A | — |
| 8 | the external cause is gone | P4 ({{ref:flow-resolve-release}}) | A | owner-decision text without the decision |
| 9 | U is done or canceled | P5 ({{ref:flow-resolve-release}}) | A | U still open |
| 10 | link wrong, dangling, or cross-workspace done | {{ref:flow-remove-link}} | C | link not confirmed |
| 11 | "set status blocked" | never set status `blocked` → rows 5-7 | — | — |

## 5. Procedures
### P1 Diagnose — row 2
1. {{tool:list_blocked_project_issues}}(projectId, limitCount=100; cursor=`nextCursor` until null) → `items[].id`, `details`.
2. Denied → {{tool:get_project_dependency_graph}}(projectId, blockedOnly=true) → `taskId`; cause text: {{tool:get_issue}}(projectId, taskId) → `blockerContext.content`.
3. {{tool:get_project_dependency_summary}}(projectId) → `criticalBlockers[]`; rank upstream by `isOnCriticalPath`, then `impactCount`.
4. Cause per item: {{ref:blocked-semantics}}. Upstream {{tool:get_issue}} "Issue not found" = dangling → row 10.
### P2 Link U blocks X — row 5
1. FIRST load {{ref:flow-add-link}}; run its steps 1–9 in order, never from §4, §6 or §7 alone.
2. Before any create: (a) ids: user, else {{tool:list_issues}}(projectId — for U upstreamProjectId —, limitCount=100) → `items[].id` with exact `title`, all pages; (b) {{tool:get_issue}}(projectId, X) → open; (c) {{tool:get_issue}}(upstreamProjectId, U) → not `done`/`canceled`; (d) same project: {{tool:list_issue_links}}(projectId) → no U→X, no X→U.
3. Link creates and the P3 context set take no `idempotencyKey`: re-read the list before a retry.
4. Next (same or other project): "Finish U; the block ends by itself when U is `done`/`canceled`." Never say the link must be resolved (row 9 only comments).
### P3 Blocker context — row 6
1. {{tool:get_issue}}(projectId, issueId) → `blockerContext`; active with this cause → STOP.
2. Other active cause → §6: still true → text = old + " | " + new; gone → {{tool:resolve_project_issue_blocker_context}}(projectId, issueId, resolution=<user>) [A].
3. {{tool:set_project_issue_blocker_context}}(projectId, issueId, blockerContext="<what> — <who unblocks> — since <date>") [A]. It REPLACES an active context and comments itself.
4. Verify: {{tool:get_issue}} → `blockerContext.status == "active"`.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| direction unclear, or the reverse link X blocks U exists | "Which must finish first: <A> or <B>?" |
| other active cause | "Is '<content>' still blocking?" |
| cross-workspace link | "Link <U> blocks <X>, summary '<≤240 chars, seen by both>'?" |
| `meta.hasDependencyCycle` (whole workspace) | report the cycle edges among this project's nodes; only when it touches this project ask "Which link in <A → B → A> is wrong?" |
| scope change asked | row 7 (GOV-MAX v1) |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| link writes (row 5, row 10) | the scope's list call | linkId present / absent / `status` set |
| {{tool:create_workspace_issue_link}} | + {{tool:get_project_dependency_summary}}(projectId) | `criticalBlockers[]` has X |
| {{tool:set_project_issue_blocker_context}}, {{tool:resolve_project_issue_blocker_context}} | {{tool:get_issue}} | `blockerContext.status` `active` / `resolved` |
| {{tool:create_comment}} | {{tool:list_comments}} | comment id exists with your text; other text → key reused: retry with `<n>`+1 |
| any write except cross-project and cross-workspace links | {{tool:list_blocked_project_issues}} (denied: graph `blockedOnly=true`) | X shows the cause or is gone |

## 8. Report (copy and fill)
```text
Scope: <workspace>/<project>/<blocked issueIds>
Done: <link ids (U blocks X)>, <contexts>, <comment ids>
Evidence: <list call + field per change>
Pending: <none | cause — who must act>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|

## 10. Tools and references
{{tools:index}}
{{refs:index}}
