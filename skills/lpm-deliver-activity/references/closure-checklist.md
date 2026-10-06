# Closure checklist
Load when: before setting an activity to status done
Applies to: lpm-deliver-activity    Source: process-rules (closure pattern, evidence); cards {{tool:update_issue}}, {{tool:upload_activity_attachment}}, {{tool:list_activity_attachments}}, {{tool:audit_aish_issue_delivery}}; help `lpm-activity-commit-linking`

## Summary
Close an activity only after this pattern is complete: correction → reproducible test → registered evidence → approved result or specific pending item → next step.
Each acceptance criterion needs evidence: an attachment listed by {{tool:list_activity_attachments}}, or, for a test criterion, a recorded test result (test → result, in a comment or reported by the user). A commit with `LPM-Activity: <issueId>` is evidence of work, not closure.
Factory-governed issues (`factoryGovernance` set) also need a current `passed` {{tool:audit_aish_issue_delivery}}.
Anything missing → the activity stays `in-progress`: the closure comment names the pending item and who must act, and you never set `done`.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| issue `status`: `backlog`, `todo`, `in-progress`, `done`, `canceled` | the only valid statuses | never send `blocked`; with an API key a misspelled value is stored as is |
| `blockerContext.status == "active"` | an external blocker is recorded | do not close; go to {{skill:lpm-unblock-work}} |
| `blocks` link with `targetIssueId == issueId` (or legacy `is-blocked-by` with `sourceIssueId == issueId`) and a blocker whose `status` is not `done`/`canceled` | upstream work is not finished | do not close; go to {{skill:lpm-unblock-work}} |
| `factoryGovernance` set | AISH factory issue (`factory-dod/1`) | `done` fails with "Factory Definition of Done is missing, blocked or stale." until the audit passes |
| audit `status == "blocked"` | normal result, not an error | read `failures[]`; fix through {{skill:lpm-aish-delivery}} |
| edit of title/description of a done factory issue | rejected: "Reopen and audit the changed delivery scope before closing." | set `in-progress` first, then audit |
| `completedAt` | set by the server on `done`, cleared on reopen | do not send it |
| feed entry `hasEvidence` / `attachmentCount` | evidence flags on the activity-log entry | a delete can drop them to zero: re-check before closing |
| {{tool:list_activity_attachments}} on an issue's feed entry | returns the files of every feed entry of that issue | one call per issue is enough |
| commit trailer `LPM-Activity: <issueId>` | the push webhook comments commit links | it is not an attachment and not closure |
| build / deploy / smoke | three different facts | claim only what you ran: a build is not a deploy, a deploy is not a smoke |

### Evidence per work type
| Work type | Evidence before `done` |
|---|---|
| UI change, browser smoke, Playwright | one screenshot (`image/png` or `image/jpeg`) per changed view or role, listed as an attachment; add a 390x844 one only when the mobile layout changes |
| bug fix | failing → passing test result (a comment or the user's report: test → result; a `text/plain` attachment when you have the output file) |
| backend or API change | test result (as above); the API contract diff when the API changed |
| deploy or rollout | revision id + smoke output |
| analysis, report or document | the report or document file |
| test run or incident | sanitized report or log, commit/revision, environment, acceptance result |
| factory (AISH) issue | audit `passed`; its DoD needs per change type: visual = screenshot + video, backend = test, documentation = document, operations = runbook + test or log (AISH delivery artifacts, owned by {{skill:lpm-aish-delivery}}) |
| connector session (no evidence tools) | a comment with links + "Evidence pending: API key or web UI"; the activity stays open |

## Rules
1. Acceptance criteria = {{tool:get_issue}} `description` (and its `requirementId`) plus the acceptance notes in {{tool:list_comments}}. None → ask "What are the acceptance criteria for <issueId>?".
2. Each criterion needs an attachment listed by {{tool:list_activity_attachments}} or a recorded test result (comment or user report: test → result). A recorded test result counts: do not ask for a `text/plain` file; attach test output as `text/plain` only when you have the file.
3. A criterion without either → send the SKILL.md §8 report, then ask "Keep <issueId> open with pending item <criterion> (owner <owner>)? (yes/no)" (`<owner>` = issue `assigneeId`, else a person or role named in the issue or comments, else "you"). "yes" → closure comment naming the item and its owner; the activity stays `in-progress`; never set `done`.
4. Attach files that let a human recreate the result. Local paths and chat text never prove a UI or visual criterion: it needs a listed screenshot. A test result (test → result) recorded in a comment or reported by the user does count for a test criterion.
5. Never attach secrets, tokens or personal data; redact first.
6. Long logs (over 20,000 chars) go in an attachment, never in a comment.
7. Post the closure comment before the status move, with idempotencyKey `close-<issueId>-<n>` (`<n>` = 1 + your earlier closure comments on the issue); reuse it only for a retry of the same text.
8. Move to `done` only after rules 1–7 pass with no pending item and, for factory issues, the audit returned `passed`.
9. After `done`, re-read with {{tool:get_issue}}, {{tool:list_activity_attachments}} and {{tool:list_comments}} before reporting ({{ref:flow-close}} step 11).

## Examples
```text
example: closure comment
Closure check for <issueId> <title>
Correction: <what changed> (commits <sha> <subject>)
Test: <test or command> → <result, e.g. 12/12 passed>
Evidence: <fileName> (id <attachmentId>) proves <criterion>
Result: acceptance criteria met | pending: <criterion> — <owner>
Next: <one action>
```
```text
example: pending report
Pending: screenshot of the admin view — usr_ana (assignee) must capture it
Next: attach it, then re-run the closure check
```
