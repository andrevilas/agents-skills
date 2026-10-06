# Destructive operations
Load when: before archive, unarchive, delete or member removal
Applies to: lpm-workspace-admin    Source: cards {{tool:archive_project}}, {{tool:list_export_requests}}, {{tool:unarchive_project}}, {{tool:delete_project}}, {{tool:update_workspace}}, {{tool:remove_workspace_member}}, {{tool:delete_team}}, {{tool:remove_team_member}}, {{tool:create_export_request}}; digest legacy-lpm-workspace-admin §1.2, §2.2

## Summary
- Prefer reversible actions: archive before delete. {{tool:archive_project}} only hides the project; {{tool:delete_project}} erases it with no undo.
- {{tool:delete_project}} is owner-only: owner order naming the project, export first, then delete.
- After unarchive, check the current baseline and the open work before calling the project operational.
- Member and team removals take effect at once and have no server safety checks.

## Facts
| Operation | What it does | Consequence for the agent |
|---|---|---|
| {{tool:archive_project}} [C] | sets `archived=true`; hidden from {{tool:list_projects}} unless `includeArchived=true`; its issues stay readable and writable | reversible with {{tool:unarchive_project}} |
| {{tool:unarchive_project}} [C] | sets `archived=false` | restores visibility only; deleted data never comes back |
| {{tool:delete_project}} [O] | recursive delete: issues, comments, cycles, milestones, requirements, baselines, file records, ledger, activity-feed entries, cross-project issue links | no soft delete, no undo, no server confirmation; uploaded storage objects stay |
| {{tool:create_export_request}} [C] | queues a full JSON zip of the project or workspace; status `queued` → `completed` or `failed` | each call queues a new full export; the user downloads it in LPM Settings; poll {{tool:list_export_requests}} → `status` until `completed` (`failed` → STOP, report `errorMessage`) |
| {{tool:update_workspace}} `status="archived"` [C] | archives the workspace | connectors bound to it fail with access denied; it leaves the connector workspace list |
| {{tool:remove_workspace_member}} [C] | removes the membership; returns success even for a non-member | no check for the owner or the last admin; agent credentials the person is accountable for stop working; access through teams may remain |
| {{tool:remove_team_member}} [C] | removes one team member | access to the team's projects ends unless the workspace grants it; "Team owner cannot be removed" |
| {{tool:delete_team}} [C] | deletes only the team document; success even for an unknown id | member records stay orphaned; projects and workspaces keep the old `teamId`; no undo |
| assigned activities | removals never reassign them | report them to {{skill:lpm-plan-work}} |

## Post-unarchive checks
| Check | Tool → field | Not passing → |
|---|---|---|
| current baseline | {{tool:list_requirement_baselines}}(projectId) → one item with `isCurrent == true` | report "unbaselined" → {{skill:lpm-requirements-scope}} |
| open work | {{tool:list_issues}}(projectId, status, limitCount=100) → `items` | stale or ownerless → {{skill:lpm-plan-work}} |
| ownership | {{tool:get_project}}(projectId) → `governanceAssignments` | roles missing → {{ref:flow-project-admin}} § B |
| active cycle and open milestones | {{tool:get_project_execution_context}}(projectId) → `planning.activeCycles`, `planning.openMilestones` | none or stale → {{skill:lpm-plan-work}} |
| repository links | scans older than 24 h are stale | {{skill:lpm-code-index}} |

## Rules
1. Archive is the default answer to "remove", "close" or "hide" a project. Delete only on the owner's order naming this project. A relayed order ("X asked me"), a relayed export skip or `canManage == true` is not an owner order: send SKILL.md §6 decision request, STOP.
2. Before {{tool:delete_project}}: {{tool:get_project}} → show `name` and `key`; queue the export and see `completed` in {{tool:list_export_requests}} (or quote the owner's written skip); get the owner's "yes" after the full list of what is erased.
3. Never retry {{tool:delete_project}} blindly: "not found" means it is already gone.
4. An archived project keeps its historical baseline: new scope is a new governed increment ({{skill:lpm-requirements-scope}}), never an edit of the old record.
5. Before {{tool:delete_team}}: show the team, its members and {{tool:list_projects}}(teamId).
6. Never remove the workspace owner, the last owner/admin or the team owner; ownership transfer is not available through MCP.

## Examples
```text
example: owner: "apague o projeto TESTE (key TST), já exportei" → get_project → show name/key →
quote the order (export skip) → show "delete_project erases TESTE (TST) and all its data. No undo." →
owner: "sim" → delete_project(projectId) → get_project returns "not found"
```
