# Playbook: verify-item
Use when: classifying one pilot report (after start-run, per item)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| messageRef | the monitor or owner | STOP. Say: "No pilot message." |
| receivedAt | the item | STOP. Say: "When was this message received? (ISO 8601)" |
| text | the item's text | STOP. Say: "What did the pilot report?" |
| files | the item's attached files (may be empty) | "none" |
| processed | start-run's saved state | STOP. Say: "Run start-run first." |
| credential | start-run's saved credential | STOP. Say: "Run start-run first." |

## Steps
1. SAVE: refKey = <input:messageRef> with non-`[A-Za-z0-9_-]` replaced by `-`; if >80 chars use first 64 + `-` + sha256(messageRef)[0:12]; for extra symptoms in one message append `-<n>`
2. IF <saved:refKey> exists in <input:processed> with class not unverified, and not managed-workspace-demand with activityId null → SAVE: class = that record's class; go to Answer.
3. SAVE: claimType = the type from <input:text> (OAuth, missing-tool, Advisor, code, demand, other); run the loaded pilot-checks section for <saved:claimType>, query the server log near <input:receivedAt>; symptomKey = the request's verbatim key, else ONE token (tool name, error code or route), fallback unverified; sources = log lines, code paths, record ids found
4. SAVE: class = the first matching class from the decision table rows (product-defect, managed-workspace-demand, owner-decision, data, expected-behaviour, passed-test, unverified)

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: item <input:messageRef> (<input:receivedAt>)
Done: classified as <saved:class> [<saved:symptomKey>]
Evidence: <saved:sources>
Pending: none
Next: <product-defect or managed-workspace-demand: continue to playbook register | else: continue to playbook record>
```
Never claim a class that step 3 and step 4 did not determine from pilot-checks evidence.
