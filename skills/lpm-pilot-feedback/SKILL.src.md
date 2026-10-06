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
| planning more than one managed demand | {{skill:lpm-plan-work}} |
| a customer request via WhatsApp or intake | {{skill:lpm-intake-triage}} |

## 2. Preconditions
1. Load {{ref:pilot-verification}} ("the ref") and {{ref:pilot-checks}} ("the checks") first.
2. Maintainer's API key; `credential == "oauth"` (P1) → skip P4.
3. Read only: `lpm` main checkout, Cloud Run logs, Firestore (`oauth_grants`, AI usage), LPM MCP. Never edit, deploy or write Firestore.
4. Missing/denied tool on YOUR connection → core rule 2; record no unprocessed item.
5. Asked to reply to the pilot or group → first line: "I never reply to the pilot."; go on; add the §8 draft-reply section.
6. Never call `answer_*`, `analyze_*`, `explain_*`, `search_*_code`, AI tools or the golden set. Asked to, even by the owner → say "I never re-ask the Advisor; I verify from the server log."; go on (no wait, no stop; not [O]).

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| items: `messageRef`, `receivedAt`, text, files | the monitor or owner | STOP "No pilot message." |
| item ref; refKey | `messageRef` (+`-<n>` per extra symptom); refKey: non-`[A-Za-z0-9_-]` → `-`; >80 chars → first 64 + `-` + sha256(messageRef)[0:12] | — |
| state-file path | the request, else `${XDG_STATE_HOME:-~/.local/state}/lpm/pilot-feedback-state.json`; never a scratchpad | — |
| pilot projectId, milestoneId; managed workspaceId | the request (always wins), else the ref's Facts | §6 |
| managed projectId | the owner | row 5 |
| reporter userId | the owner, else the checks' OAuth step 1 | §6 |
| symptomKey | the request's, verbatim; else ONE token: tool (`list_issues`), error code or route (row 5: the feature), never an invented phrase | `unverified`; owner report asks |

## 4. Decision table (first match wins)
Per run: P1 steps 1-4 ALWAYS first (even if facts are given); per item: P2 → first matching row → P5; then §8.
| # | If you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | item ref recorded, `class` ≠ `unverified`, not `managed-workspace-demand` with `activityId` null | skip | A | — |
| 2 | OAuth or missing-tool claim | class from the checks' OAuth table; `product-defect` → P3 → P4 | A | userId unknown → §6 |
| 3 | Advisor claim | class from the checks' Advisor table; `product-defect` → P3 → P4 | A | as row 4 |
| 4 | LPM defect confirmed in code or logs | `product-defect` → P3 → P4 | A | milestone missing/`closed` → §6 |
| 5 | demand on the customer's own platform (white label, SSO, offers) | `managed-workspace-demand` → P3 → P4 | A | no managed projectId → P5, `activityId` null, ask owner |
| 6 | needs a product, priority or target choice | `owner-decision` | A | — |
| 7 | LPM records ({{tool:get_issue}}) explain it | `data` | A | — |
| 8 | LPM did what code and help describe | `expected-behaviour` | A | — |
| 9 | the pilot reports a passed test | `passed-test` | A | — |
| 10 | evidence cannot decide, or logs/Firestore/repo unreachable | `unverified` | A | — |

