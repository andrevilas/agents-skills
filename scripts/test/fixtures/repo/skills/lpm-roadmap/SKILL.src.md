---
name: should-be-ignored
---
# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}

## 1. Use when / Do not use
Use when:
- "roadmap"
Do not use:
| If the request is about | Use |
|---|---|
| nothing | — |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | create a roadmap | {{tool:create_workspace_roadmap}} | O | no owner order |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
