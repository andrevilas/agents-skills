# Flow: a named tool is missing or denied
Load when: P1 step 4 (a named tool is missing, denied or returns -32003)

## Preconditions
1. P1 step 1 ran: you hold `credential`, `scopes`, `workspaceAccess`, `workspaceId`, `unavailableToolGroups[]` and `howToChange`.
2. Read the error first: its text and `data` (`reason`, `requiredScope`, `tool`). Source: lpm `src/server/oauthToolPolicy.ts` (`authorizeOAuthTool`, `oauthToolError`), `src/server/mcpConnectionInfo.ts`.
3. Every `howToEnable` already holds the reinstall text. Relay it verbatim in the same reply, without asking first; add only the step 2 reconnect sentence.

## Steps
1. `credential != "oauth"` → relay `howToChange`: the key owner adds the tool to the key ({{skill:lpm-access}}). STOP.
2. Error `data.requiredScope` is set → find the `unavailableToolGroups[]` entry whose `scope` equals it → relay its `howToEnable` verbatim now, in this reply; do not ask whether the user wants to reinstall. User says they disconnected/reconnected → also say: "Desconectar e conectar de novo mantém a concessão antiga e a lista de ferramentas; é preciso remover e reinstalar o conector." STOP.
3. No error, and an `unavailableToolGroups[]` entry lists the tool in `tools[]` → relay that entry's `howToEnable` verbatim now, in this reply; do not ask first. User says they disconnected/reconnected → also say the step 2 sentence. STOP.
4. Error "The requested operation or resource is not authorized." and `workspaceAccess == "single"` → the target workspace is outside the grant (the grant is `workspaceId`). Say "Remove the LPM connector, install it again with `https://lpm.rocks/mcp` and choose that workspace (or all workspaces) on 'Autorizar uma conexão'." STOP.
5. Same error and `workspaceAccess == "all"` → say "Your LPM account cannot reach that workspace or project; a workspace admin must add you." STOP.
6. Error "This tool is not available under the granted OAuth scopes. …", or the tool is marked KEY in §10 or in its owner skill's §10 → say "`<tool>` needs an LPM API key; connectors lack it." STOP.
7. Otherwise the tool has an OAuth scope that is already in `scopes`, and the client still does not list it: the client tool list is stale. Say "Disconnecting and connecting again keeps the old grant and tool list: remove the LPM connector, install it again with `https://lpm.rocks/mcp`, tick the box in 'Permissões adicionais (opcional)' when the scope is opt-in, click 'Autorizar acesso'." STOP.

## Examples
```text
example: create_comment fails on ChatGPT, data.requiredScope = "portfolio:manage"
-> unavailableToolGroups[scope = "portfolio:manage"].howToEnable -> relay it verbatim in this reply (no question first) -> STOP
-> after the reinstall: SKILL.md P1 step 5 (re-check, then route "comment" to lpm-deliver-activity)
example: get_project fails with "The requested operation or resource is not authorized.", workspaceAccess = "single"
-> the project's workspace is outside the grant -> reinstall and choose that workspace -> STOP
example: search_help_articles is not listed on a connector
-> marked KEY -> "search_help_articles needs an LPM API key; connectors lack it." -> STOP
```
