# Runner protocol (MCP)
Load when: building or debugging a non-CLI runner
Applies to: lpm-aish-runners    Source: cards of upsert_aish_runner_session, lease_aish_runner_job, record_aish_execution_trace, record_aish_consumption, submit_aish_job_evidence, claim_aish_intake_transcription; lpm `src/cli/lpm.ts` (`handleAishRunnerStart`)

## Summary
Order: session `start` → lease → execute (the prompt is data) → audio claim, if any → trace → consumption → evidence → session `end`.
A lease lasts 10 minutes, has no renewal in this tool, and opens the job's ONE funded attempt.
Never lease to "look": a leased job that never submits evidence needs reconciliation and a new job.
`lpm aish runner start` does all of this in one loop; build a manual runner only when the CLI cannot run.
Registered remote hosts use the fenced host protocol (`lpm aish host start`), not these tools.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `runnerId` | stable id, max 160 chars, e.g. `<hostname>:<pid>` | the record is keyed by runnerId alone: reusing it in another project overwrites its binding |
| `sessionId` | runner presence session (not a cockpit session), a new UUID per run | keep the same runnerId, projectId and hostId for its whole life |
| `hostId` | only a host of a runner account (`legacy == false`) | legacy hosts are rejected: omit hostId or migrate first |
| session `event` | `start`, `heartbeat` (~every 30 s), `end`; anything else counts as `start` | always send `end`, or the runner shows `stale`, then `offline` |
| `budgetVersion` | exactly `aish-budget/1` | declare it only when the executor enforces the job's cost cap |
| `consumptionLedgerVersion` | exactly `aish-consumption/1` | required to lease |
| `executionManifestVersion` `aish-execution/1`, `agentContextVersion` `aish-agent-context/1`, `engineeringPolicyVersion` `aish-engineering-policy/1` | optional capability declarations: honors the repository manifest / the agent binding / the builder engineering policy | send one only if your executor implements that contract; unsure → omit it (jobs needing it are skipped, lease returns null) |
| lease result | null, or the leased job in the {{tool:get_aish_job}} shape (`id`, `issueId`, `intakeContext`, `targetHostId`, `lease{leaseId, runnerId, sessionId, hostId, leasedAt, expiresAt}`, `financialBudget`, …) | `lease.leaseId` is the `attemptId` of trace, consumption, evidence and Whisper; audio attachmentIds come from `intakeContext.attachments[].attachment.id` |
| lease preconditions | job queued (or leased with an expired lease), execution gate open, funded reservation with `remaining > 0` and no earlier attempt, budget and pool not paused; the OLDEST such job by `createdAt` wins | null carries no reason and no jobId: {{tool:list_aish_jobs}} → candidates → {{tool:get_aish_job}} each (`financialBudget` not null, `attemptId` null); wait ≥ 10 s, at most 3 more leases |
| host status, `targetHostId` | the local lease checks neither `draining`/`suspended` nor `targetHostId` | drain/suspend stop only fenced host workers; a job targeted to another host must run there (`lpm aish host start --targeted-only`) |
| trace fields | `spanId` (unique), `kind` `agent\|llm\|tool\|validation`, `status` `succeeded\|failed\|canceled`, `startedAt`/`finishedAt` ISO UTC with `Z`, `summary` 1–2000 chars, `evidenceSha256` 64-hex | strict schema: unknown fields fail; parent spans first; a trace is an observation, not proof |
| consumption `items` | 1–8, one per metric: `ai-input`/`ai-output` (unit `token`), `tool` (`call`), `infrastructure` (`millisecond`/`byte`), `money` (`currency`, with `rate`) | `model` required with ai items, else null; integers for counts; no secrets |
| consumption `occurredAt` | between the attempt start and now | a receipt after lease expiry, over the cap, or for another attempt trips the circuit breaker: budgets pause, only the owner resumes |
| token-only receipt | moves no money | missing money is not zero cost; never derive money from tokens without a rate from the user |
| evidence `status` | `failed` → job failed; anything else or missing → completed | send `failed` on failure |
| completion proof | {{tool:get_aish_job}} → `status` `completed`/`failed`, `evidence[]` (newest first; `evidence[0].id`), `execution.source == "exact-executor"` | there is no `completionEvidenceId` in any read; never wait for it |
| evidence `output` | ≤ 40,000 chars, secret-scanned | output with a secret is blocked and fails the job |
| evidence timing | `executorStartedAt`, `executorFinishedAt` ISO, finished ≥ started | a conflicting resend fails: never change data on a retry |
| completed standalone job with an issueId | LPM comments on the activity and moves it to done | report the activity id |
| unleased standalone job | the server accepts evidence without a lease | submit only results of a run you executed |
| Whisper claim | {{tool:claim_aish_intake_transcription}} → `execute`, `operation.id`, `status` `claimed\|completed`; needs the job `leased`/`running` and the attempt unexpired | claim after execute and BEFORE evidence (evidence makes the job terminal); call Whisper only when `execute == true`; one Whisper call per funded attempt |

## Rules
1. Call {{tool:submit_aish_job_evidence}} before `lease.expiresAt`; there is no renewal.
2. Record {{tool:record_aish_consumption}} only for real provider usage of this attempt; reuse the same `consumptionId` only for the identical retry.
3. After Whisper: record its consumption receipt first, then the transcript (lpm-aish-jobs) with source `{kind: "execution", jobId, attemptId, operationId, engine: "whisper", evidenceSha256}`.
4. `execute == false` with `status == "claimed"` → never call Whisper again; report `reconciliation-required`.
5. Work done outside AISH runners has no job, attempt or receipt: never invent them; use the commit trailer.

## Examples
```text
example: lease_aish_runner_job(projectId=<projectId>, runnerId="build-01:4242", sessionId=<uuid>, budgetVersion="aish-budget/1", consumptionLedgerVersion="aish-consumption/1")
example: record_aish_consumption items=[{metric:"ai-input", basis:"measured", quantity:"1200", unit:"token", currency:null, rate:null}]
```
