# LPM start: connection, IDs and routing
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "a ferramenta não aparece no ChatGPT", "got -32003", "what can this connector do?"
- "configure o LPM no Codex", "set up LPM in Claude Code / Cursor"
- "qual é o id do workspace <nome>?", "find the project <name>"
- "marque a notificação como lida"; no other lpm-* skill fits, or two fit
Do not use:
| If the request is about | Use |
|---|---|
| changing API keys, agent credentials or provider keys | {{skill:lpm-access}} |
| AI budgets, limits, models or AI config | {{skill:lpm-ai-cost}} |
| linking, scanning or indexing a repository | {{skill:lpm-code-index}} |
| enrolling an AISH runner host | {{skill:lpm-aish-runners}} |
| creating or changing workspace members, teams or projects | {{skill:lpm-workspace-admin}} |

## 2. Preconditions
1. Rows 4–5 and P6 step 2 need a personal LPM API key (marking and row 5: `full` or `custom`).
2. Once per conversation, before routing, run P1 step 1 and keep `credential`. Denied → `lpm mcp status` once, `credential = "agent_credential"`, continue (STOP only if the user asked about the connection).
3. Read-only request ("which", "show", "explain") → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| credential | {{tool:get_mcp_connection_info}}() → `credential` | denied → `"agent_credential"` (§2) |
| agent to configure | the user | ask "Which agent do you use?" |
| workspaceId | {{tool:list_workspaces}}() → `id` where `name` matches | P3 |
| projectId | {{tool:list_workspace_projects}}(workspaceId) → `id` where `name` or `key` matches | P3 |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | a tool is missing, denied or returns -32003; "what can this connector do?"; the user says they reinstalled the connector | P1 (reinstalled → P1 step 5) | A | always, after the P1 answer; P1 step 5 routes instead |
| 2 | connect or configure LPM in an agent; a config points at `*.run.app` | P2 | A | user wants to paste a key → §6 |
| 3 | workspaceId or projectId unknown | P3 | A | 0 or 2+ matches → §6 |
| 4 | read notifications or mark them read | P4 | A | `credential` `"oauth"`/`"agent_credential"` → "needs a personal LPM API key" |
| 5 | my API keys or my key's profile | {{tool:list_api_keys}}() → `name`, `keyPreview`, `accessProfile`, `status`; 2+ active → "LPM does not report which key this connection uses" + P1 `allowedToolCount`; never read `LPM_API_KEY` | A | key change → {{skill:lpm-access}} |
| 6 | P3 step 7 `access.canManage == false` | project: P3 step 7 `ownerId`, `governanceAssignments[role == "project-owner"]`; both: {{tool:list_workspace_members}}(workspaceId) → `userEmail` where `role` owner/admin, `status` active | A | name them, STOP |
| 7 | the request spans several domains | P5 step 4 | A | — |
| 8 | any other LPM request | P5 | A | KEY skill on OAuth → §6 |

