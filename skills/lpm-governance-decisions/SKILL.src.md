# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "quais decisões estão pendentes?", "explain thread T", "who decides?"
- "abra uma thread sobre o requisito R", "o dono decidiu: <decisão>; registre"
- "create the activity this decision asked for"
Do not use:
| If the request is about | Use |
|---|---|
| reviewing or applying a roadmap change request | {{skill:lpm-roadmap}} |
| progress, evidence or closure of one activity | {{skill:lpm-deliver-activity}} |
| editing requirements, change-set review, baseline publication | {{skill:lpm-requirements-scope}} |
| held AISH jobs: approve or run | {{skill:lpm-aish-jobs}} |
| configuring budgets, pools or AI models | {{skill:lpm-ai-cost}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. You propose, reply and record; never originate a decision (GOV-MAX v1). Deciders: project owner, product owner, delivery lead (userIds, never names).
3. Governance threads cannot target activities (row 10).

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user or {{skill:lpm-start}} | ask "Which LPM project?" |
| workspaceId | the user or {{skill:lpm-start}} | ask "Which LPM workspace?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | pending decisions, one project | playbook {{ref:flow-triage}} | A | read-only |
| 2 | pending decisions, whole workspace | CALL {{tool:get_workspace_decision_inbox}} {"workspaceId":"<input:workspaceId>","requiresActionOnly":true,"limitCount":100} | A | 100 items → row 1 per project |
| 3 | explain a thread | playbook {{ref:flow-explain}} | A | read-only |
| 4 | open a thread | playbook {{ref:flow-open-thread}} | A | one is open on the target |
| 5 | reply in a thread | playbook {{ref:flow-reply}} | A | it states a decision → row 8 |
| 6 | status, decider or title of a thread | playbook {{ref:flow-update-thread}} | C | decided → row 7 or 8 |
| 7 | reopen a decided thread | playbook {{ref:flow-reopen}} | O | no decider order |
| 8 | "X decidiu", "I decided" | playbook {{ref:flow-record-decision}} | O | relayed → ask X to confirm |
| 9 | create or link a decided artifact | playbook {{ref:flow-create-artifact}} | O | no decider order |
| 10 | discussion on one activity | playbook {{ref:flow-activity-note}} | A | scope change → row 4 |
| 11 | who decides in project X | CALL {{tool:get_project}} {"projectId":"<input:projectId>"} | A | role + userId; none → "unassigned" |
| 12 | uncovered governance roles | CALL {{tool:list_missing_governance_assignments}} {"workspaceId":"<input:workspaceId>"} | A | no executiveContext → {{skill:lpm-executive-context}} |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| triage | pending decisions of one project | {{ref:flow-triage}} |
| explain | explain one thread | {{ref:flow-explain}} |
| open-thread | open a thread asking for a decision | {{ref:flow-open-thread}} |
| reply | reply in a thread | {{ref:flow-reply}} |
| update-thread | change a thread's status, decider or title | {{ref:flow-update-thread}} |
| reopen | reopen a decided thread | {{ref:flow-reopen}} |
| record-decision | record a decision, or ask the decider to confirm it | {{ref:flow-record-decision}} |
| create-artifact | create or link a decided artifact | {{ref:flow-create-artifact}} |
| activity-note | a note on one activity | {{ref:flow-activity-note}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| [O] step, no decider order here | decision request, STOP; "X decidiu" is not an order |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| thread, reply | {{tool:list_governance_threads}} | open; preview has the text |
| update, record, link | {{tool:get_governance_thread_resolution_context}} | as sent |
| activity, requirement, note | {{tool:get_issue}}, {{tool:list_requirements}}, {{tool:list_comments}} | new id listed |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspaceId>/<projectId>/<threadId>
Done: <writes with ids> | read-only
Evidence: <decider quote>; <re-read values>
Pending: none | <who decides what>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "must be resolved before a decision can materialize" | row 8 first |
| "You do not have permission" | no retry; ask the project owner |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
