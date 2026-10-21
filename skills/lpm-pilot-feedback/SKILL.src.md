# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- the monitor hands over pilot messages; "verify the pilot's new reports"
Do not use:
| If the request is about | Use |
|---|---|
| fixing, deploying, announcing a pilot fix | {{skill:lpm-release-product}} |
| coding a registered pilot fix | {{skill:lpm-deliver-activity}} |
| planning many managed demands | {{skill:lpm-plan-work}} |
| a customer request via WhatsApp or intake | {{skill:lpm-intake-triage}} |

## 2. Preconditions
1. Load {{ref:pilot-verification}} and {{ref:pilot-checks}} first.
2. Playbook row: open its file, do its steps in order, reply with its Answer block only.
3. Maintainer's API key; `credential == "oauth"` (start-run) → skip attach-evidence.
4. Read only: `lpm` checkout, Cloud Run logs, Firestore (`oauth_grants`, AI usage), LPM MCP. Never edit, deploy or write Firestore.
5. Missing/denied tool on YOUR connection → core rule 2; record no unprocessed item.
6. Asked to reply to the pilot → first line: "I never reply to the pilot."; add §8 draft-reply.
7. Never call `answer_*`, `analyze_*`, `explain_*`, `search_*_code`, AI tools or the golden set. Asked to → "I verify from the server log."; go on (not [O]).

## 3. Inputs
| Input | Where | If missing |
|---|---|---|
| items: `messageRef`, `receivedAt`, text, files | the monitor or owner | STOP "No pilot message." |
| refKey | from `messageRef`; non-`[A-Za-z0-9_-]` → `-`; >80 → first 64+`-`+sha256[0:12] | — |
| state-file path | the request, else `${XDG_STATE_HOME:-~/.local/state}/lpm/pilot-feedback-state.json` | — |
| pilot projectId, milestoneId | the request, else the ref's Facts | §6 |
| managed projectId, workspaceId | the owner | row 2 |
| reporter userId | the owner, else the checks' OAuth step 1 | §6 |
| symptomKey | verbatim; else ONE token (tool, error code, route) | `unverified` |

## 4. Decision table (first match wins)
Per run: {{ref:flow-start-run}} first. Per item: {{ref:flow-verify-item}}, then first matching row, then {{ref:flow-record}}; then §8.
| # | If you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | product-defect (OAuth, Advisor or code) | playbook {{ref:flow-register}} | A | milestone/userId missing → §6 |
| 2 | managed-workspace-demand | playbook {{ref:flow-register}} | A | no managed projectId → record null, ask owner |
| 3 | other class (owner-decision, data, expected-behaviour, passed-test, unverified) | playbook {{ref:flow-record}} | A | — |

After register: playbook {{ref:flow-attach-evidence}}, then {{ref:flow-record}}. Already-processed items are skipped by verify-item.

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| start-run | beginning a pilot run (always first, before any item) | {{ref:flow-start-run}} |
| verify-item | classifying one pilot report (after start-run, per item) | {{ref:flow-verify-item}} |
| register | creating or updating an activity for confirmed items (product-defect or managed-workspace-demand) | {{ref:flow-register}} |
| attach-evidence | attaching file evidence after registration | {{ref:flow-attach-evidence}} |
| record | recording the item in the state file (always last, per item) | {{ref:flow-record}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| milestone missing or closed | "Which milestone receives pilot defects?" |
| reporter userId unknown | "Which LPM userId is the reporter?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:create_issue}} | {{tool:get_issue}} | `title`, `milestoneId` as sent |
| {{tool:create_comment}} | {{tool:list_comments}} | the commentId exists |
| {{tool:upload_activity_attachment}} | {{tool:list_activity_attachments}} | the returned id exists |
| state-file write | re-read the file | parses, has `processed`; record: the entry exists |

## 8. Report (copy and fill)
Owner only; fill {{ref:pilot-report-template}}.
```text
Scope: pilot run <start> to <end>; <n> new, <k> processed
Done: <item ref> → <class> → <issueId | commentId | none>
Evidence: <log line | code path@<sha> | attachment id>
Pending: <none | unverified — who acts>
Next: <who acts next>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| `problem=unknown_field` idempotencyKey (OAuth) | omit it; redo register step 2 |
| "Issue idempotency key is already bound to a different payload." | already registered → {{tool:list_issues}} |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
