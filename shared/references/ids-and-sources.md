# IDs and their sources
Load when: a step needs an ID, hash or version you lack
Applies to: every skill    Source: cards `inputs[].source` (catalog/cards), lpm `src/lib/commitActivityLinker.ts`
Owner skill: lpm-start

## Summary
- Every ID comes from the user, a file the user named (`.lpm-activity`) or a tool result of this run. Never invent one.
- 0 matches or 2+ matches for a name → ask one question that lists the candidates.
- An activity (issue) id is NOT an activity-feed id: evidence tools need the feed entry id.
- Concurrency values (`updatedAt`, generation, hashes, fingerprints) are read right before the write and copied exactly.

## Facts
| ID or value | Get it from (call → field) | Notes |
|---|---|---|
| workspaceId | `list_workspaces` → `id` | a single-workspace OAuth grant may omit it |
| projectId | `list_workspace_projects`(workspaceId) or `list_projects` → `id` | also `get_issue` → `projectId` |
| issueId (activity) | user, `.lpm-activity`, `list_issues`(projectId) → `id`, `recommend_next_activity` → `recommendation.issueId` | `create_issue` returns text "Issue created with ID: <id>" |
| activityId (feed entry) | `list_workspace_activities`(workspaceId, projectId) → newest `id` with `targetType == "issue"` and `targetId == issueId` | not the issueId; none → comment first, list again |
| commentId | `list_comments`(projectId, issueId) → `id` | |
| cycleId / milestoneId / labelId | `list_cycles` / `list_milestones` / `list_labels` → `id` | cycleId and milestoneId are not validated on write |
| assigneeId | `list_project_assignable_members`(projectId) → `uid` | never from workspace or team member lists |
| userId (membership) | `list_workspace_members` → `userId` | `get_user` only with a known uid; there is no global user list |
| teamId | `list_teams` → `id` | |
| riskId | `list_project_resolution_risks` → `risks[].id` | |
| baselineId | `list_requirement_baselines` → `id` | the current one has `isCurrent: true` |
| requirementId / groupId | `list_requirements` / `list_requirement_groups` → `id` | |
| changeSetId | `list_change_sets` → `id` | proposal fingerprint: `get_change_set` → `scopeProposal.contentFingerprint` |
| threadId | `list_governance_threads` → `items[].id`, or a decision inbox item | |
| roadmapId | `list_workspace_roadmaps` → `id` | |
| itemId + version | `list_workspace_roadmap_items` → `id`, `updatedAt` | roadmap item id, not an issueId |
| changeRequestId | `list_workspace_roadmap_change_requests` → `requests[].id`, or `get_workspace_roadmap_review_inbox` | `expectedUpdatedAt` ← `get_workspace_roadmap_change_request` → `updatedAt` |
| capabilityId | `list_workspace_capabilities` → `id` | |
| repositoryLinkId | `list_workspace_repository_links` or `list_project_repository_links` → `id` | |
| versionId | `refresh_repository_code_index` → `id` | a validating candidate is not listed by `get_repository_index_status`: keep the id |
| expectedGeneration | `get_repository_index_status` → `pointer.generation` | 0 when `pointer` is null |
| jobId / expectedManifestHash | `list_aish_jobs` → `id`; `get_aish_job` → `executionManifestHash` | |
| sessionId / planHash | `list_aish_execution_sessions` or `create_aish_execution_session` → `session.id`; `put_aish_execution_plan` → `plan.hash` | |
| leaseNonce, fencingToken, coordinatorId | `acquire_aish_coordinator_lease` | keep the latest; never write the nonce in comments |
| attemptId | `lease_aish_runner_job` → `lease.leaseId` | |
| releaseId | `get_aish_release` → `release.id` | `expectedPackageHash` must equal the releaseId |
| budget version / entries hash | `get_aish_budget` → `budgets[].version`, `reservation.entriesHash` | owner-only writes |
| accounting fingerprint | `get_aish_accounting` → `projection.sourceFingerprint` | |
| intakeEntryId | user, or `get_protocol`(protocolCode) → `intakeEntryId` | no MCP tool lists intake entries |
| protocolCode | user, or `get_operational_entry` → `protocolReference.protocolCode` | format `NAMESPACE-YYYYMMDD-NNNN` |
| operational entryId | `list_operational_entries` → `items[].id` | |
| subscriptionId | `list_webhook_subscriptions` → `id` | |
| API key / credential / principal ids | `list_api_keys` / `list_workspace_mcp_agent_credentials` / `list_workspace_agent_principals` → `id` | |
| skillsContextId | `list_skills_contexts` → `id` | |
| runner `expectedUpdatedAt` | `get_aish_runner_management_overview` → `runners[].updatedAt` | |

## Rules
1. Resolve names to IDs with a list call; match the exact name first, then ask.
2. Copy IDs exactly; they are case-sensitive Firestore document ids.
3. Read a version, generation, hash or fingerprint in the same run, right before the write that needs it.
4. An ID from another workspace or project → STOP and ask; tools do not always reject it.
5. A parameter not in this table → read its card in `references/tools.md` ("Source" column).

## Examples
```text
example: "anexa o print na atividade Login quebrado"
-> list_issues(projectId) -> 1 match "Login quebrado" -> issueId
-> list_workspace_activities(workspaceId, projectId, limit=200)
-> newest entry with targetType "issue" and targetId == issueId -> activityId
example: two projects named "Portal" -> ask "Which project: Portal (PORT) or Portal (PTL2)?"
```
