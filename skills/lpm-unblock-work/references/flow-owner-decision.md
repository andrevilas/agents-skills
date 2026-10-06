# Flow: owner decision
Load when: decision row 7 of SKILL.md (a blocker that needs a scope or business decision of the owner)

## Preconditions
1. Scope, priority and business choices belong to the owner (GOV-MAX v1). This flow records and escalates the decision; it never takes it.
2. `draft` fields and `readyToCreate` meaning: {{ref:link-or-context-or-thread}}.

## Steps
1. Run SKILL.md P3 with the text "Waiting for an owner decision: <question>".
2. {{tool:prepare_governance_thread_from_blocker}}(projectId, issueId, content=<options, recommendation>) → keep `readyToCreate`, `blockingReasons`, `draft`.
3. {{tool:create_comment}}(projectId, issueId, content=<question, options>, idempotencyKey="decision-<issueId>-<yyyymmdd>-<n>") [A]. Threads never target activities.
4. Verify: {{tool:list_comments}}(projectId, issueId) → the comment id is listed with your text; other text → the key was used before: retry with `<n>`+1 (SKILL.md §3).
5. `readyToCreate == true` → Next: {{skill:lpm-governance-decisions}} ({{tool:create_governance_thread}} from `draft`). False → the comment is the record; report `blockingReasons`.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| the user asks you to choose the scope | say "Scope is the owner's decision (GOV-MAX v1)."; run steps 1–5 and STOP |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| step 1 ({{tool:set_project_issue_blocker_context}}) | {{tool:get_issue}}(projectId, issueId) | `blockerContext.status == "active"` |
| {{tool:create_comment}} | {{tool:list_comments}}(projectId, issueId) | comment id exists and its content is your text |

## Report fields
Scope, issueId, blocker context text, comment id, `readyToCreate` (+ `blockingReasons` when false), Next ({{skill:lpm-governance-decisions}} or the owner).
