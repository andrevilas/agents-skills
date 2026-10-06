# Playbook: add-portfolio-link
Use when: X waits for U in another workspace
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the project of X: the user, or lpm-start | STOP. Say: "Which LPM project? (id)" |
| workspaceId | the workspace of X: the user, or lpm-start | STOP. Say: "Which LPM workspace? (id)" |
| x | the activity that waits: its id or its exact title | STOP. Say: "Which activity is waiting? (id or exact title)" |
| otherWorkspaceId | the workspace of U: the user | STOP. Say: "Which workspace holds the activity that must finish first? (id)" |
| upId | the project of U: the user | STOP. Say: "Which project of <input:otherWorkspaceId> holds it? (id)" |
| u | the activity that must finish first: its id or its exact title | STOP. Say: "Which activity must finish first? (id or exact title)" |
| summary | the user's text for both workspaces, ≤ 240 characters | "none" (step 6 writes one) |
| date | today's UTC date as yyyy-mm-dd | — |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing more was written."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Links between workspaces need an LPM API key. Nothing was linked."
   IF <input:otherWorkspaceId> == <input:workspaceId> → switch to playbook add-cross-project-link.
2. CALL {{tool:list_issues}} {"projectId":"<input:projectId>","limitCount":100} [A]
   SAVE: xid = id of the item whose id == <input:x>, else of the only item whose title == <input:x>, else <input:x> when result.nextCursor is not empty
   IF <saved:xid> is empty → STOP. Say: "Which activity is '<input:x>'? Send its id."
3. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<saved:xid>"} [A]
   IF the call returns an error → STOP. Say: "<saved:xid> is not an activity of <input:projectId>. Send its id."
   SAVE: xTitle = result.title; old = result.blockerContext.content when result.blockerContext.status == "active", else empty
   IF result.isDeleted == true or result.status is "done" or "canceled" → STOP. Say: "<saved:xid> is <result.status>, not an open activity. Nothing was linked."
4. CALL {{tool:list_issues}} {"projectId":"<input:upId>","limitCount":100} [A]
   IF the call returns an error → STOP. Say: "Cannot read <input:upId>: <error text>. You need read access to both workspaces."
   SAVE: uid = id of the item whose id == <input:u>, else of the only item whose title == <input:u>, else <input:u> when result.nextCursor is not empty
   IF <saved:uid> is empty → STOP. Say: "Which activity is '<input:u>' in <input:upId>? Send its id."
5. CALL {{tool:get_issue}} {"projectId":"<input:upId>","issueId":"<saved:uid>"} [A]
   IF the call returns an error → STOP. Say: "<saved:uid> is not an activity of <input:upId>. Send its id."
   SAVE: uTitle = result.title; uStatus = result.status
   IF result.isDeleted == true or <saved:uStatus> is "done" or "canceled" → STOP. Say: "<saved:uid> is already <saved:uStatus>, so it blocks nothing. Nothing was linked."
6. CALL {{tool:list_portfolio_work_item_links}} {"workspaceId":"<input:workspaceId>","projectId":"<input:projectId>","status":"active"} [A]
   Always make this call before creating: the server does not check duplicates.
   IF an item has type "blocks", source.issueId == <saved:uid> and target.issueId == <saved:xid> → SAVE: linkId = that item's id; outcome = "already linked, nothing created"; go to step 9.
   IF an item has type "blocks" with source.issueId == <saved:xid> and target.issueId == <saved:uid> → STOP. Say: "Link <that item's id> says <saved:xid> blocks <saved:uid>. Which must finish first? Nothing was linked."
   SAVE: text = <input:summary>, else "<saved:uTitle> blocks <saved:xTitle>", cut to 240 characters
7. ASK: "Link <saved:uid> (<input:otherWorkspaceId>) blocks <saved:xid>, with the summary '<saved:text>' visible to both workspaces? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was linked. Send the summary you want."
8. CALL {{tool:create_portfolio_work_item_link}} {"source":{"workspaceId":"<input:otherWorkspaceId>","projectId":"<input:upId>","issueId":"<saved:uid>","visibleSummary":"<saved:text>"},"target":{"workspaceId":"<input:workspaceId>","projectId":"<input:projectId>","issueId":"<saved:xid>","visibleSummary":"<saved:text>"},"type":"blocks","rationale":"<saved:xid> waits for <saved:uid>"} [C] (no idempotencyKey: this tool has none)
   IF the call returns an error → STOP. Say: "Not linked: <error text>. Run this playbook again; it lists links first."
   SAVE: linkId = the id in "Portfolio work item link created with ID: <id>"; outcome = "created"
   VERIFY: CALL {{tool:list_portfolio_work_item_links}} {"workspaceId":"<input:workspaceId>","projectId":"<input:projectId>","status":"active"} [A]
   IF the call returns an error or no item has id == <saved:linkId> → STOP. Say: "Link <saved:linkId> is not listed. Do not create it again."
9. SAVE: context = "Blocked by portfolio link <saved:linkId>: <saved:uid> in <input:otherWorkspaceId> — owner of <saved:uid> — since <input:date>"
   IF <saved:old> contains <saved:linkId> → SAVE: context = <saved:old>; go to Answer.
   IF <saved:old> is not empty → SAVE: context = "<saved:old> | <saved:context>"; go to step 10.
   Always set this context: portfolio links never reach the blocked list, graph or summary.
10. CALL {{tool:set_project_issue_blocker_context}} {"projectId":"<input:projectId>","issueId":"<saved:xid>","blockerContext":"<saved:context>"} [A]
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<saved:xid>"} [A]
   IF the call returns an error or result.blockerContext.status != "active" or result.blockerContext.content does not contain <saved:linkId> → STOP. Say: "Link <saved:linkId> exists; the blocker context of <saved:xid> does not name it."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<input:projectId>/<saved:xid> <saved:xTitle>
Done: <portfolio link <saved:linkId>: <saved:uid> (<input:otherWorkspaceId>) blocks <saved:xid>, <saved:outcome>; blocker context "<saved:context>" | nothing linked>
Evidence: <list_portfolio_work_item_links → <saved:linkId> active; get_issue → blockerContext active | none>
Pending: <none | the STOP text>
Next: <the ASK or STOP text that ended the run | when <saved:uid> is done, run playbook close-portfolio-link>
```
uStatus: backlog | todo | in-progress, from step 5. The summary is seen by both workspaces: nothing confidential. Never claim a link or context that a VERIFY did not show.
