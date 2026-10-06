# Roadmap: read, trace and governed change requests
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: read or trace the roadmap; a change request.
| If the request is about | Use |
|---|---|
| owner-ordered EXISTING-item edit, archive/restore, dependency, allocation, lifecycle gate, import, materialization | {{skill:lpm-roadmap-owner-ops}} |
| a NEW roadmap/item/capability; roadmap/capability edit | row 10; no owner order → §6, never owner-ops |
| code evidence or impact | {{skill:lpm-ask-advisor}} |
| a decision thread | {{skill:lpm-governance-decisions}} |
| unowned executive capabilities | {{skill:lpm-executive-context}} |

## 2. Preconditions
1. Connector without `roadmap:manage` (old install) → reinstall it; no box to tick.
2. Writes other than comments: owner or admin ({{tool:list_workspace_members}} → `role`).

## 3. Inputs
| Input | From (call → field) | If missing |
|---|---|---|
| workspaceId | {{skill:lpm-start}} §3 | ask |
| roadmapId | {{tool:list_workspace_roadmaps}} → `id`, `status == "active"` | 0 or 2+ → ask |
| itemId + `updatedAt` | {{tool:list_workspace_roadmap_items}}(compact=true) → match `title` | 0 or 2+ → ask |
| changeRequestId | {{tool:list_workspace_roadmap_change_requests}} or {{tool:get_workspace_roadmap_review_inbox}} → `id` | ask |
| projectId | {{tool:list_workspace_projects}} → `id` | ask |
| mode | {{tool:get_workspace}} (before any write) → `roadmapGovernanceMode`; absent: `shadow`, or `off` if `roadmapGovernanceEnabled` is false | never guess |

## 4. Decision table (first match wins)
Rows 4, 6–8: P1–P4 in {{ref:change-request-lifecycle}}.
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | roadmaps, items, capabilities, requests | {{tool:get_workspace_roadmap_overview}}(compact=true) or a §3 list | A | — |
| 2 | trace an item; its gaps | {{tool:explain_workspace_roadmap_traceability_gap}} → {{tool:get_workspace_roadmap_traceability}} | A | one item per call |
| 3 | a project's roadmap work; unlinked work | {{tool:get_project_roadmap_drilldown}}; {{tool:list_unlinked_project_work}} | A | connector → STOP |
| 4 | change an existing item (edit, prioritize, archive, lifecycle, allocate, link) | P1: {{tool:preview_workspace_roadmap_change}} → {{tool:submit_workspace_roadmap_change}}, NEW key | C | mode `off` → owner order? → {{skill:lpm-roadmap-owner-ops}}; after submit + Verify → §8, STOP |
| 5 | comment on a request | {{tool:comment_workspace_roadmap_change}}(content, idempotencyKey="crc-<changeRequestId>-<yyyymmddhhmmss>") | A | a decision → row 7 |
| 6 | revise or withdraw | P2: {{tool:revise_workspace_roadmap_change}} or {{tool:withdraw_workspace_roadmap_change}} | C | applied/withdrawn |
| 7 | review inbox; record a decision | P3: {{tool:get_workspace_roadmap_change_request}} → caller's decision quoted → {{tool:review_workspace_roadmap_change}}(…, expectedUpdatedAt=its `updatedAt`, key P3 step 4) | O | §5 |
| 8 | apply an approved request | P4: {{tool:get_workspace_roadmap_change_request}} → `approved` and `reviewedRevision == currentRevision`, else §6 → {{tool:apply_workspace_roadmap_change}}(workspaceId, changeRequestId, expectedUpdatedAt=its `updatedAt`, idempotencyKey="crap-<changeRequestId>") → §7 | O | no owner order → §6 |
| 9 | owner orders several reviews/applies | {{tool:batch_workspace_roadmap_changes}}(≤ 25, stopOnError=true), review keys as P3 | O | submit + review of one request |
| 10 | create a roadmap, item or capability; edit a roadmap or capability | {{ref:flow-structure-write}} | O | no quoted owner order (a plain "add" is not one) → §6; never `changeType: "create"` |
| 11 | governance health; pending notifications | {{tool:get_workspace_roadmap_governance_observability}} → {{tool:process_workspace_roadmap_notification_outbox}}(limit=50, idempotencyKey="outbox-<yyyymmddhhmmss>"), re-read | A | do not poll |

## 5. Procedures
- Run every listed read even if the user gave the data; only this run's calls are Evidence.
- Record a review only as the caller (whose credential you use) states it here for this id; anyone else's → they review in LPM.
- Self-review → STOP (`SELF_REVIEW_FORBIDDEN`); solo only when the workspace has exactly one member.
- Key timestamps = the current UTC clock. Your userId only from your own submit (`authorUserId`).

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| [O] {{tool:review_workspace_roadmap_change}}, {{tool:apply_workspace_roadmap_change}}, {{tool:batch_workspace_roadmap_changes}}, no owner order (an approval is not one) | decision request, STOP |
| [O] row 10 write, no owner order, any mode (`enforce` too) | decision request (A: owner orders the create), STOP |
| P4: not `approved`, or `reviewedRevision != currentRevision` (approvals void) | report `status` + who must review (not the author); STOP |
Decision request: Decision needed / Context (ids, mode) / Options A) <exact call> B) do nothing / Recommendation; then §8 (Pending: owner decision). STOP; no [O] steps after.

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| request write | {{tool:get_workspace_roadmap_change_request}} | `status` as asked; no `idempotentReplay` unless a timeout retry; comment: `comments[]` has its `id` |
| apply, then also | {{tool:list_workspace_roadmap_items}}(workspaceId, roadmapId, includeArchived=true); allocate/link/capability-link: P4 step 8 | item fields = `after` (ignore `updatedAt`); cite this read, not the apply response |

## 8. Report (copy and fill)
```text
Scope: <workspace>/<roadmap>/<item or request id>; mode <get_workspace roadmapGovernanceMode of this run, not reviewMode>
Done: <reads, or request id + status + riskClass>
Evidence: <re-read tool → field = value>
  [O] owner order: "<exact words>"
Pending: <none | who must act (approvals, owner, assignedReviewerId)>
Next: <one action for user or owner, e.g. "none: applied">
```
Only this run's tool values; no invented date, name or mode; user's language.

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| any tool error | quote it; not a test or environment issue; stop at STOPs |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
