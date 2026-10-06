# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "the tool is missing", "ferramenta ausente"
Do not use:
| If the request is about | Use |
|---|---|
| delivering an activity | {{skill:lpm-deliver-activity}} |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a tool is missing | {{tool:get_mcp_connection_info}} | A | — |
| 2 | route the request | {{ref:route}} | A | — |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
