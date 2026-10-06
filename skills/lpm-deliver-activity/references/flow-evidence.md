# Playbook: evidence
Use when: attach a screenshot, log or test report
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity` | STOP. Say: "Which LPM activity? (id or title)" |
| workspaceId | the user, or step 3 | step 3 |
| fileName | the user or your test run; ≤ 180 characters, no "/" | STOP. Say: "Which file should I attach?" |
| fileType | "image/png", "image/jpeg", "text/plain" or "application/pdf" | STOP. Say: "What type is <input:fileName>?" |
| contentBase64 | the file as base64, no "data:" prefix, ≤ 10 MiB | file over 10 MiB → use fileUrl |
| fileUrl | a URL without tokens, only for a file over 10 MiB | "none" |
| description | what the file proves, in the user's words | use <input:fileName> |
| capturedAt | the time the user gave, ISO 8601 UTC | the current UTC time; keep it for a retry |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Evidence not attached: <tool> failed: <error text>."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → switch to playbook connector-only.
2. SAVE: stamp = <input:capturedAt> as yyyymmddHHMM (e.g. 202610061000)
   IF the file or its name shows a password, API key, token, `.env` text or personal data → STOP. Say: "<input:fileName> holds a secret or personal data. Redact it first; nothing was uploaded."
3. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: title = result.title; status = result.status; workspaceId = result.workspaceId, else <input:workspaceId>
   IF <saved:workspaceId> is empty → STOP. Say: "Which LPM workspace is <input:issueId> in?"
4. CALL {{tool:list_workspace_activities}} {"workspaceId":"<saved:workspaceId>","projectId":"<input:projectId>","limit":200} [A]
   SAVE: activityId = id of the FIRST item with targetType "issue" and targetId == <input:issueId>. Never use the issueId as activityId.
   IF an activityId was saved → go to step 7.
5. CALL {{tool:create_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","content":"Evidence follows.","idempotencyKey":"ev-anchor-<input:issueId>-<saved:stamp>"} [A]
   SAVE: anchorId = the id in "Comment created with ID: <id>"
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or no item has id == <saved:anchorId> → STOP. Say: "The anchor comment is not listed; nothing was uploaded."
6. CALL {{tool:list_workspace_activities}} {"workspaceId":"<saved:workspaceId>","projectId":"<input:projectId>","limit":200} [A]
   SAVE: activityId = id of the FIRST item with targetType "issue" and targetId == <input:issueId>
   IF no item matches → STOP. Say: "<input:issueId> has no feed entry, so nothing can be attached. Use the LPM web UI."
7. CALL {{tool:list_activity_attachments}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>"} [A]
   Always make this call before any upload, even for a new file.
   IF an item has fileName == <input:fileName> → SAVE: attachmentId = that item's id; go to Answer.
8. SAVE: safeName = <input:fileName> with every character outside A-Z a-z 0-9 _ - replaced by _; key = "ev-<input:issueId>-<saved:safeName>-<saved:stamp>", 16 to 128 characters (cut safeName when longer; never invent characters)
   IF <input:fileUrl> is not "none" → go to step 10.
9. CALL {{tool:upload_activity_attachment}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>","fileName":"<input:fileName>","fileType":"<input:fileType>","contentBase64":"<input:contentBase64>","description":"<input:description>","capturedAt":"<input:capturedAt>","idempotencyKey":"<saved:key>"} [A]
   IF the call returns an error → STOP. Say: "Upload failed: <error text>. Check: base64 valid and ≤ 10 MiB, fileName without "/", fileType like image/png. Run this playbook again: it checks for the file before uploading."
   SAVE: attachmentId = the id in "Activity attachment uploaded with ID: <id>"
   VERIFY: CALL {{tool:list_activity_attachments}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>"} [A]
   IF the call returns an error or no item has id == <saved:attachmentId> → STOP. Say: "Attachment <saved:attachmentId> is not listed yet; do not upload again, check it in LPM."
   GO TO Answer
10. CALL {{tool:create_activity_attachment}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>","fileName":"<input:fileName>","fileType":"<input:fileType>","fileUrl":"<input:fileUrl>","description":"<input:description>","capturedAt":"<input:capturedAt>"} [A]
   IF the call returns an error → STOP. Say: "Registering the URL failed: <error text>. Run this playbook again: it lists the files first, because every call adds one."
   SAVE: attachmentId = the id in "Activity attachment created with ID: <id>"
   VERIFY: CALL {{tool:list_activity_attachments}} {"projectId":"<input:projectId>","activityId":"<saved:activityId>"} [A]
   IF the call returns an error or no item has id == <saved:attachmentId> → STOP. Say: "Attachment <saved:attachmentId> is not listed; do not register it again, check it in LPM."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<input:issueId> <saved:title>
Done: <attachment <saved:attachmentId> on feed entry <saved:activityId> | already attached as <saved:attachmentId>, no upload | nothing attached>; status <saved:status>
Evidence: <input:fileName> (id <saved:attachmentId>) on <saved:activityId> proves <input:description> | none
Pending: none | <the proof still missing> — <who must provide it>
Next: <the STOP text that ended the run | run playbook close to check the acceptance criteria>
```
status: backlog | todo | in-progress | done | canceled, from step 3; attaching never changes it. Never claim a file is attached unless a VERIFY or step 7 listed its id.
