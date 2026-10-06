# Governance thread model
Load when: background for maintainers; the playbooks already hold every rule they need
Applies to: lpm-governance-decisions    Source: cards of the thread, inbox and draft tools; lpm server.ts governance thread commands (createGovernanceThreadCommand, updateGovernanceThreadCommand, getGovernanceThreadResolutionContextCommand); src/lib/governanceAutomationPolicy.ts; src/lib/projectGovernance.ts

## Summary
- A thread is a decision discussion on one requirement, baseline, roadmap item or roadmap change request of a project. Threads cannot target activities ("Unsupported governance thread target").
- Status: open → answered / decision-needed → resolved / closed. Replies never change the status.
- A decision is a structured `decisionOutcome` (type + summary). Agents record what a decider stated, on the decider's own order; they never originate a decision (GOV-MAX v1).
- Drafts are previews: `get_governance_thread_resolution_context` already returns `drafts.issue.draft`, `drafts.requirement{currentBaseline, draft}` and `drafts.changeSet.draft`, so the playbooks do not call the `prepare_*` tools (the snapshot classifies them as writes although they write nothing).

## Facts
| Field / value | Meaning | Consequence |
|---|---|---|
| decider | project owner (role `project-owner`, or the project `ownerId` as `source: fallback-owner`), product owner, delivery lead; one userId per role in `get_project` → `governanceAssignments` | an activity assignee or a workspace admin is not governance authority |
| write permission (create, reply, update, resolve) | project manager, product-owner, delivery-lead or platform admin | "You do not have permission …": never retry |
| project inbox permission | a project governance role; workspace admin alone is not enough ("owner surface") | sweep with `list_governance_threads` |
| inbox `requiresAction` | true for every unresolved thread without an outcome; reads only the 100 most recent threads, no cursor | decided threads with a missing artifact never show: sweep with `list_governance_threads` |
| `list_governance_threads` | all threads, newest activity first; cursor = last id; an unknown cursor restarts at page 1; no status filter | `latestMessagePreview` = first 240 characters of the last message |
| resolution context messages | the OLDEST `messageLimitCount` (max 100) messages | page `get_governance_thread_messages` with cursor = last message id |
| outcome types | clarification, create-activity (operational), derive-requirement (scope), propose-change-set (material), publication-note, no-action | only the 3 middle ones are actionable and need status resolved or closed |
| `actionTargetType` | issue, requirement, change-set, baseline, roadmap-item, roadmap-change-request; not validated | set only after the artifact exists |
| resolve | `resolve_governance_thread_with_outcome` replaces the whole outcome; same arguments twice = no write | link-back resends type, summary, actionTitle and status from the latest re-read |
| `policy.automationPolicy.reasonCodes` | `awaiting-reviewed-artifact-creation` → `artifact-created-from-reviewed-draft` once `actionTargetId` is set | proof that the link-back worked |
| `blockedAishJobIds` | API key only, max 50 queued jobs of the project | resolve/close releases them to execution approval (still needs approval); reopen holds them again; a running job makes resolve fail ("queued or terminal") |
| reopen | `update_governance_thread` status open + `decisionOutcome` null | erases the decision: [O] |
| idempotency | create and reply: none (retry duplicates); update and resolve: naturally idempotent | re-read before any retry |
| OAuth connector | `get_project_decision_inbox`, `list_governance_threads` (portfolio:read); `create_governance_thread`, `reply_governance_thread`, `create_comment` (opt-in portfolio:manage) | context, messages, update, resolve need an API key |

## LPM limits the playbooks route around
| Limit | Route |
|---|---|
| no MCP "whoami": the caller's userId is unknown | the user names the decider's role or name; the agent maps it to a userId with `get_project` / `list_project_assignable_members` and treats only "I decided" as the decider's own order |
| `create_issue` declares no `idempotencyKey` (the API key path accepts it undeclared) | playbook create-artifact checks `list_issues` for the same title before creating |
| link-back is [O] (owner decision D6 pending) | create-artifact asks for the decider's order before creating anything, so no orphan artifact is left |
| roadmap item creation: a change request cannot create items (changeType create does not work, also in enforce mode; create_workspace_roadmap_item is not gated by enforce) | the decision is recorded as clarification and handed to lpm-roadmap: only on the owner's explicit order, create_workspace_roadmap_item without lifecycle (draft); every later change through change requests; then link back with create-artifact |
| change-set draft delta = the WHOLE working scope | the change set is created in lpm-requirements-scope, then linked back |
