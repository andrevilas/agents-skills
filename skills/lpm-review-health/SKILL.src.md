# Review project or portfolio health (read-only)
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: a health, status or risk review ("o que precisa da minha atenção?", "revisão semanal").
Do not use:
| If the request is about | Use |
|---|---|
| fixing overdue, unassigned or unestimated work, or a stale cycle | {{skill:lpm-plan-work}} |
| fixing a blocked activity or a dependency | {{skill:lpm-unblock-work}} |
| scope drift, orphan requirements, change sets or baselines | {{skill:lpm-requirements-scope}} |
| orphan AISH jobs or job/activity mismatches | {{skill:lpm-aish-delivery}} |
| deciding a pending governance decision | {{skill:lpm-governance-decisions}} |
| historical health trends (daily exports) | {{skill:lpm-integrations}} |

## 2. Preconditions
1. Connector (ChatGPT/Claude) = {{tool:get_project_analytics}} absent: one project → row 3, portfolio → P3. Rows 6, 7, P1, P2: LPM API key, profile read-only (portfolio/planning lack {{tool:get_project_scope_resolution_context}}, {{tool:list_aish_jobs}}).
2. Exception to core rule 2: -32003 or a missing tool in P1/P2 → do NOT stop; run P4, `howToEnable` text under Pending.
3. Owner surface and risk tools need a governance role; denied → row 4.
4. Name the scope (workspace/project/cycle) first. Archived projects: not reviewed. No write tool.
5. `ownerView.finance` (always sent): only when asked, as "owner-level rollups, not a budget authorization".
6. Never offer to cancel, delete or clean up anything. Both → {{skill:lpm-aish-delivery}}: `orphan-aish-jobs` "lineage repair or administrative closure with evidence"; `orphan-autopilot-issues` "inspect run and job lineage before any cancel" (title heuristic).

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| scope | the user: project, cycle or workspace | ask (§6) |
| workspaceId | {{tool:list_workspaces}} → `id` (the only one, or exactly one `name` match) | ask |
| projectId | the user's id; a name → P1 step 0; P3 step 1 `ownerView.projects[].projectId` | ask |
| cycleId | {{tool:list_cycles}}(projectId) → `id` with `status == "active"` | none → "no active cycle" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a fix (change, close, cancel, assign) | owner skill = §1 table | A | before the first call → §6 row 2; after yes → continue (row 10/12) |
| 2 | burndown, velocity, trend | "not returned over MCP"; P1 / P4 | A | history → {{skill:lpm-integrations}} |
| 3 | a review of one project on a connector, or -32003 / missing tool in P1/P2 | P4 ({{ref:flow-portfolio-connector}}) | A | P4 tool missing → core rule 2 |
| 4 | "You do not have access to this owner surface" | skip P1 step 3, P2; risks ← {{tool:get_project_read_model}} `ownerView.risks[]` | A | ask for a role |
| 5 | project risks, "list the risks" | P2 | A | — |
| 6 | late or unassigned items | {{tool:list_overdue_project_issues}}, {{tool:list_unassigned_project_issues}}(projectId, limitCount=100) | A | fix → {{skill:lpm-plan-work}} |
| 7 | intake queue health | {{tool:get_operational_analytics}}(projectId) | A | → {{skill:lpm-intake-triage}} |
| 8 | owner-agent snapshot, "what changed" | {{tool:get_workspace_owner_context_bundle}}(workspaceId, sinceVersion) ({{ref:integrity-signals}}) | A | connector → P3 |
| 9 | workspace readiness | {{tool:generate_workspace_readiness_report}}(workspaceId) | A | → {{skill:lpm-executive-context}} |
| 10 | weekly review | one project: P1 (a name → step 0) + P2; else P3, then P1 + P2 (connector P4) per candidate | A | over 5 candidates → ask |
| 11 | portfolio, "what needs my attention" | P3 | A | — |
| 12 | any other review of one project or cycle | P1, a name → step 0 (cycle: Scope names `cycleId`; metrics are project-wide) | A | archived → "not reviewed" |

