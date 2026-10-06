# Playbook: check
Use when: is the code index current, stale or missing; no_active_index
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id)" |
| repository | the user: `https://github.com/<owner>/<repo>`, a workspace repository link id, or "all" | "all" |
| projectId | the project whose question or Advisor answer showed no_active_index | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Index check incomplete: <tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Index freshness needs an LPM API key. On this connector I can only list the repository links; their lastScanAt is a metadata scan, not the code index."
2. CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>","includeArchived":true} [A]
   IF <input:repository> == "all" → go to step 6.
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git", and whose archivedAt is empty; url = its canonicalRepositoryUrl; hidden = its agentVisible == false; mappings = its projectMappings; creator = its credentialOwnerId; scanCommit = its lastKnownCommit; scanAt = its lastScanAt
   IF no item matches → STOP. Say: "<input:repository> has no active workspace repository link, so no agent can search its code (that is what no_active_index means). Link it with playbook link? (yes/no)"
   IF <saved:hidden> is true → STOP. Say: "Link <saved:linkId> is hidden from agents (agentVisible false), so code search skips it. Make it visible with playbook change-link? (yes/no)"
3. IF <input:projectId> is not "none" and no item of <saved:mappings> has projectId == <input:projectId> with agentVisible not false → STOP. Say: "<saved:url> is not mapped to project <input:projectId>, so code search and the Advisor for that project see nothing (no_active_index). Add the mapping with playbook change-link? (yes/no)"
4. CALL {{tool:reconcile_workspace_code_indexes}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>"} [A]
   IF the call returns an error that contains "permission" → go to step 5.
   IF the call returns an error that contains "Private" or "non-public" → STOP. Say: "LPM cannot read <saved:url> on GitHub. The link creator (credentialOwnerId <saved:creator>) needs a personal GitHub credential in LPM, or an LPM admin must install the GitHub App."
   IF the call returns an error → STOP. Say: "Index check incomplete: reconcile_workspace_code_indexes failed: <error text>."
   SAVE: state, indexedCommitSha, repositoryCommitSha = those fields of the item of result.results with repositoryLinkId == <saved:linkId> (no such item → state = "not checked")
   VERIFY: CALL {{tool:get_repository_index_status}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>"} [A]
   IF the call returns an error or result.pointer.expectedRepositoryCommitSha (empty when pointer is null) != <saved:indexedCommitSha> (empty when null) → STOP. Say: "The index of <saved:url> changed during the check. Run this playbook again."
   SAVE: activeId = result.pointer.activeIndexVersionId ("none" when pointer is null); generation = result.pointer.generation (0 when pointer is null); go to Answer.
5. CALL {{tool:get_repository_index_status}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>"} [A]
   SAVE: activeId = result.pointer.activeIndexVersionId ("none" when pointer is null); indexedCommitSha = result.pointer.expectedRepositoryCommitSha ("none" when pointer is null); repositoryCommitSha = "<saved:scanCommit> (scan of <saved:scanAt>)"; state = "missing" when pointer is null, else "indicative only: no owner/admin right to compare with GitHub"; go to Answer.
6. CALL {{tool:reconcile_workspace_code_indexes}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error that contains "permission" → STOP. Say: "Only a workspace owner or admin can check every repository. Name one repository and I will read its index."
   IF the call returns an error → STOP. Say: "Index check incomplete: one repository failed, so the whole check failed (<error text>). Name one repository to check it alone."
   SAVE: results = one line per item of result.results: "<repositoryUrl>: <state> (indexed <indexedCommitSha>, branch head <repositoryCommitSha>)"; checkedIds = the repositoryLinkId of each item of result.results
   VERIFY: CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or result is empty → STOP. Say: "Index check incomplete: the workspace has no active repository link to check."
   SAVE: notChecked = canonicalRepositoryUrl of each item of result whose id is not in <saved:checkedIds> (hidden from agents, or beyond the first 25 links)

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <saved:url> (link <saved:linkId>) | <input:workspaceId> / all repository links
Done: read-only check, nothing changed; state <saved:state> | read-only check, nothing changed
Evidence: indexed <saved:indexedCommitSha>, branch head <saved:repositoryCommitSha>, active version <saved:activeId>, generation <saved:generation> | <each line of <saved:results>> | none
Pending: <none | not checked: <saved:notChecked> | owner/admin must confirm freshness — read with an owner/admin key>
Next: <the ASK or STOP text that ended the run | none — index current; GitHub pushes and the daily job keep it fresh | refresh <url> with playbook refresh (state stale or missing) — the daily job also refreshes it>
```
state: missing | stale | current, from reconcile_workspace_code_indexes. Never claim "current" for a repository that reconcile did not return with state current; lastScanAt and lastKnownCommit are never index freshness.
