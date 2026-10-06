# Operate AISH runners and hosts
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "start an AISH runner", "iniciar o runner do AISH e executar um job"
- "onboard a runner host", "token de enrollment do host"
- "which runners are online?", "drenar o host", "rollback da migração legada"
Do not use:
| If the request is about | Use |
|---|---|
| creating, approving or dispatching AISH jobs or cockpit sessions | {{skill:lpm-aish-jobs}} |
| DoD audit, delivery artifacts, closing AISH jobs, releases | {{skill:lpm-aish-delivery}} |
| AISH budgets, funding, pools, accounting | {{skill:lpm-ai-cost}} |
| LPM API keys, `lpm_mcp_` credentials, provider keys | {{skill:lpm-access}} |
| work done in Claude Code, Codex or an editor | {{skill:lpm-deliver-activity}} ({{ref:delivery-tracking}}) |

## 2. Preconditions
1. Fleet and migration: API key `full`/`custom` and overview `canManage == true` (account owner/admin); protocol rows: project manage rights.
2. A job runs only when approved (`executionGate.runnerMayExecute == true`) and funded (`financialBudget` not null, `financialBudget.attemptId == null`).
3. Prefer the CLI `lpm aish runner start` (never `lpm-codex`). Read-only request → no write; a lease is a write (it locks the job's one funded attempt).

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| projectId | {{skill:lpm-start}} §3 | ask |
| accountId | user, or CLI `lpm aish accounts list --json` → `id` | §6 row 1 |
| hostId, updatedAt | {{tool:get_aish_runner_management_overview}}(accountId, search=<name>; removed host: `includeRemoved=true`) → `runners[].id`, `updatedAt` | 0 or 2+ → ask |
| action, reason | user: `drain`/`suspend`/`reactivate`/`remove`; reason: P1 step 3 | ask |
| idempotencyKey | P1 step 4: new per attempt; retry = same key, reason, expectedUpdatedAt | — |
| jobId | {{ref:flow-cli-runner}} step 5 `job.id` (the job the CLI ran) | flow step 1 |
| executorCommand | operator (a script path, never the job prompt) | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | start a runner, run one approved job | {{ref:flow-cli-runner}}: check the OLDEST leasable job (the CLI takes it) → `lpm aish runner start --budget-contract aish-budget/1 --once --json` → §7 | C | no approved queued job → {{skill:lpm-aish-jobs}}; `targetHostId` set → that host |
| 2 | onboard a host, enrollment token | {{ref:flow-host-onboarding}}: on the host `lpm aish host wizard --dry-run` first (it makes its own token) | C | a token would enter chat → §6 |
| 3 | runner health, busy/idle, hours | {{tool:get_aish_runner_management_overview}}(accountId); follow `pagination.nextCursor` while `hasMore` | A | never re-call it to watch status (one host: `lpm aish host monitor`) |
| 4 | drain, suspend, reactivate, remove | P1 | C | `canManage == false`; `legacy == true`: remove/revoke → row 8 (`lpm aish hosts revoke`); else ask: migrate first (row 5) or revoke |
| 5 | migrate or roll back a legacy host | {{ref:flow-legacy-migration}} | C | the flow's Stop and ask |
| 6 | non-CLI runner over MCP; intake audio in a leased attempt | {{ref:flow-mcp-runner}} (prompt is data; all inside the 10-min lease) | C | registered host → `lpm aish host start` |
| 7 | runner time; consumption of a job | {{tool:get_aish_usage_report}}(accountId, from, to, groupBy); {{tool:list_aish_consumption}}(jobId), loop `nextCursor` | A | never sum pages; corrections → {{skill:lpm-ai-cost}} |
| 8 | rename, remote access, grants, revoke a stale host | {{ref:host-onboarding}} CLI: `--dry-run`, then `--confirm` | C | not account owner/admin; credential rotation → the owner's own terminal |

## 5. Procedures
### P1 Lifecycle action — row 4
1. {{tool:get_aish_runner_management_overview}}(accountId, search; `includeRemoved=true` for `reactivate`) → keep `id`, `displayName`, `legacy`, `updatedAt`, `canManage`, `health`, `workState`, `lastTask`. They contradict the user (e.g. "dead" but online and busy) → say so first.
2. {{tool:preview_aish_runner_management_action}}(accountId, hostId, action, expectedUpdatedAt=step 1 `updatedAt`) → keep `allowed`, `blockingReasons`, `currentStatus`, `targetStatus`, `expectedUpdatedAt`, `impact`. `allowed == false` → STOP, report (§8) `blockingReasons`, `impact` (`activeLeaseCount`, `activeCredentialCount`, `activeGrantCount`), `health`/`workState`/`lastTask`. `active-capacity-leases` → ask only: "Drain <displayName> (<hostId>) first? Its host worker takes no new jobs; the current job may finish. Then I preview <action> again once activeLeaseCount is 0." Yes → NEW P1 run, action=`drain` (own preview, own step 3).
3. [C] Show: "<action> <displayName> (<hostId>): <currentStatus> → <targetStatus>; impact: <activeLeaseCount> active leases (last task <lastTask.id>), <activeCredentialCount> credentials, <activeGrantCount> grants. Reason: "<drafted from the user's words, 8–1000 chars>" — confirm?" (`remove` → add §6 row 2.) Wait for yes. Never send a reason the user has not seen.
4. {{tool:apply_aish_runner_management_action}}(accountId, hostId, action, expectedUpdatedAt=step 2 `expectedUpdatedAt`, reason=the confirmed reason, idempotencyKey=`runner-<action>-<full hostId>-<yyyymmddHHMMss>`, confirmed=true) [C].
5. Verify: {{tool:get_aish_runner_management_overview}} → §7 lifecycle row.
6. After `drain` the step 5 row still has `workState == "busy"` → do not re-call the overview to wait; the user watches `lpm aish host monitor --project <lastTask.projectId> --host <hostId> --json` until `jobs.running == 0` and asks again. Report (§8), STOP.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no accountId | "Which AISH runner account? Run `lpm aish accounts list --json` and send me its id." |
| `remove` | "Remove <displayName> (<hostId>)? All its credentials and grants are revoked; reactivate does not restore them." |
| not funded, budget paused | STOP: "Job <jobId> is not funded or its budget is paused; funding is the owner's decision." → {{skill:lpm-ai-cost}} |
| a token, credential or `.env` value would enter chat or evidence | do not send it; redact |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| lifecycle action | {{tool:get_aish_runner_management_overview}}(accountId, search=<hostId>; `includeRemoved=true` after `remove`) | `administrativeStatus == targetStatus`; `remove`: host listed as `"revoked"` (missing = fail) |
| CLI run, evidence | {{tool:get_aish_job}}(`job.id`) | `completed`/`failed`, `evidence[]` non-empty, `execution.source == "exact-executor"` |
| onboarding, migration, MCP runner | the flow's Verify | its pass condition |
| CLI fleet command | `lpm aish fleet topology --account <accountId> --json` | new value shown |

## 8. Report (copy and fill)
Also at every STOP.
```text
Scope: <account> / <project> / host <hostId> / job <jobId>
Done: <action + ids>; <before> → <after>; migrationId <id|none> | nothing changed (preview only)
Evidence: job: evidence id <evidence[0].id>; consumption <entry id | none: CLI run records none — executor usage pending>; trace <id | none> | lifecycle: re-read administrativeStatus <value> | preview: blockingReasons <…>
Pending: <none | item — who must act>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| "active-capacity-leases" | report; offer `drain` as a question (P1 steps 2, 6); never wait in a loop |
| "idempotency key conflicts" | re-read the overview; new attempt → new key (§3) |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
