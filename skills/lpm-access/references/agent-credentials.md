# Agent credentials
Load when: working with agent principals, lpm_mcp_ credentials or specialist assignments
Applies to: lpm-access    Source: lpm `server.ts` `createWorkspaceAgentPrincipalCommand`, `updateWorkspaceAgentPrincipalCommand`, `createWorkspaceMcpAgentCredentialCommand`, `rotateWorkspaceMcpAgentCredentialCommand`, `updateWorkspaceMcpAgentCredentialStatusCommand`, `authenticateMcpAgentCredential`; `src/lib/specialistAgentGovernance.ts`; cards of the 11 principal, credential and assignment tools
## Summary
- A principal is the agent identity (`agent:<id>`); a credential is its `lpm_mcp_` secret; an assignment puts a specialist principal on one project.
- Only a `workspace-owner-copilot` principal can hold a credential. Expiry is at most 90 days; the secret is shown once.
- Effective tools = profile preset AND principal `allowedTools` AND credential `allowedTools`.
- Rotation keeps the old secret alive for 0–15 minutes (default 10). `revoked` and `archived` are final.
- Principals and assignments never get human governance authority.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `specialistType` | `risk-reviewer`, `architecture-reviewer`, `data-steward-advisor`, `security-reviewer`, `privacy-advisor`, `records-management-reviewer`, `accessibility-reviewer`, `operations-reviewer`, `ai-risk-reviewer`, `tenant-isolation-reviewer`, `workspace-owner-copilot` | use the exact value |
| `mode` | `advisor`, `reviewer`, `executor` | `executor` only for a copilot; a copilot cannot be `reviewer`; executor specialists are not enabled |
| copilot pairs | `advisor` + `roadmap-owner-advisor` (36 tools); `executor` + `roadmap-owner-operator` (37, adds the owner-commit tool) | other pairs fail "mode and access profile do not match" |
| copilot `allowedTools` | required, non-empty subset of its profile ("must be a non-empty subset of its static profile") | send only names the owner picks from "Copilot tool list" below |
| copilot `accountableOwnerUserId` | required; the credential then acts AS this user (`user.uid`) | the owner or admin the owner names ({{tool:list_workspace_members}} `role` owner/admin; default the workspace owner, {{tool:list_workspaces}} → `ownerId`); never filled silently with the caller; never an `agent:` id |
| specialist `accessProfile` | `read-only` (default), `full`, `portfolio`, `planning`, `requirements` | specialists only ever get read tools |
| specialist `allowedTools` | read tool names | the names the owner gives, or omit |
| `authorityRestrictions` | required, non-empty plain-language limits | ask the owner, e.g. "no scope approval", "no budget changes" |
| immutable principal fields | `specialistType`, `mode`, `version`, `accessProfile` | to change one: archive, then create a new principal |
| `status: archived` | final; disables every credential of the principal at once; blocks new assignments | §6 permanent-change question first |
| arrays on update | `capabilities`, `authorityRestrictions` are replaced whole | send the full array |
| credential secret | `lpm_mcp_<26-char id>.<43-char secret>`, returned once as `secret` | hand it over once; evidence may hold only `id` and `maskedKey` |
| credential auth | `Authorization: Bearer lpm_mcp_…` (or `x-api-key`) | acts as the accountable owner inside this workspace only |
| `expiresAt` | ISO 8601, in the future, at most 90 days ahead | ask the owner for the date |
| `status` after `expiresAt` | stays `active` in the list | compare `expiresAt` with now |
| `usageLimits` | defaults 50 synthesis, 10 deep analyses, 500 code searches, 600000 input tokens per day; max 500, 100, 5000, 5000000 | owner decision; omit unless the owner sets them |
| lifecycle | `active` → `suspended`/`revoked`; `suspended` → `active`/`revoked`; `revoked` final | reactivating does not extend `expiresAt` |
| rotation | new `id` is `active` (even from `suspended`); old secret works until `overlapUntil` | update the agent's config inside the overlap |
| rotating twice | creates two live successors | after a timeout look for `predecessorId` first |
| empty credential list | credentials v2 may be off on the server | `[]` does not prove that none exist |
| credential stops working | principal archived, or the accountable owner lost owner/admin | "Credential binding is no longer valid" → new principal or credential |
| `lpm_mcp_` connection checks | it cannot call {{tool:get_mcp_connection_info}} | `lpm mcp status` |
| CLI | `lpm mcp-agent-credentials list`, `create`, `status`, `rotate`; `status` with `--status revoked` needs `--confirm` | `--confirm` only after the owner's yes |
| assignment create | not idempotent; no update tool | list first; change = revoke + create |
| assignment principal | the server checks only `status` active and type/mode copy; a `workspace-owner-copilot` in `advisor` mode passes | never assign a copilot as a specialist |
| assignment `accountableUserId` | a human with read access to the project | never an `agent:` id |
| assignment defaults | `reviewCadence` `quarterly`; `reviewTriggers` `baseline-change`, `release-gate`, `material-risk` | send only what the owner sets |
| assignment revoke | irreversible; on an already revoked row it rewrites `revokedAt` | check `status` first |
| effective assignment | active assignment + active principal + now inside `validFrom`/`validUntil` + type and mode still match | `effectiveAssignmentCount` moves only for an effective one; verify by the row `status` |
| `reviewState: agent-reviewed` | an agent ran a review | never a human approval; `humanAuthorityStillRequired` is always true |
| `overdueReviewCount` | relies on `nextReviewAt`, which creation leaves null | usually 0; not proof of a current review |

