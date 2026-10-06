# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: "show the roadmap", "rastreabilidade do item X", "apply <id>", "create item X".
Do not use:
| If the request is about | Use |
|---|---|
| owner-ordered direct edit, dependency, allocation, import, materialization | {{skill:lpm-roadmap-owner-ops}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. A new item: never `changeType: "create"` (no governed create, `enforce` too); row 10 is the owner path.
3. [O] needs the owner's own words here, never a plain or relayed request.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | ask "Which LPM workspace?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | roadmaps, items, capabilities, governance counts | CALL {{tool:get_workspace_roadmap_overview}} {"workspaceId":"<input:workspaceId>","compact":true} | A | — |
| 2 | trace an item or a project | playbook {{ref:flow-trace}} | A | connector |
| 3 | allocate or link an item | playbook {{ref:flow-propose-link}} | C | mode off |
| 4 | edit, prioritize, lifecycle, archive, restore | playbook {{ref:flow-propose-change}} | C | mode off |
| 5 | comment on a request | playbook {{ref:flow-comment}} | A | — |
| 6 | revise or withdraw | playbook {{ref:flow-revise-or-withdraw}} | C | — |
| 7 | review a request | playbook {{ref:flow-review}} | O | not owner |
| 8 | apply a request | playbook {{ref:flow-apply}} | O | no order |
| 9 | capability write | playbook {{ref:flow-capability}} | O | no order |
| 10 | create a roadmap item ({{tool:create_workspace_roadmap_item}}) | playbook {{ref:flow-create-item}} | O | no order |
| 11 | roadmap header write | playbook {{ref:flow-roadmap-header}} | O | no order |
| 12 | change requests to review, or all | CALL {{tool:list_workspace_roadmap_change_requests}} {"workspaceId":"<input:workspaceId>","compact":true,"limit":100} | A | — |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| trace | trace an item, or a project's roadmap work | {{ref:flow-trace}} |
| propose-link | change request: allocate or link one item | {{ref:flow-propose-link}} |
| propose-change | change request: edit, prioritize, lifecycle, archive or restore one item | {{ref:flow-propose-change}} |
| comment | comment on a change request | {{ref:flow-comment}} |
| revise-or-withdraw | revise or withdraw a change request | {{ref:flow-revise-or-withdraw}} |
| review | record the owner's review decision | {{ref:flow-review}} |
| apply | apply an approved change request | {{ref:flow-apply}} |
| capability | create, edit or archive a capability | {{ref:flow-capability}} |
| create-item | create a roadmap item (never a change request) | {{ref:flow-create-item}} |
| roadmap-header | create or edit a roadmap header | {{ref:flow-roadmap-header}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| you authored it | never review it (`SELF_REVIEW_FORBIDDEN`); solo only with exactly one member |
| {{tool:create_workspace_roadmap_item}} without an owner order | request the owner's decision; do not create |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any write | the playbook's VERIFY read | asked state |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace>/<target>; mode <mode>
Done: <reads only | write, id, status>
Evidence: <re-read>; owner order: "<words>"
Pending: none | <who acts>
Next: <the ASK or STOP text that ended the run> | <action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| `GOVERNANCE_REVIEW_REQUIRED` | row 3 or 4 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
