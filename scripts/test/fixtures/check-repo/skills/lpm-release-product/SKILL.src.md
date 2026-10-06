# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "deploy the LPM product", "implantar a nova versão em produção"
Do not use:
| If the request is about | Use |
|---|---|
| delivering one activity | {{skill:lpm-deliver-activity}} |

## 2. Preconditions
1. Only inside the `lpm` repository; follow {{ref:lpm-repo-rules}} and {{ref:repo-hygiene}}.
2. Read-only request → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| projectId, issueId | the user | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | ship the product | P1 | A | any check fails → STOP |

## 5. Procedures
### P1 Ship — row 1
1. Commits carry `LPM-Activity: <issueId>`.
2. {{tool:create_comment}}(projectId, issueId, content=<release report>, idempotencyKey="release-<issueId>") [A].
3. Verify: {{tool:get_issue}}(projectId, issueId) → the comment is listed.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| a check fails | "The <check> failed; stop the release? (yes/no)" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| release comment | {{tool:get_issue}} | the comment is listed |

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
