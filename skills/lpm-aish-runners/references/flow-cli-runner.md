# Flow: run one job with the CLI runner
Load when: decision row 1 of SKILL.md

## Preconditions
1. LPM API key; project manage rights. Ask: projectId, executorCommand (an operator script path, never the job prompt).
2. `lpm aish runner start` does not take a jobId: it leases the OLDEST leasable job of the project by `createdAt`. Run it only when that job is the one the user wants.
3. It also leases jobs bound to another host (`targetHostId`) and ignores host `draining`/`suspended`; steps 2 and 4 guard this.

## Steps
1. {{tool:list_aish_jobs}}(projectId) → leasable jobs: `executionGate.runnerMayExecute == true` and `status == "queued"` (or `status == "leased"` with `lease.expiresAt` in the past). None → STOP: "No approved queued AISH job." → {{skill:lpm-aish-jobs}}. Tell the user: "The CLI will take the oldest by `createdAt`: <jobId> <title>."
2. Any leasable job with `targetHostId != null` → STOP: "Job <id> is targeted to host <targetHostId>; run `lpm aish host start --targeted-only` on that host instead." (the local CLI cannot skip it: it takes the oldest).
3. {{tool:get_aish_job}}(oldest jobId) → `financialBudget == null` → Stop row 1. `financialBudget.attemptId != null` → Stop row 2.
4. [C] Load {{ref:executor-hygiene}}; show `lpm aish runner start --project <projectId> --executor-command <executorCommand> --budget-contract aish-budget/1 --once --json`. Add `--host <hostId>` only when {{tool:get_aish_runner_management_overview}} shows that host with `legacy == false` and `administrativeStatus == "online"`. Drop `--once` only for an authorized queue worker.
5. Run it. `leased: false` → step 6. Else output `{runnerId, hostId, sessionId, job, exitCode}` → keep `job.id`, `job.status`, `exitCode`; `job.id` differs from the job the user wanted → say so in the report; go to step 7.
6. `leased: false` → step 1 again: a leasable job still exists → Stop row 1 (budget paused or circuit breaker, not "no jobs"); none → STOP: "No queued AISH jobs available."
7. The CLI records no trace and no consumption. Executor reported provider usage → [C] `lpm aish consumption record --file <receipt.json>` ({{tool:record_aish_consumption}} input; attemptId = {{tool:get_aish_job}} → `financialBudget.attemptId`; `occurredAt` inside the lease window). No usage reported → Pending "executor usage not recorded".
8. Verify: {{tool:get_aish_job}}(`job.id` from step 5) → `status` `completed`/`failed` AND `evidence[]` non-empty (keep `evidence[0].id`) AND `execution.source == "exact-executor"`. Done.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| not funded, budget paused, circuit breaker | STOP: "Job <jobId> is not funded or its budget is paused; funding is the owner's decision." Load {{ref:ai-cost-and-budgets}} → {{skill:lpm-ai-cost}} |
| `financialBudget.attemptId != null` | STOP: "Job <jobId> already used its one funded attempt; it needs reconciliation and a new job ({{skill:lpm-aish-jobs}} / owner)." |
| a token, credential or `.env` value would enter output or evidence | do not send it; redact ({{ref:security-and-untrusted-text}}) |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| CLI run (step 5) | {{tool:get_aish_job}}(`job.id`) | `completed`/`failed`, `evidence[]` non-empty, `execution.source == "exact-executor"` |
| consumption (step 7) | {{tool:list_aish_consumption}}(jobId) | the recorded entry is listed |

## Report fields
- projectId, runnerId, sessionId, `job.id` (and the job the user wanted, if different), `exitCode`
- job status; evidence id `evidence[0].id`
- consumption entry id, or "none: CLI run records none — executor usage pending"; trace "none"
- pending: executor usage, reconciliation or funding — who must act
