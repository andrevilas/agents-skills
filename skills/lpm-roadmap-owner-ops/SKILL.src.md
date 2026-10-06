# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when the workspace owner ordered it in this conversation ("commit directly", "importa esta TSV", "archive these items", "aprova o item"); a read-only preview needs no order (row 1).
Do not use:
| If the request is about | Use |
|---|---|
| reading the roadmap, a new roadmap or capability, a change without an owner order | {{skill:lpm-roadmap}} |
| an item's technical impact; activity dependencies | {{skill:lpm-ask-advisor}}; {{skill:lpm-unblock-work}} |

## 2. Preconditions
1. Caller is the owner or an owner/admin member; `access_denied` → STOP, tell the user.
2. P1 runs first on every [O] row, even when the order says "commit".

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{skill:lpm-start}} §3 | ask |
| owner order | the owner's message in this conversation, quoted verbatim | §6 row 1 |
| roadmapId | {{tool:get_workspace_roadmap_overview}}(workspaceId, compact=true) → `roadmaps[].id` by title | ask |
| itemId, itemIds | {{tool:list_workspace_roadmap_items}}(workspaceId, roadmapId, compact=true) → `id`, `updatedAt`, `lifecycle`, `isArchived` (archived: includeArchived=true) | 0 or 2+ → ask |
| reason, rationale | the owner's words verbatim ("Motivo:", "Rationale:", "porque", the clause saying why) | ask |
| linkId, other ids, TSV, values | the row's flow § Preconditions; the owner | ask; never invent |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | read-only preview (import, bulk set, materialization, migration) | preview step only: row 5 B2, row 9 step 1, row 10 step 2, row 12 step 4 | A | no order needed; no write |
| 2 | only see roadmap state or history | {{skill:lpm-roadmap}} | A | never write |
| 3 | no owner order for this exact operation | §6 row 1 or {{skill:lpm-roadmap}}; no {{tool:preview_owner_roadmap_change}} | — | always |
| 4 | mode `enforce` and rows 5–9 | {{ref:enforce-mode}}: (a) item edit/archive/restore, lifecycle, new link/allocation → CR via {{skill:lpm-roadmap}}; (b) create item, roadmap/capability text → row 6; (c) unlink, unallocate, role/status, import, roadmap archive → §6 row 3 | — | (a), (c): STOP |
| 5 | same update/archive/restore on 2–100 items | P1 → {{ref:flow-direct-edits}} B2–B6: commit confirmed=true, no idempotencyKey | O | > 100 → split |
| 6 | 1–20 creates/updates (items, roadmap header or capability text); one item edit alone → row 7 | P1 (`get_workspace` → mode) → {{ref:flow-direct-ops}} A; operations[] `{type, itemId, expectedVersion, patch{}}` / `{type, roadmapId, values{}}` | O | archive/restore/lifecycle → rows 5, 7, 8 |
| 7 | edit, archive, restore one item; archive a roadmap; item dependency; project allocation | P1 → {{ref:flow-direct-edits}} B | O | flow § Stop and ask |
| 8 | review, approve, defer, reject, deliver, close an item | P1 → {{ref:flow-direct-edits}} B | O | gate not allowed → ask |
| 9 | import a TSV roadmap | P1 → {{ref:flow-import}} | O | `rowCount == 0` |
| 10 | materialize an approved item | P1 → {{ref:flow-materialize}} | O | candidate `method == "deferred"` |
| 11 | change governance mode or threshold | P1 → {{ref:flow-governance}} steps 1–3 | O | — |
| 12 | preview, apply, roll back a migration | P1 → {{ref:flow-governance}} steps 4–9 | O | v2 `valid != true` |

## 5. Procedures
### P1 Gate — every row with an [O] write
1. Quote the owner's order for this exact operation from this conversation. None → §6 row 1.
2. {{tool:get_workspace}}(workspaceId) → keep `roadmapGovernanceMode` (missing → `shadow`), `updatedAt`, `roadmapGovernancePolicy`.
3. Resolve ids by title with the §3 calls (linkId: the flow's table), never from memory; 0 or 2+ → ask. Also in `enforce`.
4. Mode `enforce` and rows 5–9 → row 4.
5. Else run the row's flow: steps, stop-and-ask, verify.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| an [O] call without a quoted owner order | decision request ({{ref:authority-and-owner-decisions#decision-request}}); STOP |
| before an [O] write ({{tool:commit_workspace_roadmap_item_bulk}}, …) | the quoted order says commit/apply for exactly this change and the call/preview matches it → proceed, report call + digest. Else ask "Apply <exact call, all arguments incl. confirmed=true> now? It skips change-request review." |
| row 4 (c) | {{ref:enforce-mode}} Rule 2 decision request; STOP. "Pode fazer direto" is not an order to change the mode |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any write of rows 5–12 | the flow's § Verify | every requested value, id or count listed; else Pending |

## 8. Report (copy and fill)
```text
Scope: <workspaceId> / <roadmapId> / <ids>; owner order: "<verbatim quote>"
Done: <tool → ids changed, new values / lifecycle / mode / counts>; row 6: commitId, previewId, digest, commit affectedEntityIds
Evidence: <re-read call → values that passed §7>
Pending: <none | dropped ids, values not yet re-read, cycles — who acts>
Next: <one action; new draft item → `reviewed` (row 8); archive → undo = restore + reason>
```

## 9. Failures → fix
{{errors:auto:commit_owner_roadmap_change,preview_owner_roadmap_change,preview_workspace_roadmap_item_bulk,archive_workspace_roadmap,archive_workspace_roadmap_dependency,update_workspace_roadmap_governance_policy,apply_workspace_roadmap_governance_migration,get_workspace}}
| Error or result contains | Do |
|---|---|
| "Unsupported owner roadmap operation" / "patch is empty" / "create_item requires" | key `type`; fields in `patch` / `values` ({{ref:flow-direct-ops}} A1) |
| "requires confirmed=true" | pass it only after the owner's order or yes |
| `GOVERNANCE_REVIEW_REQUIRED` | no retry, no mode switch; §4 row 4 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
