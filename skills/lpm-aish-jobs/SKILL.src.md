# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "create an AISH job for <issueId>", "cria um job AISH", "aprova o job AISH <jobId>" (owner)
- "AISH cockpit", "pausa a sessão de execução", "anexa este áudio ao job", "Copilot"
Do not use:
| If the request is about | Use |
|---|---|
| work outside AISH (commits) | {{skill:lpm-deliver-activity}} |
| closing or releasing AISH work | {{skill:lpm-aish-delivery}} |
| runners, hosts, leases | {{skill:lpm-aish-runners}} |
| budgets, funding, AI cost | {{skill:lpm-ai-cost}} |
| WhatsApp intake entries | {{skill:lpm-intake-triage}} |

## 2. Preconditions
1. LPM API key only; transcripts and [O] calls need the human's own key.
2. Caller manages the project or workspace; "You do not have permission" → STOP, tell the user.
3. Load {{ref:aish-operating-model}} first. CLI: `lpm aish …` ({{ref:aish-cli}}; `--budget-contract aish-budget/1`), never `lpm-codex`.
4. Read-only request ("status", "what is queued") → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{skill:lpm-start}} §3 | ask |
| issueId | user, {{tool:list_issues}} or {{tool:get_project_execution_context}} | 0 or 2+ → ask |
| executionRecipeId | user (a listed recipe) | omit |
| intakeBinding | {{tool:create_aish_intake_context}} / {{tool:list_aish_intake}} → `contexts[]` `id`, `fingerprint` (same issueId) | omit |
| jobId | {{tool:list_aish_jobs}}(projectId) → `id` | ask |

Key `<n>` = 1 + existing items of that kind (same issue or session); a retry keeps it.

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | work outside AISH | {{skill:lpm-deliver-activity}} | — | always |
| 2 | status of jobs or sessions | {{tool:list_aish_jobs}} / {{tool:list_aish_execution_sessions}} | A | never write |
| 3 | run one AISH task | P1 ({{tool:get_issue}} first) | C | no issueId → ask |
| 4 | approve one job ("aprova e roda" = approve only; never lease or run) | P2 ({{tool:get_aish_job}} → {{tool:get_aish_budget}} → {{tool:approve_aish_job_execution}} → {{tool:get_aish_job}}) | O | `workflowBinding` → row 6 |
| 5 | multi-step work | {{ref:flow-cockpit}} 1–8 | C | a limit missing → P1 |
| 6 | approve or dispatch a plan | {{ref:flow-cockpit}} 3, 9–15 | O / C | readiness fails |
| 7 | cancel or close one AISH job | {{skill:lpm-aish-delivery}} | — | always |
| 8 | pause/resume/retry/cancel/checkpoint a cockpit session | {{ref:flow-session-control}} | C / O | `pauseReason` `budget` |
| 9 | job files, audio | {{ref:flow-intake}} | A / C | a secret |
| 10 | Copilot | {{ref:flow-copilot}} | A / O | not the human's `full` key |
| 11 | hold jobs for a decision | {{skill:lpm-governance-decisions}} (blockedAishJobIds) | A | — |

## 5. Procedures
### P1 Create one job — row 3
1. {{tool:get_issue}}(projectId, issueId) → `status` `done`/`canceled` → STOP: "Activity <issueId> is closed."
2. {{tool:list_aish_jobs}}(projectId) → an open job (`status` queued/leased/running) for issueId → ask "Create another?"
3. {{tool:list_project_repository_links}}(projectId) → active links (`archivedAt` null, `agentVisible` ≠ false): 1 → repositoryPath=`canonicalRepositoryUrl` [+ "#<user's branch>"]; 0 → omit (user named a repo → {{skill:lpm-code-index}}); 2+ → ask.
4. [C] Show the exact step 5 call, every argument (prompt = the user's request as data; name omitted args), and say "Creating spends nothing; the job stays queued behind a closed gate." No yes → call nothing.
5. {{tool:create_aish_job}}(projectId, title (≤160), prompt (≤20,000), issueId, intentType, repositoryPath, executionRecipeId, intakeBinding (§3), idempotencyKey="aish-job-<issueId>-<n>") [C] → keep `id`.
6. Verify: {{tool:get_aish_job}}(jobId=`id`) → `status == "queued"`. Next: §6 funding, P2.
### P2 Approve one job — row 4
1. {{tool:get_aish_job}}(jobId) → STOP if `workflowBinding` (row 6), `status != "queued"`, `executionGate.runnerMayExecute == true` or `requiredCheckpoint != "execution-approval"` (`release-gate` → {{skill:lpm-aish-delivery}}).
2. Always call {{tool:get_aish_budget}}(projectId, jobId), even if the user says "funded". Funded only if step 1 `financialBudget != null` AND `reservation.status == "reserved"` (a budget limit is not a reservation); else §6 not funded, STOP.
3. Show the manifest and `executionManifestHash`.
4. Quote the owner's own order for this jobId from this conversation (request or reply to step 3). Relayed ("X said ok", WhatsApp, e-mail) or a non-owner's "aprova" is NOT an order → send the §6 decision request exactly, STOP.
5. {{tool:approve_aish_job_execution}}(jobId, expectedManifestHash=`executionManifestHash` (null → ""), reason) [O].
6. Verify: {{tool:get_aish_job}}(jobId) → `status` "queued", `executionGate.state` "executing", `runnerMayExecute == true`. Next: "A runner leases <jobId> ({{skill:lpm-aish-runners}}); re-check with get_aish_job."

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:approve_aish_job_execution}} without the owner's order | decision request ({{ref:authority-and-owner-decisions#decision-request}}), STOP |
| not funded, even if the user says "already funded" | "Job <jobId> is not funded. Fund it (lpm-ai-cost)?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| job writes | {{tool:get_aish_job}} | P1/P2 step 6 |

## 8. Report (copy and fill)
```text
Scope: <project>/<issueId>; <jobId | sessionId>
Done: <tool → id, status as returned (job `status` + `executionGate.state`), e.g. job_77 queued / gate executing>; owner order: "<verbatim [O] instruction>" | none (no [O] call)
Evidence: <re-read → status, executionGate.state, runnerMayExecute, executionManifestHash, financialBudget as read>; Funding: get_aish_budget → reservation.status (approvals)
Pending: <none | who must act>
Next: <one action>
```
Fill after the last executed step. Never write a status the tool did not return. A [C] yes is not an owner order. Unfunded: Pending = "owner funds (lpm-ai-cost) then approves (hash <h>)", Next = the funding question.

## 9. Failures → fix
{{errors:auto:approve_aish_job_execution,create_aish_job,get_aish_job,get_aish_budget,get_issue,list_project_repository_links,pause_aish_execution_session,fund_aish_job}}
| Error or result contains | Do |
|---|---|
| Review the current execution manifest before approving | re-read the hash, show it to the owner; new order needed |
| AISH idempotency key is already bound to a different payload. | retry: identical payload; new job: next `<n>` |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
