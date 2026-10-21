# Flow: access review
Load when: decision row 2 of SKILL.md (review keys, agent credentials, principals, provider keys, the GitHub token or specialists)

## Preconditions
1. Read-only: call no write tool in this flow. The 4 secret reads ({{tool:list_api_keys}}, {{tool:list_workspace_mcp_agent_credentials}}, {{tool:list_workspace_ai_credentials}}, {{tool:get_workspace_repository_credential}}) need a `full` or `custom` key.
2. {{tool:list_api_keys}} shows only the caller's own keys; there is no workspace-wide key audit. Never ask for another user's keys.

## Steps
1. {{tool:list_api_keys}}() → per key `name`, `keyPreview`, `accessProfile`, `status`, `lastUsedAt`; flag `accessProfile == "full"` and active keys with no `lastUsedAt`.
2. {{tool:list_workspace_mcp_agent_credentials}}(workspaceId) → `status`, `expiresAt`; compare `expiresAt` with now (status stays `active` after expiry). `[]` does not prove that none exist.
3. {{tool:list_workspace_agent_principals}}(workspaceId) → `specialistType`, `mode`, `status`, `accessProfile`.
4. {{tool:list_workspace_ai_credentials}}(workspaceId) → `provider`, `label`, `updatedAt`.
5. {{tool:get_workspace_repository_credential}}(workspaceId) → `status`, `revision`, `validatedAt`.
6. projectId given → {{tool:list_project_specialist_assignments}}(projectId) → `status` per principal; {{tool:get_project_specialist_governance_summary}}(projectId) → `effectiveAssignmentCount`, `reviewState`.
7. A -32003 on one read → report that part as "needs a full or custom key" and continue with the others; this overrides core rule 2 (no STOP) for reads in this review. Message "You do not have permission to manage or view credentials in this workspace." → report that part as "not owner or admin of this workspace" instead.
8. Profile question: name the job, then the smallest preset from {{ref:api-key-profiles}} (`read-only` first); `roadmap-owner-*` → an `lpm_mcp_` credential ({{ref:ref-agent-identities}}).
9. Recommend one corrective action per flag (revoke an unused key, narrow a `full` key, rotate an expiring credential).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| the user asks to fix a flag | it is a write: SKILL.md §4 row for that write, with the owner's order |
| `reviewState == "agent-reviewed"` | report it as an agent review, never as a human approval |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| the review | nothing (read-only) | every section above is reported or marked "needs a full or custom key" / "not owner or admin of this workspace" |

## Report fields
Scope, per area (API keys, agent credentials, principals, provider keys, GitHub token, specialists) the masked values and flags, one corrective action per flag, Pending, Next.
