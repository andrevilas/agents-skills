# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "revisão de saúde do projeto <nome>", "is project <id> healthy?", "list the risks"
- "o que precisa da minha atenção no portfólio?", "weekly review", "relatório de status semanal"
- "what changed?", intake queue health, workspace readiness
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
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Read-only: no write tool. A fix asked together with a review → the playbook's step 1 asks first; a fix alone → §6.
3. Connector = {{tool:get_project_analytics}} is not in your tool list. -32003 inside playbook project → it switches to playbook connector (exception to core rule 2).

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{tool:list_projects}} → `id` of the one name match | ask "Which project? (id or name)" |
| workspaceId | the user or this session, or {{tool:list_workspaces}} → `id` | ask "Which workspace?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a review of one project on a ChatGPT/Claude connector | playbook {{ref:flow-connector}} | A | — |
| 2 | health, status, risks or weekly review of one project or cycle; burndown, velocity, trend | playbook {{ref:flow-project}} | A | archived → "not reviewed" |
| 3 | portfolio, "what needs my attention", weekly review of a workspace | playbook {{ref:flow-portfolio}} | A | too large → user picks ≤ 5 |
| 4 | owner-agent snapshot, "what changed" | playbook {{ref:flow-changes}} | A | connector → row 3 |
| 5 | late (overdue) items | CALL {{tool:list_overdue_project_issues}} {"projectId":"<input:projectId>","limitCount":100} | A | fix → {{skill:lpm-plan-work}} |
| 6 | unassigned items | CALL {{tool:list_unassigned_project_issues}} {"projectId":"<input:projectId>","limitCount":100} | A | fix → {{skill:lpm-plan-work}} |
| 7 | intake queue health | CALL {{tool:get_operational_analytics}} {"projectId":"<input:projectId>"} | A | fix → {{skill:lpm-intake-triage}} |
| 8 | workspace readiness | CALL {{tool:generate_workspace_readiness_report}} {"workspaceId":"<input:workspaceId>"} | A | fix → {{skill:lpm-executive-context}} |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| project | health, status, risks or weekly review of one project or cycle, with an LPM API key | {{ref:flow-project}} |
| connector | review of one project on a ChatGPT/Claude connector, or when playbook project hit -32003 | {{ref:flow-connector}} |
| portfolio | portfolio or workspace review, "what needs my attention", or a weekly review of a whole workspace | {{ref:flow-portfolio}} |
| changes | owner-agent snapshot of a workspace, or "what changed since version <v>", with an LPM API key | {{ref:flow-changes}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no scope | "Which scope: project <name>, one of its cycles, or workspace <name>?" |
| only a fix (change, close, cancel, assign), no review | name the owner skill from §1 and stop; never offer to cancel, delete or clean up |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| a fix made with another skill | {{tool:get_project_analytics}} after ~10 s (cached) | the signal or count is gone |
| the report | the steps run | each number names its tool, else "not read" |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspaceId> / <projectName (projectId) | all non-archived projects> / <no cycle filter | cycle: metrics are project-wide>
Done: read-only review; status <healthy | watch | critical> (source: <tool>)[; LPM may have re-attached <n> orphan requirements (server side effect)]
Evidence: <metric value (tool)>; risks <riskId severity> | not read
Pending: <finding → owner skill — who decides> | none
Next: <the ASK or STOP text that ended the run> | <owner skill + its first action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "You do not have access to this project" (get_project_analytics) | archived or not visible: "not reviewed"; do not retry |
| "You do not have access to this owner surface" | no project governance role: risks and decisions "not read"; ask the project owner for a role |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
