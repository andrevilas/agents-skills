# Playbook: rollback
Use when: put the previous code index version back
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id)" |
| repository | the user: `https://github.com/<owner>/<repo>` or a workspace repository link id | STOP. Say: "Which repository? (https://github.com/<owner>/<repo> or link id)" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. The active code index was not changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "A rollback needs an LPM API key (profile full or custom) of a workspace owner or admin; this connector cannot do it."
2. CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: linkId = id of the item whose id == <input:repository> or whose canonicalRepositoryUrl == <input:repository> in lower case without a trailing ".git"; url = that item's canonicalRepositoryUrl
   IF no item matches → STOP. Say: "<input:repository> has no active workspace repository link, so it has no code index to roll back."
3. CALL {{tool:get_repository_index_status}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>"} [A]
   IF result.pointer is null → STOP. Say: "<saved:url> was never indexed; there is nothing to roll back."
   SAVE: generation = result.pointer.generation; activeId = result.pointer.activeIndexVersionId; previousId = result.pointer.previousIndexVersionId (empty when null); oldCommit = result.pointer.expectedRepositoryCommitSha; previousCommit = the commitSha of the item of result.versions with id == <saved:previousId>
   IF <saved:previousId> is empty → STOP. Say: "<saved:url> has no previous index version, so a rollback is impossible. A new build is possible with playbook refresh."
4. ASK: "Roll back the code index of <saved:url> from version <saved:activeId> (commit <saved:oldCommit>) to the older version <saved:previousId> (commit <saved:previousCommit>)? Code search and the Advisor will show the older code. Call: rollback_repository_code_index(workspaceId=<input:workspaceId>, repositoryLinkId=<saved:linkId>, expectedGeneration=<saved:generation>) (yes/no)" — continue only if the user says yes; otherwise STOP.
   A yes the user already wrote for this rollback ("I confirm", "confirmo") counts: continue without asking.
5. CALL {{tool:rollback_repository_code_index}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>","expectedGeneration":"<saved:generation>"} [C] (send <saved:generation> as a JSON number: 4, not "4")
   Send it once. A second rollback swaps back to the version you just replaced; never re-send it, even after an error.
   IF the call returns an error that contains "content is unavailable" → STOP. Say: "Version <saved:previousId> was purged, so it cannot come back. A new build is possible with playbook refresh."
   VERIFY: CALL {{tool:get_repository_index_status}} {"workspaceId":"<input:workspaceId>","repositoryLinkId":"<saved:linkId>"} [A]
   IF the call returns an error or result.pointer.activeIndexVersionId != <saved:previousId> → STOP. Say: "The rollback is not confirmed: the active version is <result.pointer.activeIndexVersionId>. I did not re-send it."
   SAVE: newGeneration = result.pointer.generation; activeCommit = result.pointer.expectedRepositoryCommitSha

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <saved:url> (link <saved:linkId>)
Done: <rolled back to <saved:previousId> at <saved:activeCommit>, generation <saved:generation> -> <saved:newGeneration>; state after: stale | nothing changed>
Evidence: <active <saved:previousId> read after the rollback; replaced version <saved:activeId> (commit <saved:oldCommit>) is now the previous version | none>
Pending: <none | the index shows older code until the next build — GitHub push, daily job or playbook refresh>
Next: <the ASK or STOP text that ended the run | none — rollback done; do not roll back again (it would re-activate <saved:activeId>)>
```
state after a rollback: stale (the restored version covers an older commit). Never claim an active version or generation that step 5's VERIFY did not read.
