# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "crie / edite / apague o requisito <R>"
- "o escopo mudou?", "prepare a change set"
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
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Connector: row 1 only. Approved scope changes only on the owner's order.
3. A question → reads only. Never claim "no removals": the delta never shows them.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | ask "Which LPM project?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | connector | CALL {{tool:get_project_execution_context}} {"projectId":"<input:projectId>"} | A | a write |
| 2 | status, drift, "can we publish?" | playbook {{ref:flow-scope-status}} | A | — |
| 3 | add a requirement | playbook {{ref:flow-add-requirement}} | C | same title |
| 4 | edit, link, mark met | playbook {{ref:flow-edit-requirement}} | C | approved scope |
| 5 | remove a requirement | playbook {{ref:flow-remove-requirement}} | C | approved scope |
| 6 | orphans, groups | playbook {{ref:flow-groups-and-orphans}} | C | no baseline |
| 7 | change set | playbook {{ref:flow-change-set}} | C | no delta |
| 8 | owner approves a change set | playbook {{ref:flow-change-set-decision}} | O | no owner order |
| 9 | proposal | playbook {{ref:flow-proposal}} | C | free text |
| 10 | publish a baseline | playbook {{ref:flow-publish-baseline}} | O | no owner order |
| 11 | rename, restore, delete baseline | playbook {{ref:flow-baseline-records}} | O | no owner order |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| scope-status | status, drift or traceability (read-only) | {{ref:flow-scope-status}} |
| add-requirement | add a requirement | {{ref:flow-add-requirement}} |
| edit-requirement | edit, link, regroup or set the status of a requirement | {{ref:flow-edit-requirement}} |
| remove-requirement | remove a requirement (obsolete or delete) | {{ref:flow-remove-requirement}} |
| groups-and-orphans | requirement groups, or attach orphan requirements | {{ref:flow-groups-and-orphans}} |
| change-set | create a live change set, or move it to review/draft | {{ref:flow-change-set}} |
| change-set-decision | the owner approves or rejects a change set | {{ref:flow-change-set-decision}} |
| proposal | propose rewrites or copies (live scope untouched) | {{ref:flow-proposal}} |
| publish-baseline | publish a baseline on the owner's order | {{ref:flow-publish-baseline}} |
| baseline-records | rename, restore or delete a baseline (owner) | {{ref:flow-baseline-records}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| `isCurrent:false`, {{tool:publish_change_set}}, {{tool:publish_project_baseline_from_resolution}} | refuse: they dodge the gate |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| requirement or change set | {{tool:list_requirements}} / {{tool:get_change_set}} | sent values shown |
| publication | {{tool:get_project_scope_resolution_context}} | new current baseline |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <projectId>; baseline <version> (<baselineId>)
Done: <ids changed> | nothing changed
Evidence: <reads>; owner order "<quote>"
Pending: none | owner decision | removals: <ids>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "Immutable proposal not found" | rerun playbook publish-baseline (no live `changeSetId`) |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
