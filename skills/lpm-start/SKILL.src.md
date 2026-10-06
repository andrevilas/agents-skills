# LPM start: connection, IDs and routing
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "a ferramenta não aparece no ChatGPT", "got -32003", "what can this connector do?", "reinstalei o conector"
- "configure o LPM no Codex", "set up LPM in Claude Code / Cursor"
- "qual é o id do workspace <nome>?", "find the project <name>"
- "mostre minhas notificações", "marque a notificação como lida"; no other lpm-* skill fits, or two fit
Do not use:
| If the request is about | Use |
|---|---|
| changing API keys, agent credentials or provider keys | {{skill:lpm-access}} |
| AI budgets, limits, models or AI config | {{skill:lpm-ai-cost}} |
| linking, scanning or indexing a repository | {{skill:lpm-code-index}} |
| enrolling an AISH runner host | {{skill:lpm-aish-runners}} |
| creating or changing workspace members, teams or projects | {{skill:lpm-workspace-admin}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Every playbook starts with {{tool:get_mcp_connection_info}}; denied there means an `lpm_mcp_` agent credential (the playbook then runs `lpm mcp status`).
3. This skill only reads; its one write is {{tool:mark_notification_read}}, for ids the user named.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| request | the user's words | ask "What do you want to do in LPM?" |
| workspaceId, projectId | the user, or playbook resolve-ids | playbook resolve-ids |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a tool is missing, denied or returns -32003; "what can this connector do?"; "I reinstalled the connector" | playbook {{ref:flow-connection}} | A | always ends there; after a reinstall it routes |
| 2 | connect or configure LPM in an agent; a config points at `*.run.app`; verify a new setup | playbook {{ref:flow-agent-setup}} | A | a key pasted in chat |
| 3 | a workspaceId or projectId is unknown | playbook {{ref:flow-resolve-ids}} | A | 0 or 2+ matches |
| 4 | read notifications or mark them read | playbook {{ref:flow-notifications}} | A | a connector or `lpm_mcp_` credential |
| 5 | my API keys or my key's profile | CALL {{tool:list_api_keys}} {} | A | key change → {{skill:lpm-access}}; 2+ active → "LPM does not report which key this connection uses"; never read `LPM_API_KEY` |
| 6 | access.canManage is false; "who can give me access?" | playbook {{ref:flow-who-can-manage}} | A | — |
| 7 | any other LPM request, or one that spans several skills | playbook {{ref:flow-route}} | A | a KEY skill on a connector |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| connection | a tool is missing, denied or returns -32003; "what can this connector do?"; "I reinstalled the connector" | {{ref:flow-connection}} |
| agent-setup | connect or configure LPM in an agent, fix a `*.run.app` URL, or verify a new setup | {{ref:flow-agent-setup}} |
| resolve-ids | a workspaceId or projectId is unknown, or "what is the id of project <name>?" | {{ref:flow-resolve-ids}} |
| notifications | read my LPM notifications, or mark one as read | {{ref:flow-notifications}} |
| who-can-manage | you cannot manage a project or workspace (access.canManage false), or "who can give me access?" | {{ref:flow-who-can-manage}} |
| route | any other LPM request, or a request that spans several skills | {{ref:flow-route}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| a scope is missing on a ChatGPT/Claude connector | relay `howToEnable` verbatim in this reply, no question first: remove and reinstall the connector, tick the box in "Permissões adicionais (opcional)"; disconnect/connect keeps the old grant |
| the user offers to paste a key | "Do not paste it here. Set the env var `LPM_API_KEY`, then tell me." |
| a KEY skill and `credential == "oauth"` | "<skill> needs an LPM API key; connectors cannot run it. Do you have one?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:mark_notification_read}} | {{tool:list_notifications}} `{"unreadOnly":true}` | the marked id is absent |
| agent setup (new session) | {{tool:get_mcp_connection_info}}; `lpm_mcp_`: `lpm mcp status`; CLI: `lpm auth status` | more than 0 tools |
| connector reinstall | {{tool:get_mcp_connection_info}} | no `unavailableToolGroups[].tools` lists the tool; then route the original request to its skill, never "retry the tool" |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace (id)> / <project (key, id)> | connection <credential> | agent <name> | none
Done: read-only | notification <id> marked as read; <credential>, <tool count> tools
Evidence: <connection-info fields | `lpm auth status` line | route row #>
Pending: none | <exact user action, e.g. the howToEnable text>
Next: <the ASK or STOP text that ended the run> | load lpm-<id> (route row #) | one user action
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "API key or OAuth token is missing" | the key went as `Authorization: Bearer`; send it as `x-api-key` (playbook agent-setup) |
| "Invalid API key." / "API key is revoked." | new key via {{skill:lpm-access}}, then playbook agent-setup |
| `lpm auth status`: "Not authenticated" or `http://localhost:4173` | `lpm auth login --api-key "$LPM_API_KEY" --base-url https://lpm.rocks` |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