## Copilot tool list
Generated from the catalog snapshot (`profiles` contains `roadmap-owner-advisor`, 36 names; check fails if one leaves the snapshot). `roadmap-owner-operator` = these 36 + `commit_owner_roadmap_change`.

`analyze_workspace_roadmap`, `analyze_workspace_roadmap_item`, `answer_project_question`, `answer_workspace_roadmap_item_question`, `answer_workspace_roadmap_question`, `compare_repository_commits`, `explain_roadmap_item_technical_impact`, `get_owner_agent_usage`, `get_project`, `get_project_analytics`, `get_project_owner_surface`, `get_project_read_model`, `get_project_repository_context`, `get_repository_index_status`, `get_workspace`, `get_workspace_executive_context`, `get_workspace_owner_context_bundle`, `get_workspace_owner_surface`, `get_workspace_read_model`, `get_workspace_repository_context`, `get_workspace_roadmap_overview`, `list_project_repository_links`, `list_projects`, `list_workspace_capabilities`, `list_workspace_repository_links`, `list_workspace_roadmap_allocations`, `list_workspace_roadmap_item_links`, `list_workspace_roadmap_items`, `list_workspace_roadmap_materializations`, `list_workspace_roadmaps`, `preview_owner_roadmap_change`, `preview_workspace_roadmap_import`, `preview_workspace_roadmap_item_bulk`, `read_repository_file_excerpt`, `search_project_code`, `search_workspace_code`

## Rules
1. List principals before creating one; reuse an active principal with the same purpose.
2. Copy `principalId`, `accountableOwnerUserId`, `accessProfile` and `allowedTools` for a credential from the principal row.
3. Never print a credential secret after the single hand-over; report `maskedKey`.
4. Leaked secret with no need for overlap → revoke, then issue a new credential; scheduled change → rotate.
5. Rotate the newest credential of a chain (the one no other row names as `predecessorId`).
6. Never give a principal or an assignment authority to approve scope, budgets or decisions.

## Examples
```text
example: owner: "cria uma credencial para o copiloto, 30 dias"
-> list_workspace_agent_principals -> copilot agent:<id>, roadmap-owner-advisor, active
-> create_workspace_mcp_agent_credential(..., expiresAt=<today + 30 days>) -> secret handed over once
-> report: credential <id> (<maskedKey>), expires <date>
```
