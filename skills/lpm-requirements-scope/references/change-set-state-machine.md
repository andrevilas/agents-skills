# Change-set state machine
Load when: before any change-set write
Applies to: lpm-requirements-scope    Source: cards {{tool:create_change_set}}, {{tool:create_project_change_set_from_resolution}}, {{tool:update_change_set}}, {{tool:update_project_change_set_status}}, {{tool:publish_change_set}}, {{tool:get_change_set}}, {{tool:publish_baseline_from_working_scope}} (`src/lib/changeSetStateMachine.ts`, `src/lib/projectChangeSet.ts`, `src/server/immutableRequirementChangeSetCommands.ts`, `src/server/immutableRequirementProposal.ts`); help `change-sets-e-aprovacoes`

## Summary
A change set packages a scope change for review. It never replaces the baseline: the change ends only when a baseline is published.
States: `draft` → `in-review` → `approved` | `rejected`; `published` is terminal. Material sets cannot skip review.
Two kinds: a LIVE set snapshots the current working-scope delta; a PROPOSAL (immutable) carries requirement copies or description rewrites and never edits live requirements.
`approved` and `rejected` are [O]: the owner's decisions. The server does not check who approves, so a user's "yes" never counts.
Publication goes through {{tool:publish_baseline_from_working_scope}}; when `requiresFormalReview == true` it marks the matching approved set `published` by itself. At low or no materiality no set is needed, matched or marked.

## Facts
### Transitions
| From | Allowed to | Note |
|---|---|---|
| `draft` | `in-review`, `approved` | `approved` only when `reviewPolicy.requiresFormalReview == false` |
| `in-review` | `draft`, `approved`, `rejected` | `approved` / `rejected` are [O]: the owner's words only |
| `approved` | `draft`, `published` | `published` needs a publication baseline |
| `rejected` | `draft` | — |
| `published` | none | terminal; reversal = publish or promote another baseline |
Any other move fails with "Invalid change set transition from <X> to <Y>".

### Live set vs proposal
| Topic | Live set | Immutable proposal |
|---|---|---|
| create | {{tool:create_project_change_set_from_resolution}} (returns JSON `changeSetId`) or {{tool:create_change_set}} without `requirementProposal` (plain text "Change set created with ID: <id>") | {{tool:create_change_set}} with `requirementProposal` + `sourceBaselineId` = the current baseline: `dryRun: true` first, then the same call with `expectedProposalFingerprint` |
| `sourceBaselineId` | omit (another id breaks gate matching) | required; must be the unique current baseline |
| content | frozen snapshot of the delta at creation | `additions` OR `revisions`, never both |
| status tool | {{tool:update_project_change_set_status}} or {{tool:update_change_set}} | {{tool:update_change_set}} with ONLY projectId, changeSetId, status, expectedProposalFingerprint |
| review | formal when materiality is medium/high | always formal (`draft → in-review → approved`) |
| same status sent again | no-op | error "Invalid change set transition" |
| publish | {{tool:publish_baseline_from_working_scope}} (or the twin {{tool:publish_project_baseline_from_resolution}}) | {{tool:publish_baseline_from_working_scope}} with changeSetId, expectedProposalFingerprint, name and a NEW version |
| retry safety | not idempotent: a retry creates another draft | same content → same id `proposal-<fingerprint>`, `reused: true` |
| access | project read | project manage |

### Proposal payload (`requirementProposal`)
| Shape | Fields | Limits |
|---|---|---|
| `additions[]` | `key` (`[A-Za-z0-9_-]`, unique), `title` (≤300), `description` (≤20000), `type`, `source{projectId, baselineId, requirementId}`, `linkedIssueIds` (≤50, issues of this project) | 1-200 rows; each source once; `source.baselineId` = that requirement's baseline |
| `revisions[]` | `requirementId` (current baseline), `title` (exact current), `beforeDescription` (exact current), `description` (new, different) | 1-200 rows |
Additions must copy an existing requirement: there is no free-text new-requirement proposal (use a governance thread).

### Traps
| Situation | Effect | Do |
|---|---|---|
| scope edited after a live set was created | edits that change ids, titles, links, linked issue estimates or cost break the match; text, status or type edits of a requirement already in the snapshot do NOT | compare every delta `changedAt` with the set's `createdAt` (draft, in-review) or `approvedAt` (approved) yourself; a later one → new set, review again; moving back to `draft` does not refresh it |
| `publicationBaselineId` set on an approved live set before publishing | the set no longer matches the gate | never set it before publication |
| {{tool:publish_change_set}} | bookkeeping only: marks an approved live set `published`; creates no baseline, does not validate the id | only to close an approved set against a baseline already published by other means |
| {{tool:publish_change_set}} on an already published set | silently overwrites `publicationBaselineId` | never call it after a publication |
| {{tool:update_project_change_set_status}} on a proposal | always fails ("Immutable proposal metadata cannot be edited") | use {{tool:update_change_set}} |
| "Proposal or base changed; create and review a fresh proposal" | live requirements, issues, costs or the source changed | new proposal (dryRun → create), review again |
| proposal publication | refused with orphan requirements, or above 480 writes | reconcile orphans first; split the proposal |

## Rules
1. Read {{tool:get_change_set}} before every status move: `status`, `reviewPolicy.requiresFormalReview`, `scopeProposal`.
2. Reuse a `draft` or `in-review` set only when `workingScopeSnapshot.affectedRequirementIds` equals the delta ids AND every delta `changedAt` <= its `createdAt`. An `approved` set counts only when the ids are equal AND every `changedAt` <= its `approvedAt`; else create a new set. Never send an `approved` set to `in-review` (invalid transition).
3. Write the summary as: what changes, why, and every removed or deleted requirement (the delta cannot show removals).
4. Move to `approved` or `rejected` [O] only when the owner's own words in this conversation say so; quote them in the report.
5. Never approve a set you drafted on your own judgment, and never skip `in-review` for a material set.
6. After approval, change nothing in scope or in the linked work (requirements, links, linked issue estimates, cycles or milestones, project rate) until publication. `matchedApprovedChangeSetId` becomes null → create a new change set.

## Examples
```text
example: live: create_project_change_set_from_resolution(projectId="p1", title="Q4 scope",
  summary="Adds export (r9). Removed or deleted: none in this run; the delta cannot show removals")
  → {changeSetId: "cs7"}; update_project_change_set_status(projectId="p1", changeSetId="cs7", status="in-review")

example: proposal: create_change_set(projectId="p1", sourceBaselineId="b-current", dryRun=true,
  requirementProposal={revisions:[{requirementId:"r3", title:"Login", beforeDescription:"<exact>", description:"<new>"}]})
  → draft.scopeProposal.contentFingerprint "f00d"; same call without dryRun + expectedProposalFingerprint="f00d"
  → {id: "proposal-f00d", reused: false}
```
