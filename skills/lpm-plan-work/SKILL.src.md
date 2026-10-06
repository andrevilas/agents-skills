# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "cria estas atividades", "muda a prioridade", "move para o sprint"
- "atribua as sem responsável e defina os prazos", "o que está atrasado?"
- "feche o ciclo", "cria o marco", labels, escalations
Do not use:
| If the request is about | Use |
|---|---|
| closing one activity (`done`) | {{skill:lpm-deliver-activity}} |
| blockers, dependency links | {{skill:lpm-unblock-work}} |
| health or risk report | {{skill:lpm-review-health}} |
| projects, members, teams | {{skill:lpm-workspace-admin}} |
| requirements, baselines | {{skill:lpm-requirements-scope}} |
| a governance decision, its activity | {{skill:lpm-governance-decisions}} |
| materializing a roadmap item | {{skill:lpm-roadmap-owner-ops}} |
| roadmap items | {{skill:lpm-roadmap}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Owner, estimate and date changes need a "yes" to the plan; planning never replaces a governance decision (GOV-MAX v1).

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project? (id or name)" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | daily sync, "what is next" | playbook {{ref:flow-daily-sync}} | A | read-only |
| 2 | only the overdue list | CALL {{tool:list_overdue_project_issues}} {"projectId":"<input:projectId>","limitCount":100} | A | denied → row 1 |
| 3 | create activities | playbook {{ref:flow-create-activities}} | A | duplicate |
| 4 | owner, estimate, due date (prazo), queues | playbook {{ref:flow-owners-dates}} | A | no "yes" |
| 5 | title, priority, status, cycle, milestone, labels | playbook {{ref:flow-edit-activities}} | A | `done` |
| 6 | cancel or delete an activity | playbook {{ref:flow-cancel-or-delete}} | C | commits |
| 7 | open or start a cycle (sprint) | playbook {{ref:flow-cycle-open-or-start}} | A | no dates |
| 8 | close or delete a cycle | playbook {{ref:flow-cycle-close}} | C | open work |
| 9 | milestone (marco) | playbook {{ref:flow-milestone}} | C | no "yes" |
| 10 | labels | playbook {{ref:flow-labels}} | C | rename |
| 11 | escalate; notify someone | playbook {{ref:flow-escalate}} | C | no person |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| daily-sync | daily sync of a project | {{ref:flow-daily-sync}} |
| create-activities | create activities | {{ref:flow-create-activities}} |
| owners-dates | set owners, estimates or due dates; work a queue | {{ref:flow-owners-dates}} |
| edit-activities | edit fields, cycle, milestone or labels of activities | {{ref:flow-edit-activities}} |
| cancel-or-delete | cancel or delete an activity | {{ref:flow-cancel-or-delete}} |
| cycle-open-or-start | open or start a cycle (sprint) | {{ref:flow-cycle-open-or-start}} |
| cycle-close | close or delete a cycle | {{ref:flow-cycle-close}} |
| milestone | open, close, re-date or delete a milestone | {{ref:flow-milestone}} |
| labels | create or merge labels | {{ref:flow-labels}} |
| escalate | escalate an activity; notify a person | {{ref:flow-escalate}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| closing one activity (`done`) | STOP → {{skill:lpm-deliver-activity}} |
| a scope doubt | STOP → {{skill:lpm-governance-decisions}} |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| activity, cycle, milestone, label | {{tool:get_issue}}, {{tool:get_cycle}}, {{tool:get_milestone}}, {{tool:list_labels}} | values as sent |
| notification | not re-readable | id marked unverified |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <project, cycle, milestone or labels>
Done: <ids + titles, old → new> | nothing changed
Evidence: <the re-read that showed it> | none
Pending: none | <item — error — who must act>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| `IDEMPOTENCY_CONFLICT` | rerun the playbook: it builds a new key |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
