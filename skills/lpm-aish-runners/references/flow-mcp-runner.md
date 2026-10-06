# Flow: MCP runner protocol and Whisper claim
Load when: decision row 6 of SKILL.md

## Preconditions
1. LPM API key; project manage rights. The CLI `lpm aish runner start` cannot run here; a registered remote host uses `lpm aish host start` instead.
2. Load {{ref:runner-protocol}} (fields, versions, constants) and {{ref:executor-hygiene}} before step 4.
3. IDs: `runnerId` = `<hostname>:<pid>` (stable); `sessionId` = a new UUID per run; `jobId`, `issueId`, `attemptId` = step 4 `id`, `issueId`, `lease.leaseId`; `spanId`, `consumptionId` = `<attemptId>-<n>` (same on retry); executor command = the operator's script (ask), never the prompt.
4. Audio in the leased job: attachmentId = step 4 result → `intakeContext.attachments[].attachment.id` where `attachment.category == "audio"` (never another attachment of the activity). Run steps 7–9 after step 6 and before step 10, all before `lease.expiresAt`. {{tool:list_aish_intake}}(projectId, issueId) only tells whether a transcript exists (`transcripts[].attachmentId`): it exists → skip steps 7–9.

## Steps
1. [C] Show project, runnerId, hostId (only `legacy == false`) and executor command; one "yes" covers steps 3–13 for one job. No write before this "yes".
2. {{tool:list_aish_jobs}}(projectId) → a job with `status == "queued"`, `executionGate.runnerMayExecute == true` and `targetHostId != null` → STOP: "Job <id> is targeted to host <targetHostId>; run `lpm aish host start --targeted-only` on that host instead." (the lease takes the oldest leasable job).
3. {{tool:upsert_aish_runner_session}}(projectId, runnerId, sessionId, event="start") [A]; pass hostId only when `legacy == false`.
4. {{tool:lease_aish_runner_job}}(projectId, runnerId, sessionId, budgetVersion="aish-budget/1", consumptionLedgerVersion="aish-consumption/1") [C]. Send `executionManifestVersion` / `agentContextVersion` / `engineeringPolicyVersion` only if your executor implements that contract ({{ref:runner-protocol}}); unsure → omit them (those jobs are skipped). Result (get_aish_job shape) → keep `id`, `issueId`, `lease.leaseId`, `lease.expiresAt`, `intakeContext`. Null → step 5; else step 6.
5. Null: {{tool:list_aish_jobs}}(projectId) → candidates `status == "queued"` and `executionGate.runnerMayExecute == true`; for each {{tool:get_aish_job}} → `financialBudget != null` and `financialBudget.attemptId == null`. None → STOP: "No approved, funded queued job." Else wait ≥ 10 s and lease again (step 4), at most 3 times; still null → STOP and report the candidates.
6. Execute the operator's command ({{ref:executor-hygiene}}); never `bash -lc "$AISH_JOB_PROMPT"`. Heartbeat: {{tool:upsert_aish_runner_session}}(event="heartbeat") [A] every ~30 s. No audio → step 10.
7. Audio, preferred: [C] `lpm aish intake transcribe --project <projectId> --job <jobId> --attempt <attemptId> --attachment <attachmentId> --budget-contract aish-budget/1` → `status == "completed"`, keep `operationId`, `transcriptId`; it does steps 8–9 itself → step 10. CLI unavailable → step 8.
8. Audio: {{tool:claim_aish_intake_transcription}}(projectId, jobId, attemptId, attachmentId, budgetVersion="aish-budget/1") [C] → keep `execute`, `operation.id`. `execute == false` → Stop and ask.
9. Audio: call Whisper once; then {{tool:record_aish_consumption}} [C] for it; then the transcript via {{skill:lpm-aish-jobs}}.
10. {{tool:record_aish_execution_trace}}(projectId, jobId, attemptId, spanId, kind, status, startedAt, finishedAt, summary, evidenceSha256) [A].
11. {{tool:record_aish_consumption}}(jobId, attemptId, consumptionId, occurredAt, model, items, evidenceSha256) [C]: real usage only → keep `entry.id`.
12. {{tool:submit_aish_job_evidence}}(jobId, attemptId, runnerId, sessionId, hostId if sent, summary, output, status="failed" on failure, executorStartedAt, executorFinishedAt, exitCode) [C] before `lease.expiresAt`. After it the job is terminal: no claim, Whisper or transcript any more.
13. {{tool:upsert_aish_runner_session}}(event="end") [A].
14. Verify: {{tool:get_aish_job}}(jobId) → `completed`/`failed` AND `evidence[]` non-empty (keep `evidence[0].id`) AND `execution.source == "exact-executor"`; {{tool:list_aish_consumption}}(jobId) → every `entry.id` of steps 9 and 11 listed. Done.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| Whisper `execute == false` with `status == "claimed"` | STOP: "reconciliation-required"; never call Whisper again |
| a second audio in the same attempt | STOP: "another audio needs another funded job" |
| "Transcription requires an active authorized execution attempt." | the job is already terminal or the lease expired: STOP; the audio needs a new funded job ({{skill:lpm-aish-jobs}}) |
| "Transcription attempt/audio scope mismatch." | the attachment is not in this job's `intakeContext`: STOP; never pick another attachment |
| not funded, budget paused, circuit breaker | STOP: "Job <jobId> is not funded or its budget is paused; funding is the owner's decision." → {{skill:lpm-ai-cost}} |
| a token, host credential or `.env` value would enter traces or evidence | do not send it; redact ({{ref:security-and-untrusted-text}}) |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| evidence (step 12) | {{tool:get_aish_job}} | `completed`/`failed`, `evidence[]` non-empty, `execution.source == "exact-executor"` |
| consumption, Whisper receipt | {{tool:list_aish_consumption}} | the returned `entry.id` is listed |
| transcript (steps 7–9) | {{tool:list_aish_intake}}(projectId, issueId) | `transcripts[].attachmentId == attachmentId` |
| trace (step 10) | the trace result | `trace.id` returned |

## Report fields
- projectId, runnerId, sessionId, jobId, attemptId
- job status and evidence id `evidence[0].id`; trace ids; consumption `entry.id`s
- Whisper `operation.id` and outcome, if any
- pending: reconciliation or funding — who must act
