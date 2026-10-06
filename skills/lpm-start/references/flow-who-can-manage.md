# Playbook: who-can-manage
Use when: you cannot manage a project or workspace (access.canManage false), or "who can give me access?"
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or a get_project the user already ran | "none" |
| workspaceId | the user | "none" (step 2 reads it from the project) |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nobody was looked up."
1. IF <input:projectId> is "none" and <input:workspaceId> is "none" → STOP. Say: "Which LPM project or workspace? (name or id)"
   IF <input:projectId> is "none" → SAVE: workspaceId = <input:workspaceId>; name = ""; canManage = "not checked"; owners = "none"; go to step 3.
2. CALL {{tool:get_project}} {"projectId":"<input:projectId>"} [A]
   SAVE: name = result.name; workspaceId = result.workspaceId; canManage = result.access.canManage; owners = result.ownerId plus the userId of each item of result.governanceAssignments with role "project-owner"
   IF <saved:workspaceId> is empty → go to Answer.
3. CALL {{tool:get_workspace}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error → STOP. Say: "You cannot read workspace <saved:workspaceId> (<error text>). Ask the person who invited you; project owners: <saved:owners>."
   SAVE: workspaceOwner = result.ownerId
4. CALL {{tool:list_workspace_members}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error → SAVE: admins = "not readable with this connection"; go to Answer.
   SAVE: admins = userEmail and role of each item with role "owner" or "admin" and status "active"
   Name only these people; never list other members, emails or rates.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId> <saved:name> | workspace <saved:workspaceId>
Done: read-only; access.canManage <saved:canManage>
Evidence: project owner and project-owner role: <saved:owners>; workspace ownerId <saved:workspaceOwner>; workspace owner/admin: <saved:admins>
Pending: one of them grants you the role or membership you need
Next: <the STOP text that ended the run | ask <saved:workspaceOwner> or a listed admin; membership changes belong to skill lpm-workspace-admin>
```
role: owner | admin | member | viewer, from step 4; only owner and admin can manage. Never claim a person that steps 2–4 did not return.
