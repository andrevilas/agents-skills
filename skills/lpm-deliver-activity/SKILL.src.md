# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "implementa a atividade <id>", "fix bug <issueId>", "pick the next activity and do it"
- "registre o progresso na atividade", "comenta na atividade", "anexa o print / test report"
- "posso fechar esta atividade?", "close the activity with evidence", "apaga o comentário duplicado"
Do not use:
| If the request is about | Use |
|---|---|
| many activities, owners, dates | {{skill:lpm-plan-work}} |
| a blocker or a dependency | {{skill:lpm-unblock-work}} |
| work on AISH runners | {{skill:lpm-aish-jobs}} |
| AISH delivery artifacts or a DoD audit | {{skill:lpm-aish-delivery}} |
| WhatsApp or protocol evidence | {{skill:lpm-intake-triage}} |
| shipping the LPM product itself | {{skill:lpm-release-product}} (LPM maintainers only) |

## 2. Preconditions
1. Connector ({{tool:get_mcp_connection_info}} → `credential == "oauth"`): only rows 1–4; attach and close → row 3. Rows 5–7 need an API key (`full`/`custom` for deletes and audit).
2. Code in a git repo → {{ref:repo-hygiene}}: use a worktree; never edit a deploying checkout; before push run the checks in `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md`.
3. Read-only request or a question ("posso fechar?") → no write before "yes".

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| projectId | user, {{skill:lpm-start}} §3, or row 1 → `recommendation.projectId` | ask |
| workspaceId | {{tool:get_issue}} → `workspaceId` (fallback {{skill:lpm-start}} §3) | ask |
| issueId | user, `.lpm-activity`, row 1, or {{tool:list_issues}}(projectId, limitCount=50, cursor=`nextCursor` while `hasMore`) → `id` by title | 0 or 2+ → ask |
| activityId (feed entry, never the issueId) | {{tool:list_workspace_activities}} → newest `id` with `targetId == issueId` | {{ref:flow-evidence}} step 2 |
| coding rules (API key only) | {{tool:get_skills_context}}(projectId) → `instructions`, `toolingNotes` | skip |
| attachment item, commentId | {{tool:list_activity_attachments}} → item `id`, `activityId`; {{tool:list_comments}} → `id` | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | pick the next activity | {{tool:recommend_next_activity}}(projectId) → `recommendation.issueId`, `recommendation.projectId` (use it from now on) → P1 on "yes" | A | null → STOP "no actionable activity" |
| 2 | start or continue an activity | P1 | A | `blockerContext.status == "active"` → {{skill:lpm-unblock-work}} |
| 3 | attach or close on a connector (Precondition 1) | {{tool:get_issue}} → {{tool:create_comment}}(links + "Evidence pending: API key or web UI") | A | never claim evidence; never set `done` |
| 4 | commit code / record progress or a comment | P2 | A | issueId unknown → ask or omit the trailer |
| 5 | attach proof (print, log, report) | {{ref:flow-evidence}}: {{tool:list_workspace_activities}} → {{tool:list_activity_attachments}} (always, before upload) → {{tool:upload_activity_attachment}} once → {{tool:list_activity_attachments}} | A | secret in the file → §6; -32003 or `oauth` → row 3 |
| 6 | finish / close the activity | {{ref:flow-close}} (closure check; a question → its Precondition 3) | A | -32003 or `oauth` → row 3; a criterion with no evidence → §6 |
| 7 | remove or fix a comment or attachment | §6 text → {{tool:delete_comment}}(projectId, issueId, commentId) / {{tool:update_comment}}(projectId, issueId, commentId, content) / {{tool:delete_activity_attachment}}(projectId, activityId=item `activityId`, attachmentId=item `id`) | C | not named by the user or not yours; `oauth` → STOP "needs an API key" |

## 5. Procedures
### P1 Start — rows 1, 2
1. {{tool:get_issue}}(projectId, issueId) → keep `status`, `blockerContext`, `workspaceId`.
2. {{tool:list_comments}}(projectId, issueId) → keep acceptance and pending notes.
3. `blockerContext.status == "active"` → STOP → {{skill:lpm-unblock-work}}.
4. Code work → read the coding rules (§3).
5. `status` is `done`/`canceled` → §6 reopen question; "no" → STOP.
6. `status` is not `in-progress` → {{tool:update_issue}}(projectId, issueId, status="in-progress") [A].
7. Verify: {{tool:get_issue}} → `status == "in-progress"`.
### P2 Commit and progress — row 4
1. {{tool:get_issue}}(projectId, issueId); not found → §6 "no issueId". User asked only for a comment → step 4.
2. `git commit` [A]: subject, blank line, body (change + test result), blank line, last line `LPM-Activity: <issueId>`. Trailer missing: not pushed → `git commit --amend`; pushed → say so in the comment.
3. Push only when asked and the Precondition 2 checks pass (the webhook comments after a push).
4. {{tool:create_comment}}(projectId, issueId, content=Progress template of {{ref:comment-templates}}, Pending = push not done, evidence not attached, idempotencyKey="progress-<issueId>-<yyyymmdd>-<n>") [A]; `<n>` = 1 + your progress comments of today ({{tool:list_comments}}).
5. Verify: `git log -1 --format=%B` has the trailer; {{tool:list_comments}} has the commentId with your text.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no issueId | "Which LPM activity is this for? (id or title)" |
| a criterion lacks evidence | only "Keep <issueId> open with pending item <criterion> (owner <owner>)? (yes/no)"; owner = `assigneeId`, a named role, or "you". "yes" → stays `in-progress`. Never offer to close or drop it |
| done/canceled activity to work on | "Reopen <issueId> (set in-progress)? (yes/no)" |
| secret in the file | do not upload; redact first |
| delete or edit a comment or attachment | "Remove <name> (id <id>) from <issue>? It cannot be restored." / show the new text |
| scope or roadmap change | a comment is not a decision → {{skill:lpm-governance-decisions}} |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| status move | {{tool:get_issue}} | `status` is the requested value |
| comment write | {{tool:list_comments}} | the id has the new `content` (gone after delete) |
| attachment write | {{tool:list_activity_attachments}} | before: `fileName` not listed; after: the returned id exists (gone after delete) |
| factory audit | its result | `status == "passed"` |
| commit | `git log -1 --format=%B` | contains `LPM-Activity: <issueId>` |

## 8. Report (copy and fill)
User's language; fill every slot. Before a §6 question send it first, the question last.
```text
Scope: <workspace>/<project>/<issueId> <title>
Done: <correction>, <sha subject>, <comment ids>, <attachment ids>, status <status>
Evidence: <fileName (attachment id)> on <activityId> proves <criterion>; <test → result>
Pending: <none (closure check passed) | criterion — owner>
Next: <one action, owner | none — activity closed>; claim no deploy/smoke you did not run
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| "Activity <id> not found" | you passed the issueId → resolve activityId (§3) |
| "Factory Definition of Done is missing, blocked or stale." | {{tool:audit_aish_issue_delivery}} → `blocked` → {{skill:lpm-aish-delivery}} |
| comment id shows other text | key reused; post again with `<n>` + 1 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
