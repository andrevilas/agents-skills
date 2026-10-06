# Playbook: comment
Use when: comment on a change request
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| changeRequestId | the user, or the request list | STOP. Say: "Which change request? (id)" |
| content | the comment text, 1 to 20,000 characters | STOP. Say: "What should the comment say?" |
| stamp | the current UTC time as yyyymmddHHMMss | the current UTC time |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. No comment was added."
1. IF the user asked to approve, reject or request changes → switch to playbook review.
2. CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   SAVE: status = result.status; key = "crc-<input:changeRequestId>-<input:stamp>"
3. CALL {{tool:comment_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>","content":"<input:content>","idempotencyKey":"<saved:key>"} [A]
   IF the call returns an error → STOP. Say: "Comment not added: <error text>. Text over 20,000 characters: split it into several comments, each with a new stamp."
   SAVE: commentId = result.id
   VERIFY: CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   IF the call returns an error or no comments[] item has id == <saved:commentId> → STOP. Say: "Comment <saved:commentId> is not listed on <input:changeRequestId>."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<input:changeRequestId> (status <saved:status>)
Done: comment <saved:commentId> added | nothing added
Evidence: get_workspace_roadmap_change_request → comments[] has <saved:commentId> | none
Pending: none
Next: <the ASK or STOP text that ended the run> | none
```
status: awaiting-review | changes-requested | approved | rejected | stale | applied | withdrawn, from step 2. A comment is never a review decision and cannot be edited or deleted. Never claim a comment that the VERIFY did not list.
