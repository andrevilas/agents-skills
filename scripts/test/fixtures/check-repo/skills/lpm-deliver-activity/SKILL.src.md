# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "implementa a atividade <id>", "close the activity"
- "registre o progresso", "commit with the LPM-Activity trailer"
Do not use:
| If the request is about | Use |
|---|---|
| connecting an agent | {{skill:lpm-start}} |
| shipping the LPM product itself | {{skill:lpm-release-product}} (LPM maintainers only) |

## 2. Preconditions
1. Writing code → follow {{ref:repo-hygiene}}.
2. Read-only request → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId, issueId | the user or {{skill:lpm-start}} §3 | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | close the activity | P1 | A | `status == "canceled"` → ask |
| 2 | commit code for the activity | P2 | A | issueId unknown → ask |
| 3 | set a due date | {{tool:set_project_issue_due_date}}(projectId, issueId, dueDate) [A] | A | no date given → ask |
| 4 | change the AISH budget | {{tool:configure_aish_budget}}(workspaceId) [O] | O | no owner order → §6 |
| 5 | create an API key | {{tool:create_api_key}}(workspaceId, name) [C] | C | the user did not say yes |

## 5. Procedures
### P1 Close — row 1 (load {{ref:closure-checklist}})
1. {{tool:get_issue}}(projectId, issueId) → keep `status`.
2. {{tool:update_issue}}(projectId, issueId, status="done") [A].
3. Verify: {{tool:get_issue}}(projectId, issueId) → `status == "done"`.
### P2 Commit with tracking — row 2
1. The message ends with `LPM-Activity: <issueId>`.
2. {{tool:create_comment}}(projectId, issueId, content=<progress>, idempotencyKey="progress-<issueId>") [A].
3. Verify: {{tool:list_comments}}(projectId, issueId) shows the comment.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:configure_aish_budget}} without an owner order in this conversation | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |
| no issueId | "Which LPM activity is this for?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| status move | {{tool:get_issue}} | `status` equals the requested value |
| comment | {{tool:list_comments}} | the comment exists |

## 8. Report (copy and fill)
```text
Scope: <workspace / project / ids>
Done: <state changes with ids>
Evidence: <comment ids / outputs>
Pending: <none | exact item — who must act>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| -32003 or tool missing | core rule 2 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
