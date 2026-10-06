# Roadmap change-request facts
Load when: a patch shape, status, quorum or error code is unclear
Applies to: lpm-roadmap    Source: cards {{tool:preview_workspace_roadmap_change}}, {{tool:submit_workspace_roadmap_change}}, {{tool:review_workspace_roadmap_change}}, {{tool:apply_workspace_roadmap_change}}; lpm `docs/mcp-roadmap-change-requests.md`

## Summary
Modes, statuses, risk classes and quorum, patch shapes per changeType, lifecycle transitions, version fields and error codes of roadmap change requests. The steps are in {{ref:change-request-lifecycle}}.

## Facts
### Modes
| Value | Meaning | Consequence for the agent |
|---|---|---|
| `off` (or `roadmapGovernanceEnabled == false`) | CRs disabled | preview fails `ROADMAP_GOVERNANCE_DISABLED`; direct edits are owner-only → {{skill:lpm-roadmap-owner-ops}} |
| `shadow` (also when the field is absent) | CRs available; direct tools still work | default path is a CR |
| `enforce` | blocks direct item edit/archive/restore, bulk, dependency create/update, allocation create/update and item review (`GOVERNANCE_REVIEW_REQUIRED`) | those changes go through a CR; creates, capability writes and archive of dependencies/allocations are not blocked (owner order only); no CR removes a link or allocation |

### Statuses
| Status | Meaning | Next |
|---|---|---|
| `awaiting-review` | submitted or revised | review, comment, withdraw |
| `changes-requested` | a reviewer sent it back | author revises (new revision) or withdraws |
| `approved` | quorum and owner confirmation met | apply on the owner's instruction; any eligible reviewer may still reject |
| `rejected` | refused | submit a new CR if still wanted |
| `stale` | items changed before apply (`staleReason` `VERSION_CONFLICT` or `REVIEW_REVISION_STALE`) | dead: re-read items, preview, submit a new CR |
| `applied` | written to the roadmap | done; undo = opposite CR |
| `withdrawn` | cancelled; terminal | resubmit with a NEW key |
| `draft`, `superseded` | in the enum, no current code path produces them | ignore |

### Risk classes and quorum
| Risk | Computed when | Approvals needed |
|---|---|---|
| `routine` | `edit` of only description/category on one item | 1 |
| `material` | `title` or `priority` fields, any non-edit type, or more than 1 item | 1 approval that includes the owner (the owner's approve alone is enough; if the owner authored it, one other member) |
| `exceptional` | more than 20 items, or `materialize` | 2 approvals (or all eligible if fewer), one of them the owner's unless the owner authored it |

- `requestedRiskClass` can only raise the computed class.
- Humans = workspace owner + active members; the policy is recomputed from the live list.
- `reviewMode: solo` only when the author is the only human: the author confirms.
- An API key or agent credential acts as the human who owns it. If that is the owner, owner confirmation is auto-satisfied, so one other member's approval can approve a material CR.
- A revision invalidates all earlier approvals; reviews count only when `reviews[].revision == currentRevision`.
- Only the single `assignedReviewerId` sees a CR in the review inbox; other eligible reviewers find it with the status filter.

### Patch shapes
| changeType | patch | Notes |
|---|---|---|
| `edit` (default) | `{ title?, description?, category?, priority? }` | item not archived, not materialized |
| `prioritize` | `{ priority: urgent\|high\|medium\|low\|none }` | |
| `archive` / `restore` | `{ reason? }` | |
| `lifecycle` | `{ lifecycle, rationale? }` | transitions below |
| `allocate` | `{ projectId, role? primary\|contributor\|dependent\|observer, rationale?, replacesAllocationId? }` | `replacesAllocationId` required when an active primary exists |
| `link` | `{ targetItemId, type? blocks\|depends_on\|relates_to\|shared_capability\|enables_future_use, rationale? }` | sources = itemId/itemIds; no cycles |
| `capability-link` | `{ capabilityId, relationship? defines\|delivers\|enables\|extends\|validates, rationale? }` | capability active, not already linked |
| `create`, `materialize` | — | do not use: `create` needs an existing item and its apply writes nothing; materialization is {{skill:lpm-roadmap-owner-ops}} |

Defaults written at apply: role `primary`, link type `depends_on`, relationship `delivers`. `replacesAllocationId` ← {{tool:list_workspace_roadmap_allocations}}(workspaceId, roadmapId) → `id` with `role == "primary"` and `status` active or absent (API key only; on a connector read `allocations[]` of {{tool:get_workspace_roadmap_overview}}). `itemIds` takes 1–100 items with one patch; pass `expectedVersions` `{itemId: updatedAt}`.

### Lifecycle transitions (changeType `lifecycle`)
`draft` → `imported` | `reviewed` | `deferred` | `rejected`; `imported` → `reviewed` | `deferred` | `rejected`; `reviewed` → `approved` | `deferred` | `rejected`; `approved` → `deferred`; `deferred` → `reviewed`; `rejected` → `reviewed`; `materialized` → `delivered`; `delivered` → `closed`. Materialization ({{skill:lpm-roadmap-owner-ops}}) keeps the stored lifecycle `approved`; progress is in `materializationSummary.state`; `delivered` is then not reachable (LPM gap). The server also accepts a lifecycle CR `approved` → `materialized`, but it records no materialization: do not submit it.

### Version fields
| Field | Comes from | Used by |
|---|---|---|
| item `updatedAt` | {{tool:list_workspace_roadmap_items}} | preview, submit (`expectedUpdatedAt`) |
| request `updatedAt` | {{tool:get_workspace_roadmap_change_request}} or `submit` result | revise, review, withdraw, apply |
| `requestUpdatedAt` | {{tool:review_workspace_roadmap_change}} result | apply right after the approving review |

### Error codes
| Code | Fix |
|---|---|
| `VERSION_CONFLICT` | re-read the item or request, preview again, show the user |
| `EXPECTED_UPDATED_AT_REQUIRED` / `IDEMPOTENCY_KEY_REQUIRED` / `CHANGE_RATIONALE_REQUIRED` | pass the missing field (ask the user for the rationale) |
| `GOVERNED_OPERATION_PATCH_REQUIRED: <type> requires <field>` | add that patch field |
| `INVALID_LIFECYCLE_TRANSITION` | follow the transitions above |
| `PRIMARY_ALREADY_ASSIGNED` / `ALLOCATION_ALREADY_ACTIVE` | pass `replacesAllocationId` of the active primary, or another role |
| `ROADMAP_DEPENDENCY_CYCLE` / `INVALID_ROADMAP_LINK_TARGET` / `INVALID_ROADMAP_CAPABILITY_TARGET` | choose another target; at apply: withdraw and report |
| `SELF_REVIEW_FORBIDDEN` / `REVIEWER_NOT_ELIGIBLE` / `SOLO_CONFIRMATION_REQUIRED` | another human must review; tell the user |
| `CHANGE_NOT_REVIEWABLE` / `CHANGE_NOT_REVISIONABLE` / `CHANGE_NOT_WITHDRAWABLE` / `CHANGE_NOT_APPROVED` | read the request status first |
| `IDEMPOTENCY_CONFLICT` (batch) | the batch key was used with other operations: new batch key |
