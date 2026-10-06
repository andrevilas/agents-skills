# Flow: change set
Load when: decision rows 7-9 of SKILL.md

## Preconditions
1. LPM API key (profile `requirements`, `full` or `custom`); a proposal also needs project manage access. Load {{ref:change-set-state-machine}} before any change-set write.
2. Live change set (steps 1-8): it snapshots the working-scope delta. Proposal (steps 9-14): copies of existing requirements or description rewrites, without touching live requirements. New free-text scope → {{skill:lpm-governance-decisions}} opens {{tool:create_governance_thread}}(targetType="baseline", targetId=baselineId).
3. `projectId`, `baselineId`, `changeSetId` come from SKILL.md §3; `expectedProposalFingerprint` from step 11 or {{tool:get_change_set}} → `scopeProposal.contentFingerprint`; `threadId` from {{skill:lpm-governance-decisions}}. `workingScope.affectedCount == 0` → say "no change set needed", STOP.
4. Live, `publicationGate.requiresFormalReview == false` → say "No change set is needed to publish (materiality <m>)." Create one only when a resolved thread or the user asks for it; the gate never matches it and publication never marks it `published`.
5. `approved` and `rejected` are [O]: only the owner's own words in this conversation about this change set. A user's "yes" or your judgment never counts. [C] covers only `in-review` and `draft`.

## Steps
1. SKILL.md P1 steps 1-2 → keep the delta `requirementId` and `changedAt` list. {{tool:list_change_sets}}(projectId) → for each `draft` or `in-review` set: {{tool:get_change_set}}(projectId, changeSetId) → reuse it only when `workingScopeSnapshot.affectedRequirementIds` equals the delta ids AND every delta `changedAt` <= its `createdAt` → step 5.
2. An `approved` live set counts only when its ids equal the delta ids AND every delta `changedAt` <= its `approvedAt` → step 8. Else create a new set (step 3) and review it again. Never send an `approved` set to `in-review`.
3. From a resolved thread: {{tool:prepare_change_set_draft_from_governance_thread}}(projectId, threadId, messageLimitCount=100) → `readyToCreate == false` → STOP → {{skill:lpm-governance-decisions}}; else keep `draft.title`, `draft.summary`.
4. {{tool:create_project_change_set_from_resolution}}(projectId, title=<`draft.title` if step 3 ran>, summary=<`draft.summary` if step 3 ran, else what changes and why> + " Removed or deleted: <ids and titles, or 'none in this run; the delta cannot show removals'>") [A]. Omit sourceBaselineId. Keep `changeSetId`. Timeout → not idempotent: {{tool:list_change_sets}}(projectId) before any retry. Created from a thread → hand `changeSetId` and `threadId` to {{skill:lpm-governance-decisions}} to link the thread (decision with actionTargetType="change-set", actionTargetId=changeSetId).
5. {{tool:get_change_set}}(projectId, changeSetId) → keep `status`, `createdAt`, `reviewPolicy.requiresFormalReview`.
6. `status == "draft"`: [C] "Send change set <title> to review?" → {{tool:update_project_change_set_status}}(projectId, changeSetId, status="in-review") [C].
7. [O] Owner's words in this conversation only: {{tool:update_project_change_set_status}}(projectId, changeSetId, status="approved" or "rejected") [O]. `requiresFormalReview == true` → it must be `in-review` first. After approval change nothing in scope or in the linked work (requirements, links, linked issue estimates, cycles or milestones, project rate) until publication.
8. Verify (live): {{tool:get_change_set}} → `status` == the requested value. Only when `publicationGate.requiresFormalReview == true`: {{tool:get_project_scope_resolution_context}} → `publicationGate.matchedApprovedChangeSetId == changeSetId`. When false: skip the match check; record the id in `publicationNotes` at publication.
9. Proposal: {{tool:list_requirement_baselines}}(projectId) → exactly one `isCurrent == true` → keep its `id`; 0 or 2+ → STOP, report it to the owner.
10. Build `requirementProposal` from {{tool:list_requirements}}(projectId, baselineId) data with {{ref:change-set-state-machine}}: `additions` (copies of existing requirements) OR `revisions` (exact current `title` and `beforeDescription`). Never mix.
11. {{tool:create_change_set}}(projectId, title, summary, sourceBaselineId=<step 9>, requirementProposal, dryRun=true) [A] → keep `draft.scopeProposal.contentFingerprint`.
12. Show the dry run; on "yes" {{tool:create_change_set}}(same arguments without dryRun, expectedProposalFingerprint=<step 11>) [A] → keep `id` as changeSetId (`reused: true` = it existed).
13. [C] {{tool:update_change_set}}(projectId, changeSetId, status="in-review", expectedProposalFingerprint) [C]. Later, owner's words only: the same call with status="approved" or "rejected" [O]. Send only these 4 keys.
14. Verify (proposal): {{tool:get_change_set}}(projectId, changeSetId) → `status` == the requested value, `scopeProposal.contentFingerprint` == the fingerprint.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| approving or rejecting without the owner's own words | "Owner: approve or reject change set <title> (<id>, materiality <m>, <n> requirements)?" STOP |
| `readyToCreate == false` on a thread draft | hand the thread to {{skill:lpm-governance-decisions}}, STOP |
| approved, `requiresFormalReview == true`, yet `matchedApprovedChangeSetId == null` | scope or linked work changed after the snapshot: new change set (steps 1-8), review again |
| asked to set `publicationBaselineId` or call {{tool:publish_change_set}} now | refuse: both happen only after baseline publication ({{ref:flow-baseline}}) |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create or status move | {{tool:get_change_set}}(projectId, changeSetId) | `status` == the requested value |
| owner approval (live, `requiresFormalReview == true`) | {{tool:get_project_scope_resolution_context}}(projectId) | `publicationGate.matchedApprovedChangeSetId == changeSetId` |

## Report fields
- Done: change set id, mode (live or proposal), `status`.
- Evidence: `reviewPolicy.requiresFormalReview`, `publicationGate.materiality`, the owner's quote for approval or rejection.
- Pending: "change set review — owner"; removals named in the summary.
