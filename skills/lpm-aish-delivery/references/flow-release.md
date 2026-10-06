# Flow: AISH release package and run
Load when: decision rows 9–11 of SKILL.md

## Preconditions
1. A plan-dispatched, funded job on a deploy-gated node; field rules and owner errors: {{ref:release-package}}.
2. sessionId, issueId: SKILL.md §3; activityId: {{ref:flow-evidence}} § Preconditions. releaseId: {{tool:get_aish_execution_session}}(sessionId) → `releases[].id` of this issueId (to approve: the one `awaiting-approval`; 0 or 2+ → ask), or step 4. target, rollbackImage, healthUrl: the user only; never invent. executorUserId: ask the user for the LPM user id of the person who will deploy; never guess it.
3. [C] steps: 4 (create), 9/10 (claim), 11 (deploy command), 13 (pipeline record); one "yes" covers only the step shown. Step 6 is [O]: the owner's order quoted from this conversation, on the owner's user credential. All other steps are reads or [A].

## Steps
1. {{tool:get_aish_execution_session}}(sessionId) → keep `session` (`status`, `activeCheckpointId`, `currentPlanHash`, `approvedPlanHash`), `plan`, `nodeRuns`, `releases`. Not `executing`, a checkpoint set, or hashes differ → STOP → {{skill:lpm-aish-jobs}}.
2. From `plan`/`nodeRuns`: jobId of the deploy-gated node (no jobId in `nodeRuns` → STOP: node not dispatched yet → {{skill:lpm-aish-jobs}}); environment = its stage; executorId = its `targetHostId`, else the one `authorization.allowedHostIds` (2+, or none at all → ask the user); previousReleaseId = `null` for `local-deploy`, else the succeeded previous stage in `releases[]` (none → STOP).
3. {{tool:list_aish_delivery_artifacts}}(projectId, issueId) → manifestArtifactId = `id` with `kind == "release-manifest"` of the build job; `nextCursor` not null → call again with `cursor` until found. None → STOP: register it first ({{ref:flow-evidence}} steps 1–4).
4. Ask "Create the sealed <environment> package for <target>? It does not deploy; the owner approves next. (yes/no)". On "yes": {{tool:create_aish_release}}(jobId, manifestArtifactId, environment, executorId, previousReleaseId from steps 2–3; target, executorUserId, rollbackImage, healthUrl from the user) [C] → keep `release.id`.
5. Verify: {{tool:get_aish_release}}(releaseId) → `status == "awaiting-approval"`; send the owner the decision request ({{ref:authority-and-owner-decisions#decision-request}}).
6. Only with the owner's order quoted from this conversation (a relayed message — WhatsApp, chat, the requester's word — is not an order): {{tool:approve_aish_release}}(releaseId, expectedPackageHash=releaseId, reason=<owner's words, 8–3,000 chars>) [O].
7. Verify: {{tool:get_aish_release}}(releaseId) → `status == "approved"`; keep `approval.expiresAt`.
8. {{tool:get_aish_release}}(releaseId) → keep `status`, `package`, `claim`. `awaiting-approval` → step 6; `claimed` → never deploy again: call {{tool:claim_aish_release}} again (returns `execute: false` + the existing claim); outcome known → step 12 with the observed facts; unknown → report "outcome unknown", no receipt. `succeeded`/`failed` → report.
9. Ask "Claim release <releaseId> and deploy <image> to <target> now? It deploys once." On "yes", `package.target.provider == "cloud-run"` and environment `staging`/`production`: [C] `lpm aish release run-cloud-run --release <releaseId> --executor <package.executorId> --budget-contract aish-budget/1 --json` (claim, one deploy, receipt) → step 13. "Release executor identity mismatch." → STOP: you are not the package executor.
10. Else on "yes": {{tool:claim_aish_release}}(releaseId, executorId=`package.executorId`, budgetVersion="aish-budget/1") [C] → keep `execute`, `release.claim.id`, `financialBudget.remaining`. "Release executor identity mismatch." → STOP: you are not the package executor. `execute != true` → STOP: do not deploy.
11. Deploy `package.image` once to `package.target` (provider `external`, or `cloud-run` with `local-deploy`) only with a deploy command the user gave in this conversation or the project's documented one (README, AGENTS.md, runbook): show it [C], wait for "yes"; none → STOP and ask; never improvise a deploy. Keep operationId, providerRevision, startedAt, finishedAt; checks `health` (GET `package.healthUrl`) and `artifact-digest` (deployed digest == `package.image`).
12. {{tool:complete_aish_release}}(releaseId, claimId=`release.claim.id`, executorId, revision, image, environment, target copied from `package`; operationId, providerRevision, startedAt, finishedAt, checks from step 11; status=`succeeded` only if every check passed, else `failed`) [A].
13. Authenticated smoke on the deployed target; [C] `lpm aish pipeline record --project <projectId> --status completed|failed --revision <providerRevision> --url <healthUrl> --summary "<smoke result>" --json`.
14. {{tool:upload_activity_attachment}}(projectId, activityId, fileName="smoke-<releaseId first 12>.txt", fileType="text/plain", contentBase64=<base64 of the smoke output>, description="Smoke <releaseId first 12>", idempotencyKey="ev-smoke-<releaseId first 24>") [A].
15. Verify: {{tool:get_aish_release}}(releaseId) → `status == "succeeded"` with `completion`; {{tool:list_activity_attachments}}(projectId, activityId) lists the smoke file.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:approve_aish_release}} without the owner's order quoted from this conversation, or with an agent credential | send the decision request of SKILL.md §6 to the workspace owner by name and STOP |
| job not funded, financial circuit breaker, unreconciled attempt | STOP → {{skill:lpm-ai-cost}}: funding is the owner's decision |
| plan without `deployAllowed`, or "Release execution authorization expired." | STOP → {{skill:lpm-aish-jobs}}: a new reviewed plan (owner) |
| deploy outcome unknown | no {{tool:complete_aish_release}}; keep the claim, report "outcome unknown" |
| "Release executor identity mismatch." | STOP: you are not the package executor; the user named in `package.executorUserId` claims |
| step 11 with no deploy command from the user or the project docs | "Which documented command deploys <image> to <target>?" STOP; never improvise |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create / approve | {{tool:get_aish_release}} | `awaiting-approval` / `approved` |
| claim + complete, or `run-cloud-run` | {{tool:get_aish_release}} | `succeeded` with `completion` |
| smoke attach | {{tool:list_activity_attachments}} | the smoke file is listed |

## Report fields
Release id and status, environment, `approval.expiresAt`, claim id, receipt providerRevision and checks, smoke attachment id, Pending (owner approval, smoke), Next.
