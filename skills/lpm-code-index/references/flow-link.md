# Playbook: link
Use when: link a new GitHub repository to the workspace or a project
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id)" |
| repositoryUrl | the user, exactly `https://github.com/<owner>/<repo>` | STOP. Say: "Which repository? (https://github.com/<owner>/<repo>)" |
| level | "project" only when the user wants metadata only, or is not a workspace owner/admin; code search and the Advisor need "workspace" | "workspace" |
| projectId | the project that will see this repository (more projects later with playbook change-link) | STOP. Say: "Which LPM project uses this repository? (id)" |
| repositoryPath | the folder of that project inside the repository | "" (whole repository) |
| branch | the branch the user named | "" (repository default) |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. No link was created."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Linking a repository needs an LPM API key (profile full or custom); this connector cannot do it."
2. CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: wsLinkId = id of the item whose canonicalRepositoryUrl == <input:repositoryUrl> in lower case without a trailing ".git" (empty if none)
   IF <saved:wsLinkId> is not empty → STOP. Say: "<input:repositoryUrl> is already linked to the workspace as <saved:wsLinkId>. Change it with playbook change-link; a second link is never created."
3. CALL {{tool:get_workspace_repository_context}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: access = "GitHub App" when result.connector.status == "configured", else "your personal GitHub credential" when result.userCredential is not null, else "none — a private repository cannot be scanned or indexed until you add a personal GitHub credential in the LPM web app or an LPM admin installs the GitHub App (the workspace GitHub token does not enable indexing)"
   IF <input:level> == "project" → go to step 6.
4. ASK: "Link <input:repositoryUrl> to workspace <input:workspaceId> (branch <input:branch>; project mapping {"projectId":"<input:projectId>","repositoryPath":"<input:repositoryPath>"})? You become its credential owner; GitHub access: <saved:access>. Call: create_workspace_repository_link(workspaceId=<input:workspaceId>, repositoryUrl=<input:repositoryUrl>, defaultBranch=<input:branch>, projectMappings=[that mapping]) (yes/no)" — continue only if the user says yes; otherwise STOP.
5. CALL {{tool:create_workspace_repository_link}} {"workspaceId":"<input:workspaceId>","repositoryUrl":"<input:repositoryUrl>","defaultBranch":"<input:branch>","projectMappings":[{"projectId":"<input:projectId>","repositoryPath":"<input:repositoryPath>"}]} [C]
   IF the call returns an error that contains "permission" or the error is JSON-RPC -32003 → STOP. Say: "Only a workspace owner or admin with a full or custom API key can link at workspace level. Ask one, or link it to one project for metadata only (no code search)."
   SAVE: linkId = result.id
   VERIFY: CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or no item has id == <saved:linkId> with canonicalRepositoryUrl == <input:repositoryUrl> in lower case → STOP. Say: "Link <saved:linkId> is not listed; it was not confirmed."
   SAVE: kept = the projectMappings of that item; go to Answer.
6. CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   IF an item has canonicalRepositoryUrl == <input:repositoryUrl> in lower case without a trailing ".git" → STOP. Say: "<input:repositoryUrl> is already linked to project <input:projectId>. Change it with playbook change-link."
7. ASK: "Link <input:repositoryUrl> to project <input:projectId> for metadata only (branch <input:branch>)? It never gets a code index or code search. GitHub access: <saved:access>. Call: create_project_repository_link(projectId=<input:projectId>, repositoryUrl=<input:repositoryUrl>, defaultBranch=<input:branch>) (yes/no)" — continue only if the user says yes; otherwise STOP.
8. CALL {{tool:create_project_repository_link}} {"projectId":"<input:projectId>","repositoryUrl":"<input:repositoryUrl>","defaultBranch":"<input:branch>"} [C]
   SAVE: linkId = result.id
   VERIFY: CALL {{tool:list_project_repository_links}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or no item has id == <saved:linkId> → STOP. Say: "Link <saved:linkId> is not listed; it was not confirmed."
   SAVE: kept = "none (project link)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <input:repositoryUrl> (<input:level> link)
Done: <created <input:level> link <saved:linkId>; state after: missing (no code index yet) | nothing changed>
Evidence: <link <saved:linkId> listed with mappings <saved:kept>; GitHub access: <saved:access> | none>
Pending: <none | GitHub access for a private repository — the link creator or an LPM admin>
Next: <the ASK or STOP text that ended the run | scan it with playbook scan, then build the index with playbook refresh | scan it with playbook scan (a project link never gets a code index)>
```
state: missing | stale | current. Never claim a link, a scan or an index that a VERIFY above did not read; creating a link neither scans nor indexes.
