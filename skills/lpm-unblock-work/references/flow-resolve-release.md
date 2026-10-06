# Flow: resolve a blocker context or release work after U ends
Load when: decision row 8 (the external cause is gone, P4) or row 9 (the upstream activity U is done or canceled, P5) of SKILL.md

## Preconditions
1. A blocker context ends only with {{tool:resolve_project_issue_blocker_context}}; a link ends by itself when U is `done`/`canceled` ({{ref:blocked-semantics}}).
2. An owner decision is never taken here (GOV-MAX v1): only the owner's own words or a resolved governance thread end it.
3. Comment keys and `<n>`: SKILL.md §3.

## Steps
### P4 Resolve a context — row 8
1. {{tool:get_issue}}(projectId, issueId) → `blockerContext`; not `active` → STOP "nothing to resolve".
2. `content` names a portfolio link id → run SKILL.md row 10 instead ({{ref:flow-remove-link}} closes the link and resolves this context); STOP here.
3. `content` starts with "Waiting for an owner decision" → continue only when the owner's decision is quoted in this conversation or {{skill:lpm-governance-decisions}} reports the thread resolved; else STOP and say "This needs the owner's decision (GOV-MAX v1)".
4. No resolution text from the user → ask "What removed '<content>'?".
5. {{tool:resolve_project_issue_blocker_context}}(projectId, issueId, resolution=<user text or the quoted decision>) [A].
6. Verify: {{tool:get_issue}}(projectId, issueId) → `blockerContext.status == "resolved"`.
### P5 Release after U ends — row 9
1. {{tool:get_issue}}(upstreamProjectId, U) → `status` `done`/`canceled` or `isDeleted:true` → continue; else STOP "U is still open". "Issue not found" → dangling link → row 10.
2. {{tool:get_project_dependency_summary}}(upstreamProjectId, includeResolved=true) → `activeChains[]` item with `issueId == U` → `blocked[]` → `issueId`, `projectId`, `status`.
3. Summary unavailable or no such item → {{tool:list_issue_links}}(upstreamProjectId) and {{tool:list_workspace_issue_links}}(workspaceId, sourceProjectId=upstreamProjectId): rows with `type == "blocks"` and `sourceIssueId == U` → target ids (legacy `is-blocked-by` with `targetIssueId == U` → the source id).
4. Each target T whose `status` is not `done`/`canceled`: {{tool:create_comment}}(T projectId, T issueId, content=<"U <id> is <status>; this activity may move">, idempotencyKey="release-<U>-<T>") [A].
5. Verify: {{tool:list_comments}}(T projectId, T issueId) → the comment id with your text, for each T.
6. T still listed by {{tool:list_blocked_project_issues}} → it has another cause: report it (P1). Portfolio links of U → row 10.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no resolution text | "What removed '<content>'?" |
| owner-decision context, no decision quoted | "This needs the owner's decision (GOV-MAX v1). Ask the owner, or open the thread with lpm-governance-decisions?" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:resolve_project_issue_blocker_context}} | {{tool:get_issue}}(projectId, issueId) | `blockerContext.status == "resolved"` |
| {{tool:create_comment}} | {{tool:list_comments}}(projectId, issueId) | comment id exists and its content is your text |

## Report fields
Scope, U and its status, released targets (issueId, comment id), resolved context (issueId, resolution), targets still blocked and why, Pending, Next.
