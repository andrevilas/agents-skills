# Roadmap change-request facts
Load when: background lookup: a status, risk class, quorum, version field or error code is unclear (the playbooks hold every step)
Applies to: lpm-roadmap    Source: cards {{tool:preview_workspace_roadmap_change}}, {{tool:submit_workspace_roadmap_change}}, {{tool:review_workspace_roadmap_change}}, {{tool:apply_workspace_roadmap_change}}; lpm `server.ts` roadmap governance commands, `src/lib/workspaceRoadmapGovernance.ts`

## Summary
A change request (CR) changes existing roadmap items: preview → submit (awaiting-review) → review by another human → apply after approval, on the owner's order.
Mode = {{tool:get_workspace}} → `roadmapGovernanceMode` (`off`, `shadow`, `enforce`); absent → `shadow`, or `off` when `roadmapGovernanceEnabled == false`. `reviewMode` (peer, solo) is not the mode.
There is no governed create: `changeType: "create"` previews an edit of an existing item and its apply writes nothing (LPM gap). A new item is an owner-ordered direct create, as a draft.

## Facts
### Modes
| Value | Consequence for the agent |
|---|---|
| `off` | CRs disabled (`ROADMAP_GOVERNANCE_DISABLED`); direct edits are owner-only ({{skill:lpm-roadmap-owner-ops}}) |
| `shadow` | CRs available; direct tools still work; the default path is a CR |
| `enforce` | blocks direct item edit/archive/restore, bulk, dependency and allocation create/update, item review (`GOVERNANCE_REVIEW_REQUIRED`); creates, capability writes and roadmap header writes are not blocked, so the owner's order is the only gate |

### Statuses
| Status | Next |
|---|---|
| `awaiting-review` | review, comment, withdraw |
| `changes-requested` | the author revises (new revision) or withdraws |
| `approved` | apply on the owner's order; any eligible reviewer may still reject |
| `rejected` | submit a new CR if still wanted |
| `stale` | dead (`staleReason` `VERSION_CONFLICT` or `REVIEW_REVISION_STALE`): re-read, preview, submit a new CR |
| `applied` | done; undo = an opposite CR |
| `withdrawn` | terminal; resubmit with a NEW key |
| `draft`, `superseded` | in the enum; no code path produces them |

### Risk classes and quorum
| Risk | Computed when | Approvals |
|---|---|---|
| `routine` | `edit` of only description/category on one item | 1 |
| `material` | title or priority, any non-edit type, or more than 1 item | 1 that includes the owner's (if the owner authored it, one other member) |
| `exceptional` | more than 20 items, or `materialize` | 2 (or all eligible), one the owner's unless the owner authored it |

- Humans = the workspace owner + active members, recomputed live. Solo review only when the workspace has exactly one human; otherwise the author never reviews (`SELF_REVIEW_FORBIDDEN`).
- A revision voids earlier approvals; reviews count only when `reviews[].revision == currentRevision`.
- Only the single `assignedReviewerId` sees a CR in the review inbox.

### Version fields
| Field | Comes from | Used by |
|---|---|---|
| item `updatedAt` | {{tool:list_workspace_roadmap_items}} or {{tool:get_workspace_roadmap_overview}} `items[]` | preview, submit `expectedUpdatedAt` |
| request `updatedAt` | {{tool:get_workspace_roadmap_change_request}} | revise, review, withdraw, apply |

### Error codes
| Code | Fix |
|---|---|
| `VERSION_CONFLICT` | re-read, preview again, show the user |
| `EXPECTED_UPDATED_AT_REQUIRED` / `IDEMPOTENCY_KEY_REQUIRED` / `CHANGE_RATIONALE_REQUIRED` | pass the missing field |
| `GOVERNED_OPERATION_PATCH_REQUIRED: <type> requires <field>` | add that patch field |
| `INVALID_LIFECYCLE_TRANSITION` | use an allowed move |
| `PRIMARY_ALREADY_ASSIGNED` / `ALLOCATION_ALREADY_ACTIVE` | pass `replacesAllocationId` of the active primary, or another role |
| `ROADMAP_DEPENDENCY_CYCLE` / `INVALID_ROADMAP_LINK_TARGET` / `INVALID_ROADMAP_CAPABILITY_TARGET` | another target; at apply: withdraw and report |
| `SELF_REVIEW_FORBIDDEN` / `REVIEWER_NOT_ELIGIBLE` / `SOLO_CONFIRMATION_REQUIRED` | another human reviews |
| `CHANGE_NOT_REVIEWABLE` / `CHANGE_NOT_REVISIONABLE` / `CHANGE_NOT_WITHDRAWABLE` / `CHANGE_NOT_APPROVED` | read the request status first |

## Rules
1. A NEW idempotencyKey for every submit, revise, review, withdraw and comment; reuse a key only to retry the same call after a timeout. A reused submit key silently returns the OLD request.
2. `apply` returning `status: "stale"` is a successful call that changed nothing.
3. A lifecycle CR `approved` → `materialized` is accepted by the server but records no materialization: never submit it.

## Examples
```text
example: preview_workspace_roadmap_change {"workspaceId":"ws_1","itemId":"ri_11","changeType":"prioritize","patch":{"priority":"high"},"expectedUpdatedAt":"<item updatedAt>"}
```