## 5. Procedures
### P1 Project health (API key) — rows 2, 10, 12
0. Project given by name: {{tool:list_projects}}(workspaceId) → exactly one `name` match → projectId = its `id`; 0 or 2+ → ask "Which project: <names>?".
1. Before any other project read: {{tool:get_project_scope_resolution_context}}(projectId) → `currentBaseline`, `requirementsAwaitingBaseline.count` = n. n > 0 → Pending "<n> requirements awaiting baseline → lpm-requirements-scope — the owner" (not optional). n > 0 and any later owner surface, read model or risk read in this run → the Done line MUST end with "; LPM may have re-attached <n> orphan requirements (server side effect)".
2. {{tool:get_project_analytics}}(projectId) → status = `metrics.healthStatus` + threshold fired ({{ref:health-thresholds}}). `metrics.integrity.signals[]` non-empty → never "healthy" ({{ref:integrity-signals}}); `healthStatus == "healthy"` anyway → status = `metrics.integrity.status` (source: get_project_analytics metrics.integrity.status) + Pending "LPM defect: healthStatus healthy with integrity signals".
3. Skip when P2 runs (quota): {{tool:get_project_owner_surface}}(projectId) → `ownerView.delivery`, `.governance`, `.decisions.pendingCount` (> 0 → Pending "decisions → lpm-governance-decisions — the owner").
4. `blockedIssuesOpen > 0` → {{tool:list_blocked_project_issues}}(projectId, limitCount=25) (denied → step 2 `projects[0].blockedIssues`); {{tool:get_project_dependency_summary}}(projectId) → `criticalBlockers[]`.
5. Verify: every number is in a result of steps 1–4.
### P2 Owner risks — rows 5, 10
1. P1 step 1 first. {{tool:list_project_resolution_risks}}(projectId) → `risks[]` (riskId = `id`, `severity`, `entityCount`, `requiresHumanReview`); empty → "no firing risks". Decisions = `entityCount` of `governance:decision-needed` (absent → 0).
2. Up to 5, high first: {{tool:get_project_resolution_context}}(projectId, riskId, limitCount=25); actions only → {{tool:get_project_resolution_action_catalog}}; all items → {{tool:list_project_resolution_entities}} to `nextCursor` null.
3. Risk id → owner skill ({{ref:integrity-signals}}). `allowed` is not a permission. `requiresHumanReview == true` → write "Who decides: the owner" in that Recommended actions row and continue. NOT a stop; no decision request.
4. Verify: every risk id is in step 1 `risks[].id`.
P3 (portfolio), P4 (connector): {{ref:flow-portfolio-connector}}.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no scope | "Which scope: project <name>, one of its cycles, or workspace <name>?" |
| a fix is asked | BEFORE any tool call ask exactly (user's language): "Esta revisão não altera nada; <the fix asked> é feito com <owner skill>. Termino o relatório primeiro?" Yes → run the review with no further question; put the fix under Pending and Next. No → hand off to <owner skill> and STOP. |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| a fix by someone | {{tool:get_project_analytics}} after ~10 s | signal gone |
| the report | {{ref:report-template}} | each number names its tool |

## 8. Report (copy and fill)
Full report: {{ref:report-template}}.
Write every label and sentence in the user's language (PT-BR request → PT-BR report: Escopo, Feito, Evidências, Pendências, Próximo, "sem filtro de ciclo"). Keep ids, tool names and riskIds verbatim.
```text
Scope: <workspace / project / cycle, with ids>
Done: read-only review; status <healthy|watch|critical> (source: <tool>)[; LPM may have re-attached <n> orphan requirements (server side effect)]
Evidence: <metric = value (tool)>; risks <riskId severity>
Pending: <finding → owner skill — who decides> | none
Next: <owner skill + its first step>
```
`[…]`: P1 step 1.

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|

## 10. Tools and references
{{tools:index}}
{{refs:index}}
