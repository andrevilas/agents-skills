# {{title}}
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
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. A block is a link or a blocker context; never set status `blocked`.
3. "Why" or "what blocks" → playbook diagnose only; no write.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}}; row 8: U's project | ask "Which LPM project?" |

X waits; U must finish first.

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | what is blocked, or why X is blocked | playbook {{ref:flow-diagnose}} | A | read-only |
| 2 | critical path or cycles | CALL {{tool:get_project_dependency_graph}} {"projectId":"<input:projectId>","maxTaskNodes":50} | A | a cycle → §6 |
| 3 | most coupled projects | CALL {{tool:get_project_dependency_heatmap}} {"projectId":"<input:projectId>"} | A | — |
| 4 | X waits for U in the same project | playbook {{ref:flow-add-link}} | A | a link either way |
| 5 | X waits for U in another project | playbook {{ref:flow-add-cross-project-link}} | A | a link either way |
| 6 | X waits for U in another workspace | playbook {{ref:flow-add-portfolio-link}} | C | no "yes" |
| 7 | X waits for an external cause (vendor, person, access) | playbook {{ref:flow-blocker-context}} | A | — |
| 8 | U is done: what does it release? | CALL {{tool:get_project_dependency_summary}} {"projectId":"<input:projectId>","includeResolved":true} | A | U still open |
| 9 | X waits for an owner decision (scope, priority, business) | playbook {{ref:flow-owner-decision}} | A | asked to choose → §6 |
| 10 | the external cause is gone, or the owner decided | playbook {{ref:flow-resolve-context}} | A | decision not quoted |
| 11 | a link in this workspace is wrong or dangling | playbook {{ref:flow-remove-link}} | C | not confirmed |
| 12 | a link to another workspace is done or wrong | playbook {{ref:flow-close-portfolio-link}} | C | no "yes" |
| 13 | record a blocker on a ChatGPT/Claude connector | playbook {{ref:flow-connector-only}} | A | — |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| diagnose | what is blocked, or why X is blocked | {{ref:flow-diagnose}} |
| add-link | X waits for U in the same project | {{ref:flow-add-link}} |
| add-cross-project-link | X waits for U in another project | {{ref:flow-add-cross-project-link}} |
| add-portfolio-link | X waits for U in another workspace | {{ref:flow-add-portfolio-link}} |
| blocker-context | X waits for an external cause | {{ref:flow-blocker-context}} |
| owner-decision | X waits for an owner decision | {{ref:flow-owner-decision}} |
| resolve-context | the external cause is gone, or the owner decided | {{ref:flow-resolve-context}} |
| remove-link | a link is wrong or dangling | {{ref:flow-remove-link}} |
| close-portfolio-link | a link to another workspace is done or wrong | {{ref:flow-close-portfolio-link}} |
| connector-only | record a blocker on a connector | {{ref:flow-connector-only}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| asked to choose scope or priority | "Scope is the owner's decision (GOV-MAX v1)." → row 9 |
| `meta.hasDependencyCycle` (row 2) | ask "Which link in <A → B → A> is wrong?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| link write | the scope's list tool | id listed, absent, or `status` as sent |
| context, comment | {{tool:get_issue}}, {{tool:list_comments}} | status or id as sent |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspaceId>/<projectId>/<issueId> <title>
Done: <link, context or comment ids | read-only>
Evidence: <list call → id or field>
Pending: none | <cause> — <who must act>
Next: <the ASK or STOP text that ended the run> | <one action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "Issue not found" on an upstream id | dangling link → playbook remove-link |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
