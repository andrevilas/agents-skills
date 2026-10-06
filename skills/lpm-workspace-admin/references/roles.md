# Roles
Load when: for member, team or governance-role changes
Applies to: lpm-workspace-admin    Source: cards {{tool:list_workspace_members}}, {{tool:add_workspace_member}}, {{tool:list_team_members}}, {{tool:add_team_member}}, {{tool:update_project}}, {{tool:get_project}}, {{tool:get_user}}; lpm `src/lib/projectGovernance.ts`; help `papeis-governanca-e-responsabilidades`, `como-comecar-um-projeto`

## Summary
- Workspace = the main collaboration boundary (roles `owner`, `admin`, `member`, `viewer`). Team = an optional slice (roles `owner`, `admin`, `member`).
- Project governance roles decide: `project-owner`, `product-owner`, `delivery-lead`. Being an activity assignee is not authority.
- Least privilege: add people as `member` (or `viewer`); `owner`/`admin` only when the owner asks.
- No tool lists all users or finds one by email; there is no role-update tool (remove, then add).

## Facts
| Role / value | Meaning | Consequence for the agent |
|---|---|---|
| workspace `owner` | full rights; also stored as {{tool:get_workspace}} → `ownerId` | never remove; the owner keeps access through `ownerId` |
| workspace `admin` | manages members and settings (`access.canManage == true`) | granting it is the workspace owner's decision |
| workspace `member` | works in every workspace project | default for new people |
| workspace `viewer` | read-only | use for observers and auditors |
| team `owner` | creator of the team; cannot be removed | rename: owner or admin; delete: owner only (the server checks neither) |
| team `admin` / `member` | manage the team / belong to it | membership gives read access to every project with that `teamId` |
| `project-owner` | project boundary, overall ownership, operational integrity | escalation point for structural doubts |
| `product-owner` | meaning of scope, acceptance of business change | must be visible when requirements or baselines change |
| `delivery-lead` | execution cadence, delivery blockers, plan vs operation | does not approve scope |
| `governanceAssignments` | `[{role, userId}]`, one per role, replaced wholesale | resend the roles you keep; `userId` starting with `agent:` is dropped |
| project manager | project owner, `project-owner` role, workspace manager or team admin | {{tool:get_project}} → `access.canManage` tells you |
| {{tool:get_user}} | returns any user's profile, including email and `hourlyRate` | personal data: never paste it into comments or shared channels |
| {{tool:add_workspace_member}} | access starts at once; no notification; server checks neither `userId` nor `role` | verify the id with {{tool:get_user}} first; copy `role` exactly |
| {{tool:add_team_member}} | sends an in-app "Team invitation" notice | tell the user the person is notified |

## Rules
1. Resolve people from {{tool:list_workspace_members}} or {{tool:list_team_members}}, or a uid the user gives; 0 or 2+ matches → ask.
2. Use `member` unless the workspace or team owner asked for `owner`/`admin`; say so in the report.
3. Role change = remove, then add, after one [C] confirmation that names both calls. Never change your own role; a failed add after the remove → STOP and tell the workspace owner.
4. Set governance roles only with the people the user named, on an instruction of the `project-owner` or workspace owner; one person may hold several roles.
5. Activity assignees come from the project's assignable members ({{skill:lpm-plan-work}}), not from these lists.

## Examples
```text
example: "torne a Ana product owner do projeto" → get_project → keep the other roles →
update_project(projectId, governanceAssignments=[{role:"project-owner", userId:<kept>},
{role:"product-owner", userId:<Ana's userId>}]) → get_project shows both roles
```
