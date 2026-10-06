# Plan and organize project work
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: "cria estas atividades", "o que está atrasado?", sprints (incl. closing), owners, dates.
Do not use:
| If the request is about | Use |
|---|---|
| doing or closing one activity (`done`) | {{skill:lpm-deliver-activity}} |
| blocked work, dependency links | {{skill:lpm-unblock-work}} |
| health or risk report | {{skill:lpm-review-health}} |
| new project, members, teams | {{skill:lpm-workspace-admin}} |
| requirements, baselines, scope | {{skill:lpm-requirements-scope}} |
| governance thread or decision | {{skill:lpm-governance-decisions}} |
| activities materializing a roadmap item | {{skill:lpm-roadmap-owner-ops}} |
| roadmap items, cross-project outcomes | {{skill:lpm-roadmap}} |

## 2. Preconditions
1. Connector: `null` never clears a field. Read-only request → no write tool. Planning never replaces a baseline/approval.
2. Setting `assigneeId`, `dueDate` or `estimate` of an existing activity, or a milestone `targetDate`, is [C] with any tool: plan table, wait for "yes".
3. Profiles: planning runs all rows but 6, 8, 9 and deletes (full/custom; row 9 also requirements). Connector: the Access rows, plus row 3 estimates/dates.
4. `idempotencyKey` only on {{tool:batch_issue_operations}}, {{tool:create_comment}} (card: `idempotencyKey supported`); never invent one (create_issue, bulk tools).

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| projectId | {{skill:lpm-start}} §3 | ask |
| issueId | user, or {{tool:list_issues}} → `items[].id` | ask |
| cycleId, milestoneId, labelId, assigneeId, recipient userId | rows 2–6 flows | 0 / 2+ → ask |
| titles, estimates, dates, threadId | user; dates `YYYY-MM-DD` | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | daily sync, "what is next" | {{tool:get_project_execution_context}} → {{ref:planning-rules}} § Daily sync | A | no writes unless the user asks |
| 2 | cycle (sprint) / milestone (marco): open, start, close, delete, dates, moving activities; `active` past `endDate` | {{ref:flow-cycles}} | A / C | opening one without user-given dates |
| 3 | owner, estimate or due date (prazo) on 1+ activities; their queues | {{ref:flow-owners-dates}} | C | plan not approved |
| 4 | labels (also on activities) | merge → {{ref:flow-label-merge}}; else {{tool:list_labels}} → {{tool:create_label}} / {{tool:update_label}} / {{tool:update_issue}}(labelIds: {{tool:get_issue}} ids + new) | C | keeper not named; equivalent → reuse |
| 5 | escalate date, blocker, stale item | {{tool:get_issue}} → {{tool:create_comment}} ({{ref:flow-escalate}}) | A | no issueId |
| 6 | notify a person the user named | {{ref:flow-escalate}} → {{tool:create_notification}} | C | no recipient |
| 7 | cancel an activity | {{ref:flow-remove}}: {{tool:get_issue}} → {{tool:update_issue}}(status="canceled") | A | its step 2 |
| 8 | delete an activity | {{ref:flow-remove}} → {{tool:delete_issue}} | C | not confirmed |
| 9 | activity a governance thread decided | {{ref:flow-decision}} | A | outcome ≠ create-activity → {{skill:lpm-governance-decisions}} |
| 10 | create activities | P1 | A | P1 step 1 |
| 11 | edit title, description, priority or status | P1 | A | `done` → §6 |

Owner/estimate/due date → row 3 (never 10/11); cycle/milestone moves → 2; labels → 4; cancel → 7; delete → 8.

## 5. Procedures
### P1 Create or edit activities — rows 10, 11
1. Creates: {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` → same title (lowercase, trimmed) exists → ask "Skip, or create anyway?"; skipped → Pending.
2. Every item, even with user-given titles: `title` verb-first in the user's language ("cálculo de juros do parcelamento" → "Implementar cálculo de juros do parcelamento"; bug → "Corrigir …"). `description` always = what will be done + "Critérios de aceite:" list (user's words, else the result the title promises). arguments = projectId, title, description + only fields the user gave (ids from §3). Never `done`. Connector: no `assigneeId`.
3. Edits: {{tool:get_issue}}(projectId, issueId) → `done` → §6; send only changed fields.
4. One → {{tool:create_issue}}(step 2 arguments) [A] → id after "ID: " (re-list before retry) / {{tool:update_issue}}(projectId, issueId, fields) [A].
5. 2+ → ≤ 25 items per call [A] ({{ref:batch-and-bulk}}): `batch_issue_operations(idempotencyKey="plan-<projectId>-<yyyymmdd>-<n>", stopOnError=true, operations=[{tool:"create_issue", arguments:{projectId, title, description, priority}}, ...])`. `failed` or `skipped` > 0 → fix per `items[].error`, resend only those with a NEW key; else Pending.
6. Verify: step 1 re-list → each title once; edits → {{tool:get_issue}} equals the plan.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| an activity's status `done` or activity closure | STOP → {{skill:lpm-deliver-activity}} (cycle/milestone close: row 2) |
| a scope doubt | STOP → {{skill:lpm-governance-decisions}} |
| 0 or 2+ assignable members match a name | "Which person: <displayName> (<email>) or <displayName> (<email>)?" Never show `hourlyRate`, `currency`, `directoryOrigins`; never pick yourself |
| label create, rename, delete | "Labels are universal: this affects every workspace on the platform. Proceed? (yes/no)" |
| any delete | "Delete <name> (<id>)? No undo. Prefer canceled / completed / closed. (yes/no)" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| activity, label, comment | {{tool:get_issue}}, {{tool:list_labels}}, {{tool:list_comments}} | equals the plan |
| notification | not re-readable | report id as unverified; no retry |
| rows 2–9 | flow § Verify | as stated |

## 8. Report (copy and fill)
```text
Scope: <project, cycle or milestone>
Done: <ids + titles, changed fields>
Evidence: re-list: planned N, found N, failed N
Pending: <none | item — error — who must act>
Next: <one action>
```
In the user's language. Pending: every failed or skipped item + error; never "none" when failed/skipped/`failedCount` > 0.
Row 1: Done = the planning-rules sync line; governance items listed, not decided.

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|

## 10. Tools and references
{{tools:index}}
{{refs:index}}
