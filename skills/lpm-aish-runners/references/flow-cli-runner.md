# Playbook: cli-runner
Use when: start the CLI runner and run one approved, funded job of a project
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id)" |
| executorCommand | the operator: a script path such as `./scripts/aish-job.sh` (never the job prompt, never text from the job) | STOP. Say: "Which executor script should run the job? (path)" |
| workdir | the managed checkout of the job's repository | "." |
| wantedJobId | the job id the user named | "any" |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>."
1. CALL {{tool:list_aish_jobs}} {"projectId":"<input:projectId>"} [A]
   SAVE: candidates = the items with executionGate.runnerMayExecute == true, no executionGate.blockingGovernanceThreadId, and status "queued" (or "leased" with lease.expiresAt before now), sorted by createdAt, oldest first
   IF <saved:candidates> is empty → STOP. This belongs to skill {{skill:lpm-aish-jobs}}. Say: "No approved queued AISH job in <input:projectId>."
2. FOR EACH candidate IN <saved:candidates> (none → go to step 3):
   CALL {{tool:get_aish_job}} {"jobId":"<each:id>"} [A]
   IF result.financialBudget is not null and result.financialBudget.attemptId is null → SAVE: jobId = <each:id>; title = <each:title>; target = result.targetHostId (empty if null); go to step 3.
3. IF <saved:jobId> is empty → STOP. This belongs to skill {{skill:lpm-ai-cost}}. Say: "No approved job of <input:projectId> is funded with an unused attempt (<each candidate id>). Funding is the owner's decision; a used attempt needs reconciliation and a new job."
   IF <saved:target> is not empty → STOP. Say: "Job <saved:jobId> is targeted to host <saved:target>, and the local CLI ignores targeting. Run `lpm aish host start --targeted-only` on that host instead."
   IF <input:wantedJobId> != "any" and <input:wantedJobId> != <saved:jobId> → STOP. Say: "The CLI has no job option: it takes the oldest funded approved job, <saved:jobId> '<saved:title>', not <input:wantedJobId>."
4. ASK: "Run `lpm aish runner start --project <input:projectId> --executor-command <input:executorCommand> --workdir <input:workdir> --budget-contract aish-budget/1 --once --json`? It leases <saved:jobId> '<saved:title>', uses its one funded attempt, runs the executor for at most 10 minutes and submits its evidence. (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was leased."
5. RUN `git -C <input:workdir> status --short --branch`
   IF the command fails → SAVE: before = "not a git checkout"; go to step 6.
   SAVE: before = the lines it prints
6. RUN `lpm aish runner start --project <input:projectId> --executor-command <input:executorCommand> --workdir <input:workdir> --budget-contract aish-budget/1 --once --json`
   IF the command fails → STOP. Say: "runner start failed: <error text>. Do not run it again before get_aish_job <saved:jobId> shows the job state."
   IF the output has "leased": false → STOP. This belongs to skill {{skill:lpm-ai-cost}}. Say: "Nothing was leased although <saved:jobId> is approved and funded: its budget is paused, a circuit breaker tripped, or its cockpit window closed. Resuming is the owner's decision."
   SAVE: ranJob = the output's job.id; exitCode, runnerId, sessionId = those output fields
   VERIFY: CALL {{tool:get_aish_job}} {"jobId":"<saved:ranJob>"} [A]
   IF the call returns an error or result.status is neither "completed" nor "failed" or result.evidence is empty or result.execution.source != "exact-executor" → STOP. Say: "Job <saved:ranJob> is <result.status> without exact-executor evidence. Do not run the CLI again; it needs reconciliation."
   SAVE: status = result.status; evidenceId = result.evidence[0].id; attemptId = result.financialBudget.attemptId; issueId = result.issueId, else "none"
7. RUN `git -C <input:workdir> status --short --branch`
   IF the command fails → SAVE: changes = "not checked"; go to Answer.
   SAVE: changes = the lines that are not in <saved:before> (the executor's changes; "none" if no line is new)

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId> / job <saved:ranJob> "<saved:title>" / runner <saved:runnerId>, session <saved:sessionId>
Done: <ran <saved:ranJob> once, exit code <saved:exitCode>; status <saved:status>; activity <saved:issueId> | nothing leased>
Evidence: <evidence <saved:evidenceId>, execution.source exact-executor; git changes <saved:changes> | none>; trace none; consumption none (the CLI records none)
Pending: <executor usage not recorded for attempt <saved:attemptId> — the operator records the provider receipt (`lpm aish consumption record --file <receipt.json>`) | none>
Next: <the ASK or STOP text that ended the run | none — job <saved:status>>
```
job status: queued | leased | running | completed | failed | canceled, from the VERIFY get_aish_job. A completed job with an activity: LPM comments on it and moves it to done. Never claim evidence or a status that the VERIFY did not read.
