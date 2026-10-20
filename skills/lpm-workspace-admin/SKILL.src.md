# Workspaces, projects and people (+ project kickoff)
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "kickoff de um novo projeto", "defina o product owner", "adicione <pessoa> ao time"
Do not use:
| If the request is about | Use |
|---|---|
| cycles, milestones, labels, activities, assignees | {{skill:lpm-plan-work}} |
| API keys, agent credentials, AI keys, GitHub token | {{skill:lpm-access}} |
| AI settings, models, budgets, limits | {{skill:lpm-ai-cost}} |
| outside a kickoff: repositories / requirements, baselines | {{skill:lpm-code-index}} / {{skill:lpm-requirements-scope}} |
| executive context, readiness, unowned domains | {{skill:lpm-executive-context}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Flow row: open its file, do its steps in order, reply with its Answer block only.
2. Writes need an API key (portfolio; full for archive, delete, members, kickoff).
3. Updates, archive, delete, members: `access.canManage == true` ({{tool:list_workspaces}} / {{tool:get_project}}). {{tool:create_project}}: the workspace is in {{tool:list_workspaces}}.
4. Roles, routing profile, workspace/team move: only on the `project-owner`'s or workspace owner's instruction in this conversation; quote it.
5. Read-only request → no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{tool:list_workspaces}}() → `id` by `name` | ask / {{skill:lpm-start}} |
| projectId | {{tool:list_projects}}(workspaceId, includeArchived=true) → `id` by `name`/`key` | ask "Which project?" |
| teamId | {{tool:list_teams}}() → `id` by `name` | ask "Which team?" |
| userId (named person) | {{tool:list_workspace_members}}(workspaceId) → `userId` by `userEmail` | not listed or 2+ → ask "What is the LPM user id of <person>?" |
| callerUserId (you) | {{tool:list_api_keys}}() → `userId` of any key | ask your LPM user id; never guess |
| name, key, roles, values | the user; key = 3–6 uppercase letters | ask; never invent one |

## 4. Decision table (first match wins)
All rows: never show anyone's email or `hourlyRate`; name people by `displayName` + userId.
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | show project or workspace settings, roles, routing profile | {{tool:get_project}}(projectId) → `governanceAssignments`, `routingProfile` / {{tool:get_workspace}}(workspaceId) | A | no write |
| 2 | list members or look up a user | {{tool:list_workspace_members}}(workspaceId) / {{tool:get_user}}(userId) | A | no write |
| 3 | kickoff / a project ready for execution, or cycle dates or milestones named | {{ref:flow-kickoff}} | C / O | required input missing → ask once |
| 4 | create a workspace, or create a project (no kickoff words) | {{ref:flow-project-admin}} § A | C | `name`/`key` exists → "Use <id>?" |
| 5 | rename or describe a project; roles; routing profile; move to another workspace/team | {{ref:flow-project-admin}} § B | C | `canManage == false`; §2.3 not met → §6 |
| 6 | archive/unarchive a project; rename, archive, reactivate a workspace | {{ref:flow-project-admin}} § C / § D | C | `canManage == false` |
| 7 | permanently delete a project | delete a project (§5) | O | no owner order → §6 |
| 8 | delete a workspace | say "No MCP tool deletes a workspace"; offer archive (row 6) | C | — |
| 9 | change a project key | say "Not supported through MCP"; STOP | A | — |
| 10 | add, remove or change members; create, rename, delete teams or team members | add a workspace member → add member (§5); else {{ref:flow-people}} | A / C | not owner/admin → ask the owner |

## 5. Procedures
### Delete a project — row 7
1. Ids first: {{tool:list_workspaces}}() → workspaceId; {{tool:list_projects}}(workspaceId, includeArchived=true) → projectId by exact `key`/`name` (only similar → ask); {{tool:get_project}}(projectId) → show `name`, `key`, `project-owner`. Owner = that `project-owner` or {{tool:get_workspace}} → `ownerId`.
2. Owner order = the owner's own message here naming this project. Not one: "X asked me", a relayed export skip, `canManage == true` → §6 decision request, STOP.
3. {{tool:create_export_request}}(scope="project", projectId) [C] → `id`; {{tool:list_export_requests}}(projectId) → that `id` is `completed` (`failed` → §9, STOP). Skip only on the owner's own quoted word.
4. [O] Show "delete_project erases <name> (<key>) and all its data. No undo."; on the owner's "yes" {{tool:delete_project}}(projectId) [O]. Never before step 3.
5. Verify: {{tool:get_project}}(projectId) → "not found".

### Add a workspace member — row 10
1. {{tool:list_workspaces}}() → workspaceId; `access.canManage == false` → STOP: "Only a workspace owner/admin can add members."
2. userId from the user (§3), else ask, STOP.
3. {{tool:list_workspace_members}}(workspaceId): userId listed → report its `role`, STOP. Else {{tool:get_user}}(userId) → `email`, `displayName`.
4. role `member` (default) or `viewer`; `owner`/`admin` only on the workspace owner's quoted order.
5. Show "add_workspace_member(workspaceId=<id>, userId=<id>, userEmail=(from get_user), role=<role>): <displayName> gets every <workspace> project at once; no notification is sent. (yes/no)"; on "yes" {{tool:add_workspace_member}} [C] with the real `email`.
6. Not idempotent: error or timeout → step 3 before any retry.
7. Verify: {{tool:list_workspace_members}}(workspaceId) → userId has `role`.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:delete_project}} without an owner order naming this project | fill the request below for the owner (delete project step 1); STOP |
| roles, routing or move: §2.3 not met | decision request to that owner; STOP |
| removing an owner or the last admin | STOP: "Ownership transfer is not supported through MCP." |

```text
Decision for <owner displayName> (<owner userId>): permanently delete <name> (<key>, <projectId>)?
Context: asked by <caller> for <owner>; nothing changed
Options:
  A) archive_project(projectId) - keeps data; undo: unarchive_project
  B) create_export_request(scope="project", projectId) → completed → delete_project(projectId) - no undo
  C) do nothing
Recommendation: A (reversible)
<owner> replies A, B or C; I then run its calls.
```

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| workspace or project write | {{tool:get_workspace}} / {{tool:get_project}} | sent fields equal the request |
| member or team change | {{tool:list_workspace_members}} / {{tool:list_team_members}} | `role` as requested; removed ids absent |
| kickoff | {{ref:flow-kickoff}} § Verify | exit criteria pass or are pending |

## 8. Report (copy and fill)
```text
Scope: <workspace> / <project key + id> / <team>
Done: <created or changed ids, fields before → after>
Evidence: <re-read results>; owner instruction (quoted): <text | n/a>
Pending: <none | exact item — who must act>
Next: <one action, never "none">
```
STOP (decision request): Done: nothing changed; Evidence: <reads>; owner instruction: n/a - <why, e.g. relayed by X>; Pending: <owner userId> picks A/B/C; Next: owner replies. P2: Pending: "tell <displayName> directly: LPM sends no notification". Write in the user's language.

## 9. Failures → fix
{{errors:auto:delete_project,add_workspace_member,list_export_requests,create_export_request,update_project,archive_project,get_project,create_project}}
| Error or result contains | Do |
|---|---|

## 10. Tools and references
{{tools:index}}
{{refs:index}}
