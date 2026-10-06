# Playbook: fix-comment-or-attachment
Use when: edit or remove a comment, or remove an attachment
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity` | STOP. Say: "Which LPM activity? (id or title)" |
| target | the comment (id or quoted text) or the attachment (file name or id) the user named | STOP. Say: "Which comment or file exactly? (id, text or file name)" |
| change | "remove", or "edit" for a comment | STOP. Say: "Remove it, or replace its text?" |
| newText | the full new comment text, only for "edit" | STOP. Say: "What is the new text?" |
| workspaceId | the user, or step 2 | step 2 |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was removed or changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Editing or removing comments and files needs an LPM API key (profile full or custom). Use the LPM web UI."
2. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: title = result.title; status = result.status; workspaceId = result.workspaceId, else <input:workspaceId>
   IF <input:target> is a file name or an attachment id → go to step 8.
3. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: commentId = id of the item whose id == <input:target>, or of the only item whose content contains <input:target>
   IF no item or 2+ items match → STOP. Say: "Which comment exactly? <each id with its first 60 characters>"
   SAVE: author = that item's authorId; old = its first 80 characters
   IF <input:change> == "edit" → go to step 6.
4. ASK: "Remove comment <saved:commentId> by <saved:author> ("<saved:old>") from <input:issueId>? It cannot be restored. (yes/no)" — continue only if the user says yes; otherwise STOP.
5. CALL {{tool:delete_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","commentId":"<saved:commentId>"} [C]
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or an item still has id == <saved:commentId> → STOP. Say: "Comment <saved:commentId> is still listed."
   SAVE: outcome = "comment <saved:commentId> removed"; go to Answer.
6. ASK: "Replace the text of comment <saved:commentId> by <saved:author> with: "<input:newText>"? The old text cannot be restored. (yes/no)" — continue only if the user says yes; otherwise STOP.
7. CALL {{tool:update_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","commentId":"<saved:commentId>","content":"<input:newText>"} [C]
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or item <saved:commentId> does not have the content <input:newText> → STOP. Say: "Comment <saved:commentId> does not show the new text."
   SAVE: outcome = "comment <saved:commentId> edited"; go to Answer.
8. CALL {{tool:list_workspace_activities}} {"workspaceId":"<saved:workspaceId>","projectId":"<input:projectId>","limit":200} [A]
   SAVE: activityId = id of the FIRST item with targetType "issue" and targetId == <input:issueId> (never the issueId)
   IF no item matches → STOP. Say: "<input:issueId> has no feed entry, so it has no attachments."
9. CALL {{tool:list_activity_attachments}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>"} [A]
   SAVE: attachmentId = id of the item whose id or fileName == <input:target>; fileName = its fileName; itemActivityId = its activityId (delete with THIS one)
   IF no item or 2+ items match → STOP. Say: "Which file exactly? <each fileName (id)>"
10. ASK: "Remove <saved:fileName> (id <saved:attachmentId>) from <input:issueId>? It cannot be restored. (yes/no)" — continue only if the user says yes; otherwise STOP.
11. CALL {{tool:delete_activity_attachment}} {"projectId":"<input:projectId>","activityId":"<saved:itemActivityId>","attachmentId":"<saved:attachmentId>"} [C]
   IF the call returns an error → STOP. Say: "Not removed: <error text>. Only the uploader or a project manager can remove it."
   VERIFY: CALL {{tool:list_activity_attachments}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>"} [A]
   IF the call returns an error or an item still has id == <saved:attachmentId> → STOP. Say: "<saved:fileName> is still listed."
   SAVE: outcome = "<saved:fileName> (id <saved:attachmentId>) removed"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<input:issueId> <saved:title>
Done: <saved:outcome> | nothing changed; status <saved:status>
Evidence: <the VERIFY that showed it: "list_comments" or "list_activity_attachments on <saved:activityId>"> | none
Pending: none | <what is still wrong> — <who must act>
Next: <the ASK or STOP text that ended the run | none | attach the right file with playbook evidence (when a file was removed)>
```
status: backlog | todo | in-progress | done | canceled, from step 2. Never claim a removal or an edit that its VERIFY did not show.
