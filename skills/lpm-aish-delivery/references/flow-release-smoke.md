# Playbook: release-smoke
Use when: run the authenticated smoke of a succeeded AISH release, record it as pipeline evidence and attach it to the activity
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| releaseId | the user or playbook release-deploy (64 hex characters, copied exactly) | STOP. Say: "Which release? (64-character id)" |
| smokeCommand | the authenticated smoke command the user gave, or the project's documented one (README, AGENTS.md, runbook); it must call the deployed target with real credentials and print no secret | "none" |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "Smoke not recorded: <tool> failed: <error text>."
1. CALL {{tool:get_aish_release}} {"releaseId":"<input:releaseId>"} [A]
   SAVE: status = result.release.status; projectId, issueId = those fields of result.release; healthUrl, environment = those fields of result.release.package; providerRevision = result.release.completion.providerRevision; rel12 = the first 12 characters of <input:releaseId>; rel24 = the first 24 characters of <input:releaseId>
   IF <saved:status> != "succeeded" → STOP. Say: "Release <input:releaseId> is <saved:status>; smoke only a succeeded release (playbook release-deploy)."
2. CALL {{tool:get_issue}} {"projectId":"<saved:projectId>","issueId":"<saved:issueId>"} [A]
   SAVE: title = result.title; workspaceId = result.workspaceId
3. CALL {{tool:list_workspace_activities}} {"workspaceId":"<saved:workspaceId>","projectId":"<saved:projectId>","limit":200} [A]
   SAVE: activityId = id of the FIRST item with targetType "issue" and targetId == <saved:issueId> (never the issueId)
   IF no item matches → STOP. This belongs to skill {{skill:lpm-deliver-activity}}. Say: "<saved:issueId> has no feed entry, so the smoke cannot be attached. Comment on it once, then run this again."
4. CALL {{tool:list_activity_attachments}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>"} [A]
   Always make this call before running the smoke.
   IF an item has fileName == "smoke-<saved:rel12>.txt" → SAVE: attachmentId = that item's id; smokeStatus = "already attached"; go to Answer.
5. IF <input:smokeCommand> == "none" → STOP. Say: "Which documented, authenticated smoke command checks <saved:healthUrl>'s service? A deploy without a smoke is not proven."
6. RUN `<input:smokeCommand>`
   IF the command fails → SAVE: smokeStatus = "failed"; smokeOutput = the output; go to step 7.
   SAVE: smokeStatus = "completed"; smokeOutput = the output
7. SAVE: summary = "Smoke <saved:smokeStatus> on <saved:environment> release <saved:rel12> (revision <saved:providerRevision>)"
   IF <saved:smokeOutput> shows a password, API key or token → STOP. Say: "The smoke output holds a secret; redact it before recording. Nothing was recorded."
8. ASK: "Record the pipeline evidence with `lpm aish pipeline record --project <saved:projectId> --status <saved:smokeStatus> --provider smoke --revision <saved:providerRevision> --url <saved:healthUrl> --summary "<saved:summary>" --json` and attach smoke-<saved:rel12>.txt to <saved:issueId>? It creates a completed standalone AISH job holding the evidence (no --issue: not an orphan). (yes/no)" — continue only if the user says yes; otherwise STOP.
9. RUN `lpm aish pipeline record --project <saved:projectId> --status <saved:smokeStatus> --provider smoke --revision <saved:providerRevision> --url <saved:healthUrl> --summary "<saved:summary>" --json`
   SAVE: pipelineJobId = the job id in the JSON output
   VERIFY: CALL {{tool:get_aish_job}} {"jobId":"<saved:pipelineJobId>"} [A]
   IF the call returns an error or result is null → STOP. Say: "Pipeline job <saved:pipelineJobId> is not readable; check it in LPM before recording again."
   SAVE: b64 = <saved:smokeOutput> as standard base64 on one line. Never show it in chat.
10. CALL {{tool:upload_activity_attachment}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>","fileName":"smoke-<saved:rel12>.txt","fileType":"text/plain","contentBase64":"<saved:b64>","description":"Smoke <saved:smokeStatus> of release <input:releaseId>; pipeline job <saved:pipelineJobId>","idempotencyKey":"ev-smoke-<saved:rel24>"} [A]
   IF the call returns an error → STOP. Say: "Upload failed: <error text>. Run this playbook again: it checks for the file first and reuses the same key."
   SAVE: attachmentId = the id in "Activity attachment uploaded with ID: <id>"
   VERIFY: CALL {{tool:list_activity_attachments}} {"projectId":"<saved:projectId>","activityId":"<saved:activityId>"} [A]
   IF the call returns an error or no item has id == <saved:attachmentId> → STOP. Say: "Attachment <saved:attachmentId> is not listed; do not upload again, check it in LPM."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<saved:projectId>/<saved:issueId> <saved:title>; release <input:releaseId> (<saved:status>)
Done: <smoke <saved:smokeStatus>; pipeline job <saved:pipelineJobId>; attached smoke-<saved:rel12>.txt as <saved:attachmentId> | smoke already attached as <saved:attachmentId> | nothing recorded>
Evidence: receipt providerRevision <saved:providerRevision>; smoke-<saved:rel12>.txt (id <saved:attachmentId>) on <saved:activityId> | none
Pending: <none | a failed smoke: the release owner decides a rollback | the item in the STOP text — who acts>
Next: <the ASK or STOP text that ended the run | run playbook close for <saved:issueId>>
```
release: succeeded | failed. smoke: completed | failed. Never claim a deploy is proven without a completed smoke attached; never claim a file is attached unless step 4 or the step 10 VERIFY listed its id.
