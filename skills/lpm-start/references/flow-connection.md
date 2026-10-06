# Playbook: connection
Use when: a tool is missing, denied or returns -32003; "what can this connector do?"; "I reinstalled the connector"
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| tool | the bare tool name the user or the error named (`mcp__lpm__create_comment` → `create_comment`) | "none" |
| errorText | the error message the tool returned, with its `data` (`reason`, `requiredScope`) | "none" |
| reconnected | "yes" if the user said they disconnected and connected the connector again | "no" |
| reinstalled | "yes" if the user said they removed and installed the connector again | "no" |
| request | what the user wanted to do with the tool, in their words | "none" |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>. The connection was not checked."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF the call returns an error → go to step 2.
   SAVE: credential = result.credential; scopes = result.scopes; access = result.workspaceAccess; grant = result.workspaceId (empty if null); count = result.availableToolCount, else result.allowedToolCount; groups = result.unavailableToolGroups (empty if absent); howToChange = result.howToChange; go to step 3.
2. RUN `lpm mcp status`
   IF the command fails → STOP. This belongs to skill {{skill:lpm-access}}. Say: "This connection cannot call get_mcp_connection_info and `lpm mcp status` failed: <error text>. An lpm_mcp_ agent credential's tools are set on the credential by the workspace owner."
   SAVE: credential = "agent_credential"; count = the availableTools number it prints
   IF <input:tool> is "none" → go to Answer.
   IF <input:tool> is not "none" → STOP. This belongs to skill {{skill:lpm-access}}. Say: "<input:tool> is not in this lpm_mcp_ agent credential (<saved:count> tools). The workspace owner adds it to the credential in LPM settings."
3. IF <input:errorText> contains "You do not have access" → STOP. Say: "Your LPM account cannot reach that workspace or project. A workspace owner or admin must add you (ask me who can manage it)."
   IF <saved:credential> != "oauth" and <input:tool> is "none" → go to Answer.
   IF <saved:credential> != "oauth" → STOP. This belongs to skill {{skill:lpm-access}}. Say: "<input:tool> is not allowed for this API key (<saved:count> tools allowed). <saved:howToChange> The key owner adds it."
4. IF <input:reinstalled> == "yes" → go to step 8.
   IF <input:tool> is "none" → go to Answer.
5. SAVE: group = the item of <saved:groups> whose tools list contains <input:tool> (empty if none)
   IF <saved:group> is not empty and <input:reconnected> == "yes" → STOP. Say: "<the howToEnable text of <saved:group>, verbatim> Disconnecting and connecting again keeps the old grant and the old tool list: remove the LPM connector and install it again."
   IF <saved:group> is not empty → STOP. Say: "<the howToEnable text of <saved:group>, verbatim>"
   Never ask "do you want to reinstall?" first: the howToEnable text goes in this reply.
6. IF <input:errorText> contains "The requested operation or resource is not authorized." and <saved:access> == "single" → STOP. Say: "That workspace is outside this connector's grant (it reaches only <saved:grant>). Remove the LPM connector, install it again with https://lpm.rocks/mcp and choose that workspace, or all workspaces, on 'Autorizar uma conexão'."
   IF <input:errorText> contains "The requested operation or resource is not authorized." → STOP. Say: "Your LPM account cannot reach that workspace or project. A workspace owner or admin must add you."
7. IF <input:errorText> contains "not available under the granted OAuth scopes" → STOP. Say: "<input:tool> needs an LPM API key; ChatGPT/Claude connectors cannot call it. Use an agent set up with an API key."
   IF <input:errorText> is "none" → STOP. Say: "<input:tool> is in no scope this connector lacks. Either it needs an LPM API key (connectors never list it), or the connector's tool list is stale: remove the LPM connector, install it again with https://lpm.rocks/mcp, tick 'Gestão de atividades dos projetos' in 'Permissões adicionais (opcional)' if you change activities, and click 'Autorizar acesso'. Disconnect and connect is not enough."
   IF <input:errorText> is not "none" → STOP. Say: "<input:tool> returned <input:errorText>. That is not a missing permission: fix the argument the error names (field, problem, hint) and call it again."
8. SAVE: group = the item of <saved:groups> whose tools list contains <input:tool> (empty if none, or if <input:tool> is "none")
   IF <saved:group> is not empty → STOP. Say: "The new install still lacks <input:tool>. <the howToEnable text of <saved:group>, verbatim>"
   IF <input:request> is not "none" → switch to playbook route.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: connection <saved:credential>; workspace access <saved:access> <saved:grant> | n/a
Done: read-only; <saved:count> tools; scopes <saved:scopes> | n/a
Evidence: get_mcp_connection_info → credential <saved:credential>, <saved:count> tools; missing: <title of each item of <saved:groups>> | none | `lpm mcp status` → <saved:count> tools
Pending: <for each item of <saved:groups>: its title — its howToEnable, verbatim> | none
Next: <the STOP text that ended the run | none — the connector has every scope | <input:tool> is now available: ask your request again>
```
credential: oauth | api_key | agent_credential | session; workspace access: single | all, from step 1. Never claim a tool is available unless step 1 or step 8 showed it in no missing group.
