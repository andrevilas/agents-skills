# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "list my API keys", "rotate the CI key", "cria uma credencial lpm_mcp_", "set the workspace GitHub token"
Do not use:
| If the request is about | Use |
|---|---|
| a missing connector tool, or connecting an agent | {{skill:lpm-start}} |
| AI budgets, limits or models | {{skill:lpm-ai-cost}} |
| an AISH runner host token | {{skill:lpm-aish-runners}} |
| members, roles or teams | {{skill:lpm-workspace-admin}} |
| repository linking or indexing | {{skill:lpm-code-index}} |
| a webhook secret | {{skill:lpm-integrations}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Connector or `lpm_mcp_` credential → say "Credential tools need an LPM API key (full or custom profile)." → STOP.
3. API-key rows: the caller's own keys only.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{tool:list_workspaces}}() → `id` by `name` | 0 or 2+ → ask |
| keyId | {{tool:list_api_keys}}() → `id` by `name` or `keyPreview` | 0 or 2+ → ask |
| name, profile, provider | the owner | ask; never invent |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a write without the owner's order | CALL {{tool:list_api_keys}} {} | A | no owner order → §6 decision request |
| 2 | list or review access, or which profile | CALL {{tool:list_api_keys}} {} | A | never write; profile → {{ref:api-key-profiles}} |
| 3 | create an API key | playbook {{ref:flow-gate}}, then playbook {{ref:flow-api-keys}} | O | `full` without a named job → ask |
| 4 | change, revoke, reactivate or delete | playbook {{ref:flow-gate}}, then playbook {{ref:flow-api-keys}} | O | delete while revoke is enough → ask |
| 5 | rotate an API key | playbook {{ref:flow-gate}}, then playbook {{ref:flow-api-keys}} | O | swap not confirmed → stop |
| 6 | agent principal or `lpm_mcp_` credential | playbook {{ref:flow-gate}} | A | then {{ref:ref-agent-identities}} [O] |
| 7 | specialist agent on a project | playbook {{ref:flow-gate}} | A | then {{ref:ref-agent-identities}} [O] |
| 8 | AI provider key or GitHub token | playbook {{ref:flow-gate}} | A | then {{ref:ref-workspace-secrets}} [O] |
| 9 | "show me the key / secret again" | CALL {{tool:list_api_keys}} {} | A | secret never returned → rotate |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| gate | any [O] write on rows 3–8 (verify owner order and access before the operation) | {{ref:flow-gate}} |
| api-keys | create, change, revoke, reactivate, rotate or delete an API key (after the gate playbook) | {{ref:flow-api-keys}} |

Flows (follow their own instructions):
- {{ref:ref-access-review}}: access review (row 2)
- {{ref:ref-agent-identities}}: agent credentials (rows 6–7)
- {{ref:ref-workspace-secrets}}: provider keys and tokens (row 8)

## 6. Stop and ask
| Situation | Ask |
|---|---|
| no owner order | decision request, STOP |
| secret in chat | never repeat; "Put it in an env var and rotate it." |
| key for another person or test | refuse |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any API key write | {{tool:list_api_keys}} | playbook api-keys verify step |
| principal, credential, assignment or secret | the flow's Verify table | every row passes |

## 8. Report (copy and fill)
```text
Scope: <workspaceId | caller's keys>; owner order: "<quote>"
Done: <tool → id, name, profile/status>
Evidence: <re-read → values; keyPreview only>
Pending: <none | owner stores key | rotate: purge old>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error | Do |
|---|---|
| -32003 credentials | role issue: ask workspace owner |
| "pepper is not configured" | server setting; tell owner, no retry |
| revoke OAuth session | web UI → "Sessões e Chaves de API" |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
