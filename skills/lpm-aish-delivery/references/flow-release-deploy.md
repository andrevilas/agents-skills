# Playbook: release-deploy
Use when: deploy an approved AISH release once and record its receipt
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| releaseId | user or release-approve; copy all 64 hex characters | STOP. Say: "Which release? (64-character id)" |
| deployCommand | user-approved or documented deploy command; never invent | "none" |
| digestCommand | documented command printing the running image digest | "none" |
| operationId | provider operation ID | "none" |
| providerRevision | provider revision ID | "none" |
| startedAt | deploy start, ISO 8601 UTC | "none" |
| finishedAt | deploy end, ISO 8601 UTC | "none" |
| healthPassed | "yes" if the deployed health URL returned 2xx, else "no" | "none" |
| digestPassed | "yes" if the running digest matches the package, else "no" | "none" |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool>: <error text>. Reconcile the release; never redeploy."
1. CALL {{tool:get_aish_release}} {"releaseId":"<input:releaseId>"} [A]
   SAVE: status = result.release.status; projectId, issueId = those fields of result.release; claimId = result.release.claim.id (empty if no claim); environment, executorId, executorUserId, image, revision, healthUrl = those fields of result.release.package; target = result.release.package.target; provider, tProject, tRegion, tService = provider, project, region, service of <saved:target>
   IF <saved:status> == "awaiting-approval" → STOP. Say: "Release <input:releaseId> is not approved; playbook release-approve sends the owner the decision request. Nothing was deployed."
   IF <saved:status> == "succeeded" → switch to playbook release-smoke.
   IF <saved:status> == "failed" → STOP. Say: "Receipt is final. Retry needs a new plan attempt, package and approval."
   IF <saved:status> == "claimed" and <input:operationId> == "none" → STOP. Say: "Already claimed. Supply observed receipt fields; never deploy again."
   IF <saved:status> == "claimed" → SAVE: operationId = <input:operationId>; providerRevision = <input:providerRevision>; startedAt = <input:startedAt>; finishedAt = <input:finishedAt>; healthOk = <input:healthPassed>; digestOk = <input:digestPassed>; go to step 10.
2. IF <saved:provider> != "cloud-run" or <saved:environment> == "local-deploy" → go to step 5.
3. ASK: "Run the Cloud Run release adapter once for <input:releaseId>, executor <saved:executorId>, image <saved:image>, target <saved:target>? It claims, deploys, checks health and records the receipt. (yes/no)" — continue only if the user says yes; otherwise STOP.
4. RUN `lpm aish release run-cloud-run --release <input:releaseId> --executor <saved:executorId> --budget-contract aish-budget/1 --json`
   IF the command fails → STOP. Say: "Adapter outcome unknown: <error text>. Reconcile the release; never redeploy."
   VERIFY: CALL {{tool:get_aish_release}} {"releaseId":"<input:releaseId>"} [A]
   IF the call returns an error or result.release.status is neither "succeeded" nor "failed" → STOP. Say: "Outcome unknown; do not deploy again."
   IF result.release.status == "succeeded" → switch to playbook release-smoke.
   SAVE: status = result.release.status; go to Answer.
5. IF <input:deployCommand> == "none" or <input:digestCommand> == "none" → STOP. Say: "Provide the documented deploy and image-digest commands."
6. ASK: "Claim <input:releaseId> and run <input:deployCommand> once for image <saved:image> on <saved:target>, within the funded cap? (yes/no)" — continue only if the user says yes; otherwise STOP.
7. CALL {{tool:claim_aish_release}} {"releaseId":"<input:releaseId>","executorId":"<saved:executorId>","budgetVersion":"aish-budget/1"} [C]
   IF the call returns an error → STOP. Say: "Claim failed: <error text>. Nothing deployed; reconcile approval, executor identity or funding."
   SAVE: execute = result.execute; claimId = result.release.claim.id
   VERIFY: CALL {{tool:get_aish_release}} {"releaseId":"<input:releaseId>"} [A]
   IF the call returns an error or result.release.status != "claimed" → STOP. Say: "Claim not verified. No deploy."
   IF <saved:execute> != true → STOP. Say: "Claim replay: do not deploy. Supply the previously observed outcome."
   SAVE: startedAt = the current UTC time, ISO 8601
8. RUN `<input:deployCommand>`
   IF the command fails → STOP. Say: "Deploy failed: <error text>. Claim remains; supply its observed outcome before recording a receipt."
   SAVE: finishedAt = the current UTC time, ISO 8601; operationId, providerRevision = the operation id and the provider revision the command printed
   IF <saved:operationId> is empty or <saved:providerRevision> is empty → STOP. Say: "Supply provider operation and revision IDs. Do not deploy again."
   VERIFY: RUN `curl -sS --max-time 30 -o /dev/null -w "%{http_code}" '<saved:healthUrl>'`
   IF the command fails or the output is not 200–299 → SAVE: healthOk = "no"; go to step 9.
   SAVE: healthOk = "yes"
9. RUN `<input:digestCommand>`
   IF the command fails → SAVE: digestOk = "no"; go to step 10.
   SAVE: digestOk = "yes" when the output contains the part of <saved:image> after "@", else "no"
10. SAVE: receiptStatus = "succeeded" when <saved:healthOk> == "yes" and <saved:digestOk> == "yes", else "failed"; healthPassed = <saved:healthOk> == "yes"; digestPassed = <saved:digestOk> == "yes"
   IF any receipt field is "none" or either check is unknown → STOP. Say: "Supply observed receipt fields; never redeploy."
11. CALL {{tool:complete_aish_release}} {"releaseId":"<input:releaseId>","claimId":"<saved:claimId>","executorId":"<saved:executorId>","operationId":"<saved:operationId>","revision":"<saved:revision>","image":"<saved:image>","environment":"<saved:environment>","providerRevision":"<saved:providerRevision>","status":"<saved:receiptStatus>","startedAt":"<saved:startedAt>","finishedAt":"<saved:finishedAt>","target":"<saved:target>","checks":[{"name":"health","assertion":"GET <saved:healthUrl> after deploy: <saved:healthOk>","passed":"<saved:healthPassed>"},{"name":"artifact-digest","assertion":"Deployed digest matches <saved:image>: <saved:digestOk>","passed":"<saved:digestPassed>"}]} [A]
   VERIFY: CALL {{tool:get_aish_release}} {"releaseId":"<input:releaseId>"} [A]
   IF the call returns an error or result.release.status != <saved:receiptStatus> → STOP. Say: "The receipt is not verified. Reconcile the existing claim; never deploy again."
   SAVE: status = result.release.status
   IF <saved:status> == "succeeded" → switch to playbook release-smoke.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: release <input:releaseId>, target <saved:target>
Done: <claim <saved:claimId>, receipt <saved:status> | nothing deployed>
Evidence: health <saved:healthOk>; artifact-digest <saved:digestOk>; operation <saved:operationId> | none
Pending: <smoke evidence | blocker and owner>
Next: <ASK/STOP text | release-smoke | lpm-aish-jobs for a new attempt>
```
Never claim success without health and digest evidence. Never deploy twice.
