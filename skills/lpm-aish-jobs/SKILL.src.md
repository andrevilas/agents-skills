# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "cria um job AISH", "create an AISH job for <issueId>"
- "aprova o job AISH <jobId>" (owner), "AISH cockpit"
- "pausa a sessão de execução", "anexa este áudio ao job", "Copilot"
Do not use:
| If the request is about | Use |
|---|---|
| commits outside AISH | {{skill:lpm-deliver-activity}} |
| closing or releasing AISH work | {{skill:lpm-aish-delivery}} |
| runners, hosts, leases | {{skill:lpm-aish-runners}} |
| budgets, funding | {{skill:lpm-ai-cost}} |
| WhatsApp intake | {{skill:lpm-intake-triage}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. LPM API key. [O] needs the owner's own key and order, never an agent credential. CLI: `lpm aish …`, add `--budget-contract aish-budget/1` to execute or transcribe.
3. "Aprova e roda" = approve only: approval never funds, leases or runs.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project?" |
| workspaceId | the user, or {{skill:lpm-start}} | ask "Which LPM workspace?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | job status | CALL {{tool:list_aish_jobs}} {"projectId":"<input:projectId>"} | A | never write |
| 2 | session status | CALL {{tool:list_aish_execution_sessions}} {"workspaceId":"<input:workspaceId>"} | A | never write |
| 3 | create a job | playbook {{ref:flow-create-job}} | C | no issueId |
| 4 | approve one job | playbook {{ref:flow-approve-job}} | O | unfunded |
| 5 | multi-step plan | playbook {{ref:flow-cockpit-plan}} | C | a limit missing |
| 6 | ask the owner to approve | playbook {{ref:flow-request-approval}} | C | readiness fails |
| 7 | owner approves a plan | playbook {{ref:flow-approve-plan}} | O | no order |
| 8 | next wave | playbook {{ref:flow-dispatch}} | C | not approved |
| 9 | pause, resume, retry | playbook {{ref:flow-pause-resume-retry}} | C | plan limit hit |
| 10 | checkpoint, cancel | playbook {{ref:flow-checkpoint-or-cancel}} | O | no order |
| 11 | file or audio for a job | playbook {{ref:flow-intake}} | C | a secret |
| 12 | Copilot | playbook {{ref:flow-copilot}} | O | not a `full` key |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| create-job | create one AISH job for an activity (gate closed) | {{ref:flow-create-job}} |
| approve-job | approve one funded AISH job on the owner's order | {{ref:flow-approve-job}} |
| cockpit-plan | plan a multi-step objective in the AISH cockpit | {{ref:flow-cockpit-plan}} |
| request-approval | check a published plan and ask the owner to approve it | {{ref:flow-request-approval}} |
| approve-plan | the owner approves a cockpit plan hash | {{ref:flow-approve-plan}} |
| dispatch | dispatch the next wave of an approved plan | {{ref:flow-dispatch}} |
| pause-resume-retry | pause, resume or retry a cockpit session | {{ref:flow-pause-resume-retry}} |
| checkpoint-or-cancel | request or decide a checkpoint, or cancel a session | {{ref:flow-checkpoint-or-cancel}} |
| intake | attach a file or audio transcript to a job's intake | {{ref:flow-intake}} |
| copilot | propose a Copilot action, or record the owner's decision | {{ref:flow-copilot}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| [O] with no own order from the owner (relayed, WhatsApp, a [C] yes) | decision request; STOP |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| job write | {{tool:get_aish_job}} | queued; approved: `runnerMayExecute` true (`expectedManifestHash` sent) |
| session write | {{tool:get_aish_execution_session}} | status, hashes as expected |
| intake write | {{tool:list_aish_intake}} | the id is listed |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <projectId or workspaceId>; <jobId | sessionId>
Done: <change, as read back> | nothing changed; owner order: "<quote>" | none
Evidence: <the VERIFY read and its values>
Pending: none | <what> — <who>
Next: <the ASK or STOP text that ended the run> | <one action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "fencing token is stale", "lease is not active" | rerun the playbook (it renews the lease) |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