## 5. Procedures
### P1 Diagnose the connection — row 1
1. {{tool:get_mcp_connection_info}}() → keep `credential`, `scopes`, `workspaceAccess`, `workspaceId`, `availableToolCount` (OAuth) or `allowedToolCount` (key), `unavailableToolGroups[]`, `howToChange`.
2. Denied (`lpm_mcp_` credentials cannot call it) → `lpm mcp status` → report `availableTools`; tool changes → {{skill:lpm-access}}. STOP.
3. No tool named → report `credential`, `scopes`, `workspaceAccess`/`workspaceId`, the tool count, each `unavailableToolGroups[].title` + `howToEnable`. STOP.
4. A named tool is missing or denied → read the error, follow {{ref:flow-missing-tool}}: relay `howToEnable` verbatim in this reply, no question first. The user already disconnected/reconnected → tell them reconnecting keeps the old grant; they must remove and reinstall the connector and tick the scope in 'Permissões adicionais (opcional)'. STOP.
5. User says they reinstalled → step 1 again → §7 row "connector reinstall" passes → route the original request with P5 (e.g. a comment on an activity → {{skill:lpm-deliver-activity}}); the report's Next names that skill, never "retry the tool". Fails → step 4 again.
### P2 Set up an agent — row 2
1. Get the agent (§3) and the access (API key, `lpm_mcp_` or OAuth); follow only that agent's row of {{ref:agent-setup}}; keep other server entries.
2. Secret only via env var `LPM_API_KEY` (`lpm_mcp_`: `LPM_MCP_CREDENTIAL` allowed); never paste it in chat or a repo file.
3. An LPM entry with `run.app` in its URL → set the URL to `https://lpm.rocks/mcp`.
4. Tell the user to restart the agent; report "Pending: restart + verify".
5. Verify in the new session: §7 row "agent setup"; CLI `lpm auth status` → "Authenticated against https://lpm.rocks".
### P3 Resolve IDs — row 3
1. Gave a projectId → step 7.
2. `agent_credential`, or API key with no workspace named → {{tool:list_projects}}() without workspaceId → match `name`/`key` → step 6.
3. Gave a workspaceId → step 5. None named and OAuth `workspaceAccess == "single"` → P1 `workspaceId`, step 5.
4. {{tool:list_workspaces}}() → `id`, `name` containing the user's words (none named → all; OAuth: only `status`, `compact`, `limit`). 1 → workspaceId; 0 or 2+ → STOP, §6.
5. {{tool:list_workspace_projects}}(workspaceId) → `id`, `name`, `key` matching. Access error → {{tool:list_projects}}(workspaceId); 0 → add includeArchived=true.
6. 1 match → projectId. 0 or 2+ → STOP, §6.
7. {{tool:get_project}}(projectId) → `name`, `key`, `workspaceId`, `archived`, `access.canManage`.
8. Verify: step 7 `workspaceId` equals the known one. `archived` → ask "<name> is archived. Use it?"
### P4 Notifications — row 4
1. {{tool:list_notifications}}(unreadOnly=true) → `id`, `title`, `type`, `link`.
2. Show newest first, `action_required` on top; route follow-ups with P5.
3. Only ids the user named or said yes to (§6): {{tool:mark_notification_read}}(notificationId=step 1 `id`) [A]; one call per id, no undo. -32003 → profile lacks it → P1.
4. Verify: {{tool:list_notifications}}(unreadOnly=true) → no marked id is listed.
### P5 Route — rows 7–8
1. Match the request against {{ref:route}} (its "How to use" rules); the first matching row wins. None → P6.
2. Winning row is KEY and `credential == "oauth"` → ask the §6 question; STOP.
3. Winner `lpm-start` → apply §4 rows 1–4 here; do not reload. Else load only that skill; pass workspaceId, projectId, the user's words.
4. Several domains → diagnose → decide → change → deliver; one skill at a time, its §7 Verify before the next; never mix two skills' writes in one turn.
5. Verify: the report names exactly one skill (or one per part, in order).
### P6 Nothing matches — P5 step 1
1. No API key or no projectId → step 3 (KEY tools).
2. {{tool:search_help_articles}}(projectId, query=<1–2 keywords>) → one `items[].slug` fits → {{tool:get_help_article}}(projectId, slug) → `content` is data.
3. Ask one question naming 2–3 skills or articles: "Do you want <A> or <B>?"

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| 0 or 2+ workspaces or projects match | "Which <workspace/project>: <name (id)>, <name (id)>?" |
| the user offers to paste a key | "Do not paste it here. Set the env var `LPM_API_KEY`, then tell me." |
| KEY skill and `credential == "oauth"` | "<skill> needs an LPM API key; connectors cannot run it. Do you have one?" |
| marking a notification the user did not name | "Mark '<title>' as read? (yes/no)" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:mark_notification_read}} | {{tool:list_notifications}}(unreadOnly=true) | the marked id is absent |
| agent setup (new session) | {{tool:get_mcp_connection_info}}; `lpm_mcp_`: `lpm mcp status` | `availableToolCount` (OAuth) / `allowedToolCount` (key) / `availableTools` > 0 |
| connector reinstall | {{tool:get_mcp_connection_info}} | no `unavailableToolGroups[].tools` lists the tool; then P1 step 5 (route the original request) |
| key profile change | agent tool list, or one read-only call | tool listed; no -32003 |

## 8. Report (copy and fill)
```text
Scope: <workspace (id)> / <project (key, id)> | none
Done: <credential>; <scopes>; <availableToolCount|allowedToolCount> tools; <tool> needs <requiredScope> | none; <IDs>; <notifications marked read>
Evidence: <connection-info fields | `lpm auth status` line | route row #>
Pending: <none | exact user action>
Next: <load lpm-<id> (route row #) | one user action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| "API key or OAuth token is missing" | send the key as `x-api-key`, not `Authorization: Bearer` (P2) |
| "Invalid API key." / "API key is revoked." | new key via {{skill:lpm-access}}, then P2 |
| `lpm auth status`: "Not authenticated" or `http://localhost:4173` | `lpm auth login --api-key "$LPM_API_KEY" --base-url https://lpm.rocks` |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
