# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when the owner orders a direct roadmap edit, TSV import, lifecycle gate, allocation, dependency or migration.
Do not use:
| If the request is about | Use |
|---|---|
| reading the roadmap; any change without an owner order (change request); a new roadmap or capability | {{skill:lpm-roadmap}} |
| an item's technical impact | {{skill:lpm-ask-advisor}} |
| the requirements a materialization created | {{skill:lpm-requirements-scope}} |
| dependencies between activities (issues) | {{skill:lpm-unblock-work}} |

## 2. Preconditions
1. Run the first matching §4 row. Writes need the owner's order here and a governance check. Questions authorize reads only.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or {{skill:lpm-start}} | ask "Which LPM workspace?" |
| order | the owner's message, quoted verbatim | §6 row 1 |
| content | the TSV text (TAB-separated, a title column) | ask "Send the file as TAB-separated text." |
| sourceRef | the file name | "pasted.tsv" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | only preview a TSV import | CALL {{tool:preview_workspace_roadmap_import}} {"workspaceId":"<input:workspaceId>","content":"<input:content>","sourceRef":"<input:sourceRef>"} | A | `rowCount` 0 → "Not TAB-separated, or no title column." |
| 2 | only preview the governance migration counts | CALL {{tool:preview_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>"} | A | both counts 0 → "Nothing to migrate." |
| 3 | the owner replied "A" to an enforce decision request | playbook {{ref:flow-governance}} | O | mode is not enforce |
| 4 | create items; change item, roadmap or capability text in one commit | playbook {{ref:flow-owner-commit}} | O | enforce + item edit → change request |
| 5 | update, archive or restore 1–100 items; archive a roadmap | playbook {{ref:flow-items}} | O | enforce (items) → change request |
| 6 | review, approve, defer, reject, deliver or close an item | playbook {{ref:flow-lifecycle}} | O | enforce → change request |
| 7 | dependency between two roadmap items | playbook {{ref:flow-dependency}} | O | enforce → decision request |
| 8 | project allocation on a roadmap item | playbook {{ref:flow-allocation}} | O | enforce → decision request |
| 9 | import a TSV file | playbook {{ref:flow-import}} | O | `rowCount` 0 |
| 10 | links and allocations from an import | playbook {{ref:flow-import-links}} | O | `cycles` not empty |
| 11 | materialize an approved item into a project | playbook {{ref:flow-materialize}} | O | candidate `deferred` |
| 12 | change the governance mode | playbook {{ref:flow-governance}} | O | no mode named |
| 13 | apply or roll back a migration (governance, v2) | playbook {{ref:flow-migration}} | O | v2 `valid` != true |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| owner-commit | create items, or edit item, roadmap or capability text, in one owner commit | {{ref:flow-owner-commit}} |
| items | update, archive or restore items, or archive a roadmap | {{ref:flow-items}} |
| lifecycle | move one item through a lifecycle gate (approve, deliver, close) | {{ref:flow-lifecycle}} |
| dependency | add, change or remove a dependency between roadmap items | {{ref:flow-dependency}} |
| allocation | add, change or remove a project allocation on an item | {{ref:flow-allocation}} |
| import | import a TSV file of roadmap items | {{ref:flow-import}} |
| import-links | link and allocate the items of an import | {{ref:flow-import-links}} |
| materialize | materialize an approved item into one project | {{ref:flow-materialize}} |
| governance | change the governance mode, or run the enforce window the owner chose | {{ref:flow-governance}} |
| migration | apply or roll back a roadmap migration (governance or v2) | {{ref:flow-migration}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no owner order, or the speaker does not say they are the workspace owner | {{skill:lpm-roadmap}}: change request or decision request; never call {{tool:preview_owner_roadmap_change}} |
| enforce and "pode fazer direto" | not a mode order; dependency or allocation → the governance decision request (A shadow window / B wait for LPM / C nothing) |
| enforce and a new item | no change request can create an item (LPM gap): owner-commit on the owner order, and say so |

## 7. Verify
Run the selected playbook’s VERIFY calls. Check the requested values and IDs, not only a successful response. A failed read-back means unverified.

## 8. Report (copy and fill)
```text
Scope: <workspaceId> / <roadmapId> / <ids> (mode <mode>); owner order: "<verbatim quote>"
Done: <tool → ids changed, new values, lifecycle, mode or counts> | nothing changed
Evidence: <re-read call → values read> | none
Pending: none | <what was not done> — <who decides>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| `GOVERNANCE_REVIEW_REQUIRED` | stop; follow the playbook’s enforce branch |
| `access_denied` | stop; caller needs workspace management access |
| owner operation or patch invalid | use owner-commit templates; never invent operation keys |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
