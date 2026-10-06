# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "implementa a atividade <id>", "attach the print"
Do not use:
| If the request is about | Use |
|---|---|
| shipping the LPM product itself | {{skill:lpm-release-product}} (LPM maintainers only) |
| a second mention | {{skill:lpm-release-product}} |

## 2. Preconditions
1. Writing code → follow {{ref:repo-hygiene}}.
{{ref-summary:repo-hygiene}}

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| issueId | user | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | read the activity | `{{tool:get_issue}}` | A | — |
| 2 | attach proof | P1 | A | file > 10 MiB → {{tool:create_activity_attachment}} |
| 3 | remove an attachment | {{tool:list_activity_attachments}} → {{tool:delete_activity_attachment}} | C | not named |

## 5. Procedures
### P1 Attach — row 2
1. {{tool:list_workspace_activities}}(workspaceId) → keep `id`.
2. {{tool:upload_activity_attachment}}(projectId, activityId) [A].
3. Verify: {{tool:list_activity_attachments}} → the id exists. Commit trailer: `LPM-Activity: <issueId>`.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| owner decision | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| -32003 or tool missing | core rule 2 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
