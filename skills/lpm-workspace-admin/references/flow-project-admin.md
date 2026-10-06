# Flow: create, change, archive or unarchive a workspace or project
Load when: decision rows 4, 5, 6 or 8

## Preconditions
1. Reads ({{tool:list_workspaces}}, {{tool:get_workspace}}, {{tool:list_projects}}, {{tool:get_project}}) work on a connector. Writes need an LPM API key: portfolio profile for creates and settings; full or custom for archive and unarchive. A write on a connector → core rule 2.
2. Workspace updates: {{tool:list_workspaces}} → `access.canManage == true`. Project updates, archive, unarchive: {{tool:get_project}} → `access.canManage == true`. {{tool:create_project}}: the workspace is in your {{tool:list_workspaces}} result. {{tool:create_workspace}}: nothing extra.
3. `governanceAssignments`, `routingProfile`, `workspaceId` or `teamId`: only on an instruction of the `project-owner` ({{tool:get_project}} → `governanceAssignments`) or the workspace owner ({{tool:get_workspace}} → `ownerId`) naming the change in this conversation. A `name` or `description` change needs only the user's yes.
4. IDs come from SKILL.md §3 Inputs. Creates are not idempotent: after a timeout, re-list before any retry (core rule 5).

## Steps
### A. Create a workspace or a project (row 4)
1. Workspace: {{tool:list_workspaces}}() → same `name` → ask "Use <id>?" and STOP. Else show the call; on "yes" {{tool:create_workspace}}(name, description; `slug` only when the user gave one) [C] → keep `workspaceId` after "ID: ". Report under Pending: "AI is on with default budgets: the owner reviews it with {{skill:lpm-ai-cost}}".
2. Project: {{tool:list_projects}}(workspaceId, includeArchived=true) → same `key` or `name` → ask "A project <key> already exists (<id>). Use it?" and STOP. Else show "create_project(name, key, workspaceId, teamId, description)": key = 3–6 uppercase letters, name per {{ref:naming-conventions}}, teamId only when the user named a team. Continue only on "yes".
3. {{tool:create_project}}(name, key, workspaceId, teamId, description) [C] → keep `projectId` after "ID: ". Timeout → step 2 before any retry. Report next steps: governance roles (B), first baseline ({{skill:lpm-requirements-scope}}), activities ({{skill:lpm-plan-work}}).
4. Verify: {{tool:get_workspace}}(workspaceId) → `name` matches; {{tool:get_project}}(projectId) → `key`, `workspaceId` match and `archived == false`.
### B. Project settings, governance roles, routing profile, move (row 5)
5. {{tool:get_project}}(projectId) → keep `access.canManage`, `workspaceId`, `teamId`, `governanceAssignments`, `routingProfile`. `canManage == false` → STOP: "Only a project manager can change this: <project-owner>." Roles, routing or move without the owner instruction of Precondition 3 → § Stop and ask row 2.
6. Patch = only the changed fields; never send `hourlyRate`, `archived`, `ownerId`, `key` or fields outside the schema. `governanceAssignments` replaces the list: copy step 5, change only the named roles (`project-owner`, `product-owner`, `delivery-lead`), one per role, userId from SKILL.md §3 ({{ref:roles}}).
7. `routingProfile` replaces the object: copy step 5, send all nine arrays ({{ref:routing-profile}}); omitted arrays become `[]`, `null` clears it. No `workspaceId` → STOP "The project needs a workspace first." Unowned gap: add the exact string from {{tool:list_unowned_domains_or_capabilities}}(workspaceId) to `domains` or `ownedCapabilities`. Move: `workspaceId` from {{tool:list_workspaces}}, `teamId` from {{tool:list_teams}}.
8. Show each changed field as before → after; continue only on "yes". Then {{tool:update_project}}(projectId, changed fields) [C].
9. Verify: {{tool:get_project}}(projectId) → every changed field equals the patch and kept roles are present; move → `routingProfile` re-read and shown ({{ref:routing-profile}}); gap: {{tool:list_unowned_domains_or_capabilities}}(workspaceId) → the gap `id` is absent.
### C. Archive or unarchive a project (row 6; {{ref:destructive-ops}})
10. {{tool:get_project}}(projectId) → keep `name`, `key`, `archived`, `access.canManage`. `access.canManage == false` → STOP: "Only a project manager can change this: <project-owner>." `archived` already equals the request → report "nothing to do" and STOP.
11. Archive: ask "Archive <name> (<key>)? It leaves the project lists; data is kept; unarchive restores it. (yes/no)" → {{tool:archive_project}}(projectId) [C]. Unarchive: ask "Restore <name> (<key>) to the active lists? (yes/no)" → {{tool:unarchive_project}}(projectId) [C].
12. After unarchive: {{tool:list_requirement_baselines}}(projectId) → no `isCurrent == true` → report "unbaselined" → {{skill:lpm-requirements-scope}}; {{tool:list_issues}}(projectId, status="in-progress", limitCount=100), then status="todo" → report open work.
13. Verify: {{tool:get_project}}(projectId) → `archived` equals the request.
### D. Rename, archive or reactivate a workspace (rows 6 and 8)
14. {{tool:get_workspace}}(workspaceId) → keep `name`, `status`; {{tool:list_workspaces}}() → `access.canManage == false` → STOP. Delete asked (row 8) → say "No MCP tool deletes a workspace" and offer archive. `status="archived"` → ask "Archive workspace <name>? ChatGPT/Claude connectors bound to it start failing with access denied. (yes/no)"; other changes → show the call; on "yes" {{tool:update_workspace}}(workspaceId, changed fields; `status` `active`|`archived`) [C].
15. Verify: {{tool:get_workspace}}(workspaceId) → every sent field (`name`, `status`) equals the request.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| same workspace `name` or project `key`/`name` exists | "A project <key> already exists (<id>). Use it?" / "Use <id>?" |
| `governanceAssignments`, `routingProfile`, `workspaceId` or `teamId` change without an instruction of the `project-owner` or workspace owner naming it in this conversation | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) to that owner; STOP. With the instruction: quote it in the report |
| people or values for settings not named | ask; never invent a userId, key or routing term |
| `access.canManage == false` | "Only a project manager can change this: <project-owner>." |
| change the project `key` | "Changing a project key is not supported through MCP." STOP |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create workspace / project | {{tool:get_workspace}} / {{tool:get_project}} | `name`, `key`, `workspaceId` match; `archived == false` |
| settings, roles, routing profile, move | {{tool:get_project}} | every changed field equals the patch; kept roles present; after a move `routingProfile` re-read |
| archive / unarchive | {{tool:get_project}} | `archived` equals the request |
| workspace update | {{tool:get_workspace}} | `name`, `status` equal the request |

## Report fields
Scope (workspace, project key + id), Done (fields before → after), Evidence (re-read; owner instruction quoted for roles, routing or move), Pending, Next.
