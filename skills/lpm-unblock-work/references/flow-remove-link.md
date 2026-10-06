# Playbook: remove-link
Use when: a link is wrong or dangling
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or lpm-start | STOP. Say: "Which LPM project? (id or name)" |
| workspaceId | the user, lpm-start, or step 3 | step 3 |
| x | an activity of the link: its id or its exact title | STOP. Say: "Which activity has the wrong link? (id or exact title)" |
| other | the other activity of the link: id, or words of its title the user used | "any" |
| linkId | the link id, when the user gave it | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was removed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Removing a link needs an LPM API key with profile full or custom. Nothing was removed."
2. CALL {{tool:list_issues}} {"projectId":"<input:projectId>","limitCount":100} [A]
   SAVE: titles = the id and title of every item; xid = id of the item whose id == <input:x>, else of the only item whose title == <input:x>, else <input:x>
3. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<saved:xid>"} [A]
   IF the call returns an error → SAVE: workspaceId = <input:workspaceId>; go to step 4.
   SAVE: workspaceId = result.workspaceId, else <input:workspaceId>
4. CALL {{tool:list_issue_links}} {"projectId":"<input:projectId>"} [A]
   SAVE: candidates = each item whose sourceIssueId or targetIssueId == <saved:xid>, kept only when (<input:other> == "any" or the other side's id equals <input:other> or its title in <saved:titles> contains <input:other>) and (<input:linkId> == "none" or its id == <input:linkId>); scope = "project"; line = "<id>: <sourceIssueId> "<title>" → <targetIssueId> "<title>" (<type>)", title from <saved:titles>, else "not found" (a dangling link)
   IF <saved:workspaceId> is empty → go to step 7.
5. CALL {{tool:list_workspace_issue_links}} {"workspaceId":"<saved:workspaceId>","targetProjectId":"<input:projectId>"} [A]
   SAVE: candidates = <saved:candidates> plus each item with targetIssueId == <saved:xid>, same filters; scope = "workspace"; line = "<id>: <sourceProjectId>/<sourceIssueId> → <targetIssueId> "<title>" (<type>)"
6. CALL {{tool:list_workspace_issue_links}} {"workspaceId":"<saved:workspaceId>","sourceProjectId":"<input:projectId>"} [A]
   SAVE: candidates = <saved:candidates> plus each item with sourceIssueId == <saved:xid>, same filters; scope = "workspace"; line = "<id>: <sourceIssueId> "<title>" → <targetProjectId>/<targetIssueId> (<type>)"
7. IF <saved:candidates> is empty → STOP. Say: "No link of <saved:xid> matches. Nothing was removed."
   IF <saved:candidates> has 2 or more items → STOP. Say: "Which link? <each candidate's line, one per line>"
   SAVE: linkId, scope, line = those of the only candidate
   IF <saved:scope> == "workspace" → go to step 10.
8. ASK: "Remove link <saved:line> from <input:projectId>? It cannot be undone. Call: delete_issue_link projectId=<input:projectId>, linkId=<saved:linkId>. (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was removed."
9. CALL {{tool:delete_issue_link}} {"projectId":"<input:projectId>","linkId":"<saved:linkId>"} [C]
   IF the call returns an error other than "Issue link not found" → STOP. Say: "Not removed: <error text>. Only a project manager with a full or custom API key can remove links."
   VERIFY: CALL {{tool:list_issue_links}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or an item still has id == <saved:linkId> → STOP. Say: "Link <saved:linkId> is still listed."
   SAVE: outcome = "removed"; go to step 12.
10. ASK: "Remove cross-project link <saved:line>? It cannot be undone. Call: delete_workspace_issue_link linkId=<saved:linkId>. (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was removed."
11. CALL {{tool:delete_workspace_issue_link}} {"linkId":"<saved:linkId>"} [C]
   IF the call returns an error other than "Workspace issue link not found" → STOP. Say: "Not removed: <error text>. Only a workspace owner or admin with a full or custom API key can remove it."
   VERIFY: CALL {{tool:list_workspace_issue_links}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error or an item still has id == <saved:linkId> → STOP. Say: "Link <saved:linkId> is still listed."
   SAVE: outcome = "removed"
12. CALL {{tool:list_blocked_project_issues}} {"projectId":"<input:projectId>","limitCount":100} [A]
   IF the call returns an error → SAVE: listed = "not checked (<error text>)"; go to Answer.
   SAVE: listed = the details of the item with id == <saved:xid>, else "not in the blocked list"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<saved:xid>
Done: <removed link <saved:line> | nothing removed>
Evidence: <list_issue_links or list_workspace_issue_links → <saved:linkId> absent; list_blocked_project_issues → <saved:xid>: <saved:listed> | none>
Pending: <none | <saved:xid> still blocked: <saved:listed> — the owner of that upstream activity>
Next: <the ASK or STOP text that ended the run | finish the upstream activity that step 12 still lists | none>
```
The blocked list shows same-project links only; a removed cross-project link changes the dependency summary, not this list. Never remove a link the user did not pick and confirm. Never claim an activity is unblocked unless step 12 no longer lists it.
