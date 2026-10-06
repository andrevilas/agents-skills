# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "implementa a atividade <id>", "fix bug <issueId>", "pick the next activity"
- "registre o progresso", "anexa o print / test report"
- "posso fechar esta atividade?", "apaga o comentário duplicado"
Do not use:
| If the request is about | Use |
|---|---|
| many activities, owners, dates | {{skill:lpm-plan-work}} |
| a blocker or a dependency | {{skill:lpm-unblock-work}} |
| AISH runner work / closing an AISH factory activity | {{skill:lpm-aish-jobs}} / {{skill:lpm-aish-delivery}} |
| WhatsApp or protocol evidence | {{skill:lpm-intake-triage}} |
| shipping the LPM product itself | {{skill:lpm-release-product}} (LPM maintainers only) |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Code in a git repository → {{ref:repo-hygiene}}: worktree, never edit a deploying checkout, run the checks in `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md` (the playbooks hold these steps).
3. A question ("posso fechar?") → reads only until the playbook asks.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project? (id or name)" |
| issueId | the user, `.lpm-activity`, or row 1 → `recommendation.issueId` | ask "Which LPM activity is this for? (id or title)" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | pick the next activity | CALL {{tool:recommend_next_activity}} {"projectId":"<input:projectId>"} | A | null → "No open activity."; else Next: ask "Start <issueId>? (yes/no)" |
| 2 | start or continue an activity | playbook {{ref:flow-start}} | A | active blocker → {{skill:lpm-unblock-work}} |
| 3 | attach or close on a ChatGPT/Claude connector | playbook {{ref:flow-connector-only}} | A | never `done` |
| 4 | commit code, record progress, comment | playbook {{ref:flow-commit-and-progress}} | A | unknown issueId → ask |
| 5 | attach a print, screenshot, log or test report | playbook {{ref:flow-evidence}} | A | a secret in the file |
| 6 | finish or close, or "can I close it?" | playbook {{ref:flow-close}} | A | a criterion without proof |
| 7 | edit or remove a comment or an attachment | playbook {{ref:flow-fix-comment-or-attachment}} | C | not named by the user |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| start | start or continue work on one activity | {{ref:flow-start}} |
| commit-and-progress | commit with the LPM-Activity trailer, or comment progress | {{ref:flow-commit-and-progress}} |
| evidence | attach a screenshot, log or test report | {{ref:flow-evidence}} |
| close | close the activity, or answer "can I close it?" | {{ref:flow-close}} |
| fix-comment-or-attachment | edit or remove a comment, or remove an attachment | {{ref:flow-fix-comment-or-attachment}} |
| connector-only | attach or close on a ChatGPT/Claude connector | {{ref:flow-connector-only}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no issueId | "Which LPM activity is this for? (id or title)" |
| dropping a criterion, scope or roadmap change | a comment is not a decision → {{skill:lpm-governance-decisions}} |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| status move | {{tool:get_issue}} | `status` is the new value |
| comment | {{tool:list_comments}} | the id has your text, or is gone after delete |
| {{tool:create_activity_attachment}}, {{tool:upload_activity_attachment}}, {{tool:delete_activity_attachment}} | {{tool:list_activity_attachments}} | attachment is present or deleted on the activityId resolved with {{tool:list_workspace_activities}} |
| commit | `git log -1 --format=%B` | a line is exactly `LPM-Activity: <issueId>` |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspaceId>/<projectId>/<issueId> <title>
Done: <changes with ids>; status <status from your last get_issue>
Evidence: <fileName (attachment id) on activityId> | <test → result> | none
Pending: none | <criterion> — <owner>
Next: <the ASK or STOP text that ended the run> | <one action> | none — activity closed
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "Activity <id> not found" | the issueId was sent as activityId → rerun the playbook |
| "Factory Definition of Done is missing, blocked or stale." | STOP → {{skill:lpm-aish-delivery}} |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
