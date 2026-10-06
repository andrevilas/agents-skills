# Playbook: change-link
Use when: change branch or project mappings, or unhide a link
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id)" |
| repository | the user: `https://github.com/<owner>/<repo>` or a repository link id | STOP. Say: "Which repository? (https://github.com/<owner>/<repo> or link id)" |
| level | "project" when the link belongs to one project (list_project_repository_links), else "workspace" | "workspace" |
| projectId | the project to map, unmap, or that owns a project link | "none"; level "project" → STOP. Say: "Which LPM project? (id)" |
| mapping | "add" or "remove" <input:projectId> from the workspace link's mappings, or "keep" | "keep" |
| repositoryPath | the folder of <input:projectId> inside the repository | "" (whole repository) |
| branch | the new default branch the user named, or "keep" | "keep" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. The link was not changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Changing a repository link needs an LPM API key (profile full or custom); this connector cannot do it."
2. IF <input:level> == "project" → go to step 6.
3. CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git"; url = its canonicalRepositoryUrl; oldBranch = its defaultBranch ("" when null); oldVisible = its agentVisible; oldMappings = its projectMappings, the whole array exactly as listed
   IF no item matches → STOP. Say: "<input:repository> has no active workspace link (an archived link cannot be edited). Link it again with playbook link (new id, no index)."
   SAVE: newBranch = <saved:oldBranch> when <input:branch> == "keep", else <input:branch>
   SAVE: newMappings = <saved:oldMappings> with these changes only: mapping "add" → if an item has projectId == <input:projectId>, set its agentVisible true and its repositoryPath to <input:repositoryPath>; else append {"projectId":"<input:projectId>","repositoryPath":"<input:repositoryPath>"}; mapping "remove" → drop the item with projectId == <input:projectId>; "keep" → no change
4. ASK: "Change workspace link <saved:linkId> (<saved:url>)? defaultBranch: "<saved:oldBranch>" → "<saved:newBranch>"; agentVisible: <saved:oldVisible> → true; projectMappings now: <saved:oldMappings> → after: <saved:newMappings> (the array is replaced as a whole). Call: update_workspace_repository_link(workspaceId=<input:workspaceId>, repositoryLinkId=<saved:linkId>, defaultBranch=<saved:newBranch>, agentVisible=true, projectMappings=<saved:newMappings>) (yes/no)" — continue only if the user says yes; otherwise STOP.
5. CALL {{tool:update_workspace_repository_link}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>","defaultBranch":"<saved:newBranch>","agentVisible":true,"projectMappings":"<saved:newMappings>"} [C] (send <saved:newMappings> as a JSON array, not as a string)
   VERIFY: CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or item <saved:linkId> has another defaultBranch (null equals ""), agentVisible false, or misses a projectId of <saved:newMappings> → STOP. Say: "Link <saved:linkId> does not show the change; check its projectMappings in the LPM web app."
   SAVE: kept = the projectMappings of item <saved:linkId>; go to Answer.
6. CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git"; url = its canonicalRepositoryUrl; oldBranch = its defaultBranch ("" when null); oldVisible = its agentVisible
   IF no item matches → STOP. Say: "<input:repository> has no active link in project <input:projectId>."
   SAVE: newBranch = <saved:oldBranch> when <input:branch> == "keep", else <input:branch>
7. ASK: "Change project link <saved:linkId> (<saved:url>) of <input:projectId>? defaultBranch: "<saved:oldBranch>" → "<saved:newBranch>"; agentVisible: <saved:oldVisible> → true. Call: update_project_repository_link(projectId=<input:projectId>, repositoryLinkId=<saved:linkId>, defaultBranch=<saved:newBranch>, agentVisible=true) (yes/no)" — continue only if the user says yes; otherwise STOP.
8. CALL {{tool:update_project_repository_link}} {"projectId":"<input:projectId>","repositoryLinkId":"<saved:linkId>","defaultBranch":"<saved:newBranch>","agentVisible":true} [C]
   VERIFY: CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or item <saved:linkId> has another defaultBranch (null equals "") or agentVisible false → STOP. Say: "Project link <saved:linkId> does not show the change."
   SAVE: kept = "none (project link)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <saved:url> (<input:level> link <saved:linkId>)
Done: <changed link <saved:linkId>: defaultBranch <saved:newBranch>, agentVisible true | nothing changed>
Evidence: <listed after the change; projectMappings <saved:kept> | none>
Pending: <none | a new branch is not indexed yet — playbook refresh>
Next: <the ASK or STOP text that ended the run | none — mapping changes reach code search at once | build the index of the new branch with playbook refresh>
```
Never claim a change that the VERIFY above did not list; to hide or archive a link use playbook unlink.
