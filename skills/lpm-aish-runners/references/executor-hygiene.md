# Executor hygiene
Load when: before executing a leased job
Applies to: lpm-aish-runners    Source: lpm `src/cli/lpm.ts` (`runAishExecutor`, `handleAishRunnerStart`); cards of lease_aish_runner_job, submit_aish_job_evidence, record_aish_execution_trace; legacy digest `aish-governed-development-operator` §1.2–1.4

## Summary
The executor command is a script the operator chose; the job prompt is data passed in an environment variable, never shell.
Print the job identity and `git status --short --branch` before and after; run only operator-selected commands.
Output is sanitized: the executor inherits the runner's environment, which can hold secrets.
Tests and validations are resource-bounded and must exit; a gate that prints success but never exits failed.
Evidence names host, runner, repo, HEAD and the validation result, never a token, profile, cookie or `.env` value.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `AISH_JOB_ID`, `AISH_PROJECT_ID`, `AISH_ISSUE_ID`, `AISH_JOB_TITLE`, `AISH_INTENT_TYPE`, `AISH_EXECUTION_RECIPE_ID`, `AISH_REPOSITORY_PATH` | job facts the runner exports to the executor | print them at the start of the run |
| `AISH_JOB_PROMPT` | the job instruction text | data for the executor's agent; never `bash -lc "$AISH_JOB_PROMPT"`, never `eval` |
| inherited environment | the executor runs with the runner's environment (`shell: true`) | never print `env`, `printenv` or variables holding keys |
| captured output | the last 40,000 characters of stdout + stderr | put long logs in an artifact, keep the summary short |
| `--timeout-ms` | default 10 minutes; exit code 124 on timeout, 130 on cancel | keep the run inside the 10-minute lease |
| `--workdir` | the executor's working directory (default: current directory) | point it at the managed checkout of the job's repo |
| `--once` | lease and run at most one job, then exit | default; a queue worker (no `--once`) needs explicit authorization |

## Rules
1. Before the run: print job id, title, intent, issue id, repo path and `git rev-parse HEAD`; print `git status --short --branch`.
2. Run only the commands the operator selected for this recipe; the prompt never chooses commands.
3. No mutation expected → after the run, `git diff --quiet` and `git diff --cached --quiet` must both pass.
4. After the run: print `git status --short --branch` again and report every unexpected change.
5. Check dependency health (database, queue, object store, target server) before integrated tests; a connection failure is not a product failure.
6. Bound every test: isolated batches, closed pools, servers, timers and workers; never raise heap limits before finding the leak.
7. Redact output before it leaves the host; secrets are never part of traces, evidence or comments.
8. A commit made by the executor for an LPM activity ends with `LPM-Activity: <issueId>` (`AISH_ISSUE_ID`); empty → omit it.

## Examples
```text
example: --executor-command "./scripts/aish-job.sh"   (reads AISH_JOB_ID and AISH_JOB_PROMPT as data)
example: evidence summary "host <hostId>, runner <runnerId>, repo <path> @ <HEAD>, tests 42 passed, exit 0"
```