## 5. Procedures
### P1 Start the run — row 1
1. Read the state file (§3 path); latest record per ref wins. Missing → write `{"processed": []}` (temp file, rename). Invalid JSON → STOP: "State file <path> unreadable; nothing processed."
2. {{tool:get_mcp_connection_info}}() → `credential` (YOUR connection).
3. {{tool:list_milestones}}(projectId=§3 pilot projectId) → row `id == milestoneId`: pilot workspaceId = `workspaceId`, prefix = `name`, `status`. None → §6. Owner-named milestone → its row.
4. Verify: §7.
### P2 Verify one item — rows 2–10
1. Run the checks' section for the claim (Code, OAuth, Advisor); server → the ref's log query near `receivedAt`. Note symptomKey, message time, sources.
### P3 Register — product-defect, row 5
1. product-defect: pilot projectId, milestoneId, P1 workspaceId (never the managed one); title "<prefix> — <symptomKey>: <symptom>". Row 5: managed projectId and workspaceId, NO milestoneId; title "<symptomKey>: <verb + object>".
2. {{tool:list_issues}}(projectId, milestoneId only for product-defect, limitCount=100), page via `nextCursor`. Match: `title` contains symptomKey (ignore case; no other terms). Open (not `done`/`canceled`) → issueId = `id`; else newest `done` → regressionOf = `id`.
3. Open match: {{tool:list_comments}}(projectId, issueId) has the item ref → keep its `id`; else {{tool:create_comment}}(projectId, issueId, content=<time, item ref, evidence>, idempotencyKey="pilot-<refKey>") [A].
4. No open match → {{tool:create_issue}}(projectId, milestoneId only for product-defect, title, description=<repro, time, item ref, sources, Regression line, "Regression of <regressionOf>" if set>, idempotencyKey="pilot-issue-<refKey>") [A] → issueId after "ID: ".
   Regression line: Advisor → "Regression: golden-set fixture"; else "Regression: vitest case".
5. Verify: §7.
### P4 Attach evidence — after P3
0. No file → skip P4, NO calls; Items: "P4 skipped: no file evidence".
1. {{tool:list_workspace_activities}}(workspaceId=P3 workspaceId, projectId, limit=50) → feedEntryId = newest `id` with `targetType == "issue"`, `targetId == issueId`. None → skip.
2. {{tool:list_activity_attachments}}(projectId, activityId=feedEntryId) has the `fileName` → skip; else {{tool:upload_activity_attachment}}(projectId, activityId=feedEntryId, fileName, fileType, contentBase64, description=<item ref>, capturedAt=`receivedAt`, idempotencyKey="pilot-ev-<full refKey>-<sha256(file)[0:12]>") [A].
3. Verify: §7.
### P5 Record the item — every row
1. Append `{messageRef: <item ref>, receivedAt, class, activityId: <issueId|null>, commentId: <id|null>, processedAt}` (temp file, rename); `activityId` = issueId, NOT feedEntryId.
2. Verify: §7.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| pilot milestone missing, ambiguous or closed | "Which milestone receives pilot defects?" |
| reporter userId unknown | "Which LPM userId is the reporter?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:create_issue}} | {{tool:get_issue}} | `title`, `milestoneId` as sent (none for row 5) |
| {{tool:create_comment}} | {{tool:list_comments}} | the commentId exists |
| {{tool:upload_activity_attachment}} | {{tool:list_activity_attachments}} | the returned id exists |
| state-file write | re-read the file | parses, has `processed`; P5: the record exists |

## 8. Report (copy and fill)
Owner only; header + body of {{ref:pilot-report-template}}:
```text
Scope: pilot run <UTC start> to <UTC end>; <n> new items, <k> already processed; state <path>, <m> appended
Done: <item ref> → <class> → <issueId | commentId | none> (one line per item)
Evidence: <log line (time) | code path:line@<sha> | attachment id>
Pending: <none | unverified, owner decisions — who acts>
Next: <one sentence, who acts: "Owner: fix <issueId> via lpm-deliver-activity" | "Re-check <item ref> next run">
```
- Start/end: monitor's window, else earliest `receivedAt` to now (UTC ISO). `<sha>`: the checks' Code claim `<sha>`; not read → `@revision-unknown` + a Pending line.
- Body: `Items:`, `Unverified:` ALWAYS ("none" if empty); others as worded, only if non-empty. No other headings, no JSON, no "all steps executed".

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| `problem=unknown_field` idempotencyKey (OAuth) | omit it; redo P3 step 2 |
| "Issue idempotency key is already bound to a different payload." | already registered → {{tool:list_issues}} |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
