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
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Code in a git repository → {{ref:repo-hygiene}}; every commit ends with `LPM-Activity: <issueId>`.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project? (id or name)" |
| issueId | the user | ask "Which LPM activity is this for?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | read the activity | CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} | A | not found → ask for the id |
| 2 | close the activity | playbook {{ref:flow-close}} | A | a criterion without proof |
| 3 | commit code for the activity | playbook {{ref:flow-commit}} | A | issueId unknown → ask |
| 4 | set a due date | playbook {{ref:flow-due-date}} | A | no date given → ask |
| 5 | create an API key | playbook {{ref:flow-api-key}} | C | the user did not say yes |
| 6 | change the AISH budget | playbook {{ref:flow-budget}} | O | no owner order |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| close | close the activity, or answer "can I close it?" | {{ref:flow-close}} |
| commit | commit with the LPM-Activity trailer, then comment progress | {{ref:flow-commit}} |
| due-date | set the due date of one activity | {{ref:flow-due-date}} |
| api-key | create an API key for a workspace | {{ref:flow-api-key}} |
| budget | change the AISH budget on the owner's order | {{ref:flow-budget}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:configure_aish_budget}} without an owner order in this conversation | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |
| no issueId | "Which LPM activity is this for?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| status move | {{tool:get_issue}} | `status` equals the requested value |
| {{tool:create_comment}} | {{tool:list_comments}} | the comment exists |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace / project / ids>
Done: <state changes with ids>
Evidence: <comment ids / outputs> | none
Pending: none | <exact item> — <who must act>
Next: <the ASK or STOP text that ended the run> | <one action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| -32003 or tool missing | core rule 2 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
