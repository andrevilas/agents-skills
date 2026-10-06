# Playbook: pack
Use when: collect, export and attach the execution pack of one AISH job to its activity
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| jobId | the user, or the first job of missingPacks when playbook close switched here | STOP. Say: "Which AISH job? (id)" |
| then | "close" when playbook close switched here, else "none" | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Pack not attached: <tool> failed: <error text>."
1. CALL {{tool:get_aish_job}} {"jobId":"<input:jobId>"} [A]
   IF result is null → STOP. Say: "AISH job <input:jobId> was not found. Which job? (id)"
   SAVE: projectId, issueId, workspaceId, title = those fields of result; jobStatus = result.status
   IF <saved:issueId> is empty → STOP. Say: "Job <input:jobId> has no activity; keep its pack id instead of attaching it."
2. CALL {{tool:get_aish_execution_report}} {"projectId":"<saved:projectId>","jobId":"<input:jobId>"} [A]
   IF result.canCollect != true → STOP. Say: "Collecting a pack needs the LPM user API key of a project manager; agent credentials cannot. Nothing was collected."
   SAVE: fingerprint = result.report.fingerprint (copy all 64 characters); fp = the first 16 characters of <saved:fingerprint>
3. CALL {{tool:list_workspace_activities}} {"workspaceId":"<saved:workspaceId>","projectId":"<saved:projectId>","limit":200} [A]
   SAVE: activityId = id of the FIRST item with targetType "issue" and targetId == <saved:issueId> (never the issueId)
   IF no item matches → STOP. This belongs to skill {{skill:lpm-deliver-activity}}. Say: "<saved:issueId> has no feed entry, so the pack cannot be attached. Comment on it once, then run this again."
4. CALL {{tool:list_activity_attachments}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>"} [A]
   Always make this call before collecting, even for a new job.
   IF an item has fileName == "aish-pack-<input:jobId>.md" → SAVE: attachmentId = that item's id; packId = "already attached"; go to step 8.
5. CALL {{tool:collect_aish_execution_pack}} {"projectId":"<saved:projectId>","jobId":"<input:jobId>","commandId":"pack-<input:jobId>-<saved:fp>","expectedFingerprint":"<saved:fingerprint>"} [A]
   IF the call returns an error → STOP. Say: "collect_aish_execution_pack failed: <error text>. ("Execution report changed" = run this playbook again; "requires a managing user" = use a project manager's user API key.) Nothing was attached."
   SAVE: packId = result.pack.id (all 64 characters); pack12 = the first 12 characters of <saved:packId>; pack24 = the first 24 characters of <saved:packId>
   VERIFY: CALL {{tool:get_aish_execution_pack}} {"projectId":"<saved:projectId>","jobId":"<input:jobId>","packId":"<saved:packId>"} [A]
   IF the call returns an error or result.pack.id != <saved:packId> → STOP. Say: "Pack <saved:packId> is not readable (<error text>); do not use it. Nothing was attached."
6. CALL {{tool:export_aish_execution_pack}} {"projectId":"<saved:projectId>","jobId":"<input:jobId>","packId":"<saved:packId>","commandId":"export-<saved:pack12>-md","format":"markdown"} [A]
   SAVE: content = result.content; exportId = result.export.id
   VERIFY: CALL {{tool:get_aish_execution_pack}} {"projectId":"<saved:projectId>","jobId":"<input:jobId>","packId":"<saved:packId>"} [A]
   IF the call returns an error or <saved:content> is empty → STOP. Say: "Export of pack <saved:packId> returned no content (<error text>). Nothing was attached."
   SAVE: b64 = <saved:content> as standard base64 on one line
   Never show the content or base64 in chat.
7. CALL {{tool:upload_activity_attachment}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>","fileName":"aish-pack-<input:jobId>.md","fileType":"text/markdown","contentBase64":"<saved:b64>","description":"AISH pack <saved:packId>","idempotencyKey":"ev-pack-<saved:pack24>"} [A]
   IF the call returns an error → STOP. Say: "Upload failed: <error text>. Run this playbook again with the same job: it checks for the file first and reuses the same key."
   SAVE: attachmentId = the id in "Activity attachment uploaded with ID: <id>"
   VERIFY: CALL {{tool:list_activity_attachments}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>"} [A]
   IF the call returns an error or no item has id == <saved:attachmentId> → STOP. Say: "Attachment <saved:attachmentId> is not listed; do not upload again, check it in LPM."
8. IF <input:then> == "close" → switch to playbook close.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<saved:projectId>/<saved:issueId>; job <input:jobId> <saved:title> (<saved:jobStatus>)
Done: <pack <saved:packId> collected and exported (<saved:exportId>), attached as <saved:attachmentId> | already attached as <saved:attachmentId>, no new pack | nothing attached>
Evidence: aish-pack-<input:jobId>.md (id <saved:attachmentId>) on <saved:activityId> | none
Pending: <none | the item in the STOP text — who acts>
Next: <the STOP text that ended the run | run playbook close: the DoD audit decides>
```
job: queued | leased | running | completed | failed | canceled, from step 1. An AISH evidenceId is not an attachment. Never claim a pack is attached unless step 4 or the step 7 VERIFY listed its id.
