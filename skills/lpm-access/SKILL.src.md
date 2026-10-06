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
1. Connector or `lpm_mcp_` credential → say "Credential tools need an LPM API key (full or custom profile)." → STOP.
2. API-key rows: the caller's own keys only. Rows 6–8: P1 step 3.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{tool:list_workspaces}}() → `id` by `name` | 0 or 2+ → ask |
| projectId | {{tool:list_projects}}(workspaceId) → `id` by `name` | 0 or 2+ → ask |
| keyId | {{tool:list_api_keys}}() → `id` by `name` or `keyPreview` | 0 or 2+ → ask |
| name, profile, expiresAt, provider, texts | the owner | ask; never invent |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a write without the owner's order for this exact action | decision request ({{ref:authority-and-owner-decisions#decision-request}}) | — | always |
| 2 | list or review access, or which profile a key needs | {{ref:flow-access-review}}; profile: smallest preset ({{ref:api-key-profiles}}) | A | never write; `roadmap-owner-*` → row 6 |
| 3 | create an API key | P1, then P2 steps 1–2 and 7 | O | `full` without a named job → ask "Which job needs full?" |
| 4 | change, revoke, reactivate or delete a key | P1, then P2 steps 3–4, 6 and 7 | O | delete while revoke is enough → ask "Revoke (reversible) instead?" |
| 5 | rotate an API key | P1, then P2 steps 5 and 7 | O | swap not confirmed → stop before the revoke; delete in the order → ask "Revoke (reversible) instead?" |
| 6 | agent principal or `lpm_mcp_` credential: create, edit, archive, rotate, suspend, reactivate, revoke | {{ref:flow-agent-identities}} | O | the flow's Stop table |
| 7 | add or revoke a specialist agent on a project | {{ref:flow-agent-identities}}; P1 without step 3 | O | flow step 7 fails → STOP |
| 8 | AI provider key or workspace GitHub token: set, replace, remove | {{ref:flow-workspace-secrets}} | O | the flow's Stop table |
| 9 | "show me the key / secret again" | re-list masked values only (`keyPreview`, `maskedKey`, GitHub token `status`) | A | the secret is never returned → rotate (row 5 or 6) |

## 5. Procedures
### P1 Gate — rows 3–8
1. Quote the owner's order for this exact action; none → §6 row 1.
2. Rows 3–5: {{tool:list_api_keys}}(): -32003 → STOP: "This key cannot call list_api_keys; add it to the key's allowedTools or use a full key." No -32003 → step 4; rows 3–5 never call `list_workspaces`.
3. Rows 6, 8: `list_workspaces`() → row `workspaceId` → `access.canManage` `false` → STOP: "Only a workspace owner or admin can change workspace credentials; ask the owner." Row 7: skip; the server checks.
4. Show the exact call (secrets as `<from $ENV_NAME>`) and its §6 question; continue only on "yes".
### P2 API keys — rows 3–5 ({{ref:api-key-profiles}}); no call takes `idempotencyKey`: never send one
1. Create: same `name` in the P1 step 2 list → add "A key named <name> exists (<keyPreview>); create another?" to the P1 step 4 question; yes → {{tool:create_api_key}}(name, accessProfile=<smallest preset>, allowedTools=<custom only, exact list>) [O] → keep `ID`. Timeout → {{tool:list_api_keys}}; a new row with that name → never call again; ask "Revoke <name> (<keyPreview>) and create a new key?" (secret lost).
2. Hand the secret over once, alone: "Save this key now; LPM will not show it again."
3. {{tool:update_api_key}}(keyId, changed fields) [O]; `status` only for a revoke or reactivate order, else omit it; resulting profile `custom` → send the FULL `allowedTools`, even for a status change.
4. Delete (explicit order only): {{tool:delete_api_key}}(keyId) [O]; irreversible.
5. Rotate: steps 1–2 with the old key's profile and tools → owner says "the client uses the new key" → step 3 on the OLD keyId, status=`revoked`. Order also says delete → ask "Revoke (reversible) instead?" with the create question; delete only on an explicit yes, after step 3, via step 4.
6. Steps 3–4: §6 "Is this session…?" yes → run step 7 first, then say "The final check must run from another key."
7. Verify: {{tool:list_api_keys}} → `accessProfile`, `allowedTools`, `status` as requested; deleted id absent.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no owner order quoted from this conversation | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |
| before {{tool:create_api_key}} | "Create key <name>, profile <p> (no expiry)? The secret is shown once." |
| before {{tool:update_api_key}}, {{tool:delete_api_key}} | "Is this session running on key <name> (<keyPreview>)?", then the row below or "Change <name>: <fields>?" |
| before {{tool:update_api_key}} status=`revoked` | "Revoke <name> (<keyPreview>)? Reversible: clients get 403 until reactivated." |
| before {{tool:delete_api_key}}, an `lpm_mcp_` revoke, a specialist revoke, a principal archive | "This is permanent: <effect>. Proceed?" |
| any other flow write | the flow's question |
| a secret pasted in chat | never repeat it; say "Put it in an env var and rotate it." |
| a key for another person or a test | refuse |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any API key write | {{tool:list_api_keys}} | P2 step 7 |
| principal, credential, assignment or secret write | the flow's Verify table | every row passes |

## 8. Report (copy and fill)
```text
Scope: <workspaceId / projectId | rows 3–5: caller's own API keys>; owner order: "<verbatim quote>"
Done: <tool → id, name, profile / status / expiresAt / revision>
Evidence: <re-read → values that passed §7; keyPreview or maskedKey only>
Pending: <none | owner swaps the client / revokes at GitHub or the provider | key create (never none): owner stores the key in <client>'s secret store | leak rotation: purge the leaked value from <log>; delete the old key only on a later explicit order>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| credential tool -32003 "You do not have permission to manage or view credentials in this workspace." | role, not key: ask the workspace owner; no {{tool:get_mcp_connection_info}} |
| {{tool:get_mcp_connection_info}} on an API key | relay `howToChange` (no `howToEnable`) |
| "pepper is not configured" | server setting; tell the owner, no retry |
| revoking an OAuth connector session | LPM web UI → "Sessões e Chaves de API" |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
