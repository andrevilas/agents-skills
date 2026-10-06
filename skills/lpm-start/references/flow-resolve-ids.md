# Playbook: resolve-ids
Use when: a workspaceId or projectId is unknown, or "what is the id of project <name>?"
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user (an id, not a name) | "none" |
| workspaceId | the user (an id, not a name) | "none" |
| projectName | the project name or key the user wrote | "none" |
| workspaceName | the workspace name the user wrote | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. No id was resolved."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF the call returns an error → SAVE: credential = "agent_credential"; grant = ""; go to step 2.
   SAVE: credential = result.credential; grant = result.workspaceId (empty if null)
2. IF <input:projectId> is not "none" → SAVE: projectId = <input:projectId>; go to step 8.
   IF <input:projectName> is "none" and <input:workspaceName> is "none" and <input:workspaceId> is "none" and <saved:grant> is empty → STOP. Say: "Which LPM project or workspace? (name, key or id)"
3. IF <input:workspaceId> is not "none" → SAVE: workspaceId = <input:workspaceId>; go to step 6.
   IF <saved:grant> is not empty → SAVE: workspaceId = <saved:grant>; go to step 6.
   IF <saved:credential> == "agent_credential" → go to step 5.
   IF <saved:credential> == "api_key" and <input:workspaceName> is "none" → go to step 5.
4. CALL {{tool:list_workspaces}} {"compact":true} [A]
   SAVE: found = the items whose name contains <input:workspaceName>, ignoring case and accents (every item when workspaceName is "none"); an item whose name equals <input:workspaceName> exactly wins alone
   IF <saved:found> is empty → STOP. Say: "No workspace named <input:workspaceName> is visible to this connection. Which workspace? (name or id)"
   IF <saved:found> has 2 or more items → STOP. Say: "Which workspace: <name (id) of each item of <saved:found>>?"
   SAVE: workspaceId = the id of the one item of <saved:found>; go to step 6.
5. CALL {{tool:list_projects}} {} [A]
   Use this call only for an lpm_mcp_ agent credential (its own workspace) or an API key with no workspace named (every project you can see).
   SAVE: projects = result; workspaceId = ""; go to step 7.
6. CALL {{tool:list_projects}} {"workspaceId":"<saved:workspaceId>","includeArchived":true} [A]
   IF the call returns an error → STOP. Say: "Projects of workspace <saved:workspaceId> could not be listed: <error text>. Check the workspace id, or ask its owner for access."
   SAVE: projects = result
7. IF <input:projectName> is "none" → go to Answer.
   SAVE: found = the items of <saved:projects> whose name or key contains <input:projectName>, ignoring case and accents; an item whose name or key equals <input:projectName> exactly wins alone
   IF <saved:found> is empty → STOP. Say: "No project named <input:projectName> is visible here. Which project? (name, key or id)"
   IF <saved:found> has 2 or more items → STOP. Say: "Which project: <name (key, id) of each item of <saved:found>>?"
   SAVE: projectId = the id of the one item of <saved:found>
8. CALL {{tool:get_project}} {"projectId":"<saved:projectId>"} [A]
   IF the call returns an error → STOP. Say: "get_project failed for <saved:projectId>: <error text>. Use the id from list_projects; if it says not authorized, ask me to check the connection."
   SAVE: name, key, archived = those fields of result; projectWorkspace = result.workspaceId; canManage = result.access.canManage
   IF <input:workspaceId> is not "none" and <input:workspaceId> != <saved:projectWorkspace> → STOP. Say: "Project <saved:projectId> belongs to workspace <saved:projectWorkspace>, not <input:workspaceId>. Which one did you mean?"
   IF <saved:archived> == true → ASK: "<saved:name> (<saved:key>) is archived. Use it anyway? (yes/no)" — continue only if the user says yes; otherwise STOP.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:projectWorkspace>/<saved:projectId> <saved:name> (<saved:key>) | workspace <saved:workspaceId> | none
Done: read-only; ids resolved: workspaceId <saved:projectWorkspace> | <saved:workspaceId>, projectId <saved:projectId> | none
Evidence: get_project → workspaceId <saved:projectWorkspace>, archived <saved:archived>, access.canManage <saved:canManage> | list_projects → <name (key, id) of each item of <saved:projects>>
Pending: none | you cannot manage this project (canManage false): ask me who can manage it
Next: <the ASK or STOP text that ended the run | continue the original request with these ids>
```
archived: true | false; canManage: true | false, from step 8. Never claim an id that a step above did not return.
