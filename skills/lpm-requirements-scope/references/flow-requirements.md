# Flow: requirement edits
Load when: decision rows 3-6 of SKILL.md

## Preconditions
1. LPM API key with profile `requirements`, `full` or `custom`; the deletes need `full` or `custom`. A connector cannot write here.
2. Requirement edits change the working scope; never treat them as approved. Approved scope (SKILL.md §2.2: current baseline, `createdAt` <= `currentBaseline.createdAt`) without the owner's order (a non-owner's "yes" or "eu confirmo" is not that order): description rewrite → SKILL.md row 9; `obsolete`, delete, title or type change → {{tool:create_governance_thread}}(projectId, targetType="requirement", targetId=requirementId, title, content=<decision request with options A obsolete / B delete / C keep, recommendation A>) [A] → report the thread id, change nothing, STOP. Never {{tool:delete_requirement}} or {{tool:update_requirement}} here. Delivery status (`in-progress`, `met`, `not-met`) follows step 2.
3. `projectId`, `baselineId`, `requirementId` come from SKILL.md §3. Also:

| Input | Get it from (call → field) | If missing |
|---|---|---|
| `groupId` | {{tool:list_requirement_groups}}(projectId) → `id` where `name` matches | step 6 or omit |
| `issueId`, `linkedIssueIds` | {{tool:list_issues}}(projectId, limitCount=100) → `id` | ask |
| `sourceDocumentId` | {{tool:list_project_knowledge_items}}(projectId) → `id` | omit |

4. Read-only (SKILL.md rows 1-2; on a connector {{tool:list_requirement_baselines}}, {{tool:list_requirements}}, {{tool:list_change_sets}} and {{tool:list_issues}} work): traceability → {{tool:list_requirements}}(projectId, baselineId) → empty `issueId` and `linkedIssueIds`, and {{tool:list_issues}}(projectId, limitCount=100, every page) → linked ids missing, `done` or `canceled`; origin → {{tool:list_workspace_roadmap_materializations}}(workspaceId, projectId) → `itemId`, `method`; rules → {{tool:get_help_article}}(projectId, slug="baselines-e-working-scope" or "change-sets-e-aprovacoes"), cite the slug. Write nothing.

## Steps
0. Resolve inputs as calls (all [A]; plan these calls, never assume their values): {{tool:get_project_scope_resolution_context}}(projectId) → `baselineId` = `currentBaseline.id` (keep `currentBaseline.createdAt`); for a create or link: {{tool:list_requirement_groups}}(projectId) → `groupId` by `name`; {{tool:list_issues}}(projectId, limitCount=100) → `issueId` by `title`. Edit or remove: find `requirementId` in step 1's list, then check approved scope (`createdAt` <= `currentBaseline.createdAt`) → approved and no owner order → precondition 2 (governance thread, STOP).
1. Load {{ref:requirement-fields}}. {{tool:list_requirements}}(projectId, baselineId) → same `title` exists → ask "update it or add another?". Edit: keep `linkedIssueIds`, `linkedCycleIds`, `linkedMilestoneIds`.
2. Status "met" (row 4): {{tool:list_requirements}}(projectId, baselineId) → `linkedIssueIds` (includes the primary `issueId`), `linkedCycleIds`, `linkedMilestoneIds`. All three empty → STOP: "not met yet: no linked delivery". Else {{tool:list_issues}}(projectId, limitCount=100, every page) → every `linkedIssueIds` id has `status == "done"`. Else STOP: "not met yet". Only the owner's words saying it is met override both.
3. [C] Show the exact call, the intent (authoring, refinement, deprecation or cleanup) and "This changes the working scope; it is approved only when a baseline is published." Continue only on "yes".
4. New → {{tool:create_requirement}}(projectId, baselineId, title, description, type, status="pending", groupId, issueId, linkedIssueIds, sourceDocumentId) [C]; all 6 first fields are required. Keep the id after "ID: ".
5. Edit → {{tool:update_requirement}}(projectId, requirementId, <changed fields only>) [C]; links: the FULL list (kept + new), unlink the primary with issueId="". Remove (row 5) → the same call with status="obsolete" [C]; {{tool:delete_requirement}}(projectId, requirementId) [C] only after the delete text below.
6. Groups (row 3): {{tool:list_requirement_groups}}(projectId) → same `name` exists → reuse its id; else {{tool:create_requirement_group}}(projectId, name) [A] / {{tool:update_requirement_group}} [A] / {{tool:delete_requirement_group}}(projectId, groupId) [C] after the delete text below.
7. Orphans (row 6, `requirementsAwaitingBaseline.count > 0`): {{tool:list_requirements_awaiting_baseline}}(projectId, limitCount=100) → orphan text below → {{tool:reconcile_orphan_requirements_into_baseline}}(projectId, baselineId) [C]. No baseline → SKILL.md row 11.
8. Timeout on {{tool:create_requirement}} or {{tool:create_requirement_group}}: not idempotent; re-read the step 9 list tool before any retry.
9. Verify: {{tool:list_requirements}}(projectId, baselineId) → the item shows the sent values (deleted: absent); groups: {{tool:list_requirement_groups}}(projectId) → the `id` has the `name` (absent after delete); orphans: {{tool:get_project_scope_resolution_context}}(projectId) → `requirementsAwaitingBaseline.count == 0`.
10. Report from {{tool:get_project_scope_resolution_context}}: `workingScope.addedCount`, `workingScope.changedCount`, `publicationGate.materiality`. Removals and deletions never appear in the working-scope delta: list the ones made in this run.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| same `title` exists | "Update <title> (<id>) or add another?" |
| orphans | "Attach all <n> orphans (<titles>) to baseline <name> <version>? They count as changed." |
| delete a group | "Delete group <name>? <n> requirements become ungrouped." |
| delete a requirement | "Delete <title> (<id>)? Its links are removed for good and the delta will not show it; status `obsolete` keeps history." |
| analysis of a document or file | "Document analysis runs only in the LPM web UI (Requirements → Análise de documento). Run it there; I will review the drafts." Turning the feature on or off → {{skill:lpm-ai-cost}} |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| requirement create / update / delete | {{tool:list_requirements}}(projectId, baselineId) | the item has the sent values / is absent |
| group writes | {{tool:list_requirement_groups}}(projectId) | the `id` has the `name` (absent after delete) |
| {{tool:reconcile_orphan_requirements_into_baseline}} | {{tool:get_project_scope_resolution_context}}(projectId) | `requirementsAwaitingBaseline.count == 0` |

## Report fields
- Done: requirement ids created / edited / obsoleted / deleted; group ids; orphans attached.
- Evidence: `addedCount`, `changedCount`, `publicationGate.materiality` after the writes.
- Pending: "removals not visible in the delta: <ids and titles>"; publication needs the owner's order.
