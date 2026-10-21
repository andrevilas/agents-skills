# Flow: agent identities and specialist assignments
Load when: decision rows 6 and 7 of SKILL.md (agent principals, `lpm_mcp_` credentials, specialist assignments)

## Preconditions
1. Run SKILL.md P1 first: the owner's order is quoted. Row 6: the caller can manage the workspace (P1 step 3). Row 7: no pre-check; the server decides ("You do not have permission to manage this project" → STOP, ask the project owner or a workspace owner or admin).
2. IDs: principalId (= agentPrincipalId) from {{tool:list_workspace_agent_principals}}(workspaceId) → row with `status == "active"`; credentialId from {{tool:list_workspace_mcp_agent_credentials}}(workspaceId) → the `id` that no other row names as `predecessorId`; accountableUserId and accountableOwnerUserId from {{tool:list_workspace_members}}(workspaceId) → the human `userId` the owner names, never an `agent:` id and never the caller by default.
3. Facts (pairs, immutable fields, lifecycle, the copilot tool list): {{ref:agent-credentials}}.

## Steps
1. {{tool:list_workspace_agent_principals}}(workspaceId) → an active principal for the same purpose → reuse its `id`, skip step 2.
2. Register: {{tool:create_workspace_agent_principal}}(workspaceId, displayName, specialistType, mode, version, authorityRestrictions, accessProfile, allowedTools, accountableOwnerUserId) [O] → keep `id`. Timeout → re-list first.
   - Copilot: pairs `advisor` + `roadmap-owner-advisor`, `executor` + `roadmap-owner-operator`; `allowedTools` = the names the owner picks from the copilot tool list ({{ref:agent-credentials}}); `accountableOwnerUserId` = the owner or admin the owner names (default: the workspace owner, {{tool:list_workspaces}} → `ownerId`), shown in the §6 question.
   - Specialist: `allowedTools` = read tool names the owner gives, or omit; omit `accountableOwnerUserId`.
3. Edit or archive: {{tool:update_workspace_agent_principal}}(workspaceId, agentPrincipalId, changed fields; arrays sent whole; status=`archived` only after the permanent question) [O].
4. Issue: principal must be `workspace-owner-copilot` and `active`. {{tool:create_workspace_mcp_agent_credential}}(workspaceId, principalId, accountableOwnerUserId, accessProfile, allowedTools=<subset of the principal's>, name, expiresAt=<owner, at most 90 days ahead>) [O] → keep `id`, `maskedKey`; hand over `secret` once.
5. Rotate: {{tool:rotate_workspace_mcp_agent_credential}}(workspaceId, credentialId, expiresAt=<at most 90 days>, overlapMinutes=<0–15, default 10>) [O] → hand over `secret` once; the old secret stops at `predecessor.overlapUntil`. Timeout → re-list: a row with `predecessorId` == credentialId exists → no second rotation.
6. Suspend, reactivate, revoke: `status` already the target → report "already <status>", no call; else {{tool:update_workspace_mcp_agent_credential_status}}(workspaceId, credentialId, status) [O]; `revoked` is final (row 6 again for a new credential).
7. Specialist: the principal must have `specialistType != "workspace-owner-copilot"`, `status == "active"` and `mode` `advisor` or `reviewer`; else STOP (the server does not reject a copilot). {{tool:list_project_specialist_assignments}}(projectId) → keep `id`, `status` of the row for the named principal; an active row → reuse it, no create. Pre-read {{tool:get_project_specialist_governance_summary}}(projectId) → keep `effectiveAssignmentCount`.
8. Assign: {{tool:create_project_specialist_assignment}}(projectId, agentPrincipalId, accountableUserId, scopeStatement, authorityBoundary) [O] → keep `id`. Add `validUntil`, `reviewCadence` only when the owner gave them; never invent a date or cadence. Not idempotent; no update exists: a change is revoke + create.
9. Unassign: `status == "revoked"` → report "already revoked", no call; else {{tool:revoke_project_specialist_assignment}}(projectId, assignmentId=`id` from step 7) [O].
10. Verify: run the Verify table below.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| before {{tool:create_workspace_mcp_agent_credential}}, {{tool:rotate_workspace_mcp_agent_credential}} | "Create/rotate <name>, profile <p>, expires <ISO date ≤ 90 days>? The secret is shown once." |
| before {{tool:update_workspace_mcp_agent_credential_status}} (revoked), {{tool:update_workspace_agent_principal}} (archived), {{tool:revoke_project_specialist_assignment}} | "This is permanent: <the credential stops now / every credential of the principal stops / the assignment never returns>. Proceed?" |
| before {{tool:create_workspace_agent_principal}}, {{tool:create_project_specialist_assignment}} | show every field, including `accountableOwnerUserId` / `accountableUserId` and the `allowedTools` list; "Type, mode, version and profile never change; assignments have no update. Create?" |
| copilot `allowedTools` or the accountable user not named by the owner | ask; never fill them yourself |
| "Credential binding is no longer valid" / "scope is no longer valid" | principal archived or changed, or the owner lost admin → new principal or credential |
| a principal or assignment would get authority to approve scope, budgets or decisions | refuse; agents never get human governance authority |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| principal create, edit, archive | {{tool:list_workspace_agent_principals}}(workspaceId) | fields or `status` as requested |
| credential issue, rotate, status | {{tool:list_workspace_mcp_agent_credentials}}(workspaceId) | new `id` with `status == "active"` and the given `expiresAt`, or the requested `status` |
| assignment create, revoke | {{tool:list_project_specialist_assignments}}(projectId) | row `id` has the requested `status` |
| assignment create, revoke (report only) | {{tool:get_project_specialist_governance_summary}}(projectId) | report `effectiveAssignmentCount` before → after; it moves only when the assignment is effective now (`validFrom` ≤ now < `validUntil`) |

## Report fields
Scope, owner order (quoted), principal `id`, credential `id` + `maskedKey` + `expiresAt` (never the secret), assignment `id` + `status`, Pending (agent config update before `overlapUntil`), Next.
