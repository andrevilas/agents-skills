# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "connect my agent to LPM", "como conectar o LPM no Codex"
- "which workspace am I in?", "qual skill devo usar?"
Do not use:
| If the request is about | Use |
|---|---|
| delivering one activity | {{skill:lpm-deliver-activity}} |

## 2. Preconditions
1. Every row works on a connector and on an API key.
2. Read-only request → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{tool:list_workspaces}} → `id` | 0 or 2+ → ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | check the connection | {{tool:get_mcp_connection_info}} [A] | A | the call fails → core rule 2 |
| 2 | find the workspace | P1 | A | none → ask |
| 3 | nothing else matches | {{tool:search_help_articles}}(query) [A] → ask | A | no article → ask |

## 5. Procedures
### P1 Workspace — row 2
1. {{tool:list_workspaces}} → keep `id`, `name`.
2. One match → use it. Else → ask one question.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| two workspaces match | "Which workspace: <a> or <b>?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| connection check | {{tool:get_mcp_connection_info}} | `credential` is set |

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
