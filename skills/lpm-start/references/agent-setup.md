# Agent setup: connect an agent to the LPM MCP server
Load when: background on agent MCP configs; playbook agent-setup already holds the commands
Applies to: lpm-start    Source: lpm `server.ts` (MCP auth middleware), `src/cli/lpm.ts`, `src/cli/config.ts`, `src/server/mcpConnectionInfo.ts`, `src/lib/oauthScopeContract.ts`; `codex mcp add --help`, `claude mcp add --help`, `gemini mcp add --help`, `agy mcp add --help`; card `get_mcp_connection_info`

## Summary
- One endpoint: `https://lpm.rocks/mcp` (Streamable HTTP). Never a `*.run.app` URL.
- A personal LPM API key goes in the header `x-api-key`. Sent as `Authorization: Bearer` it is rejected.
- An `lpm_mcp_` agent credential works as `Authorization: Bearer` or `x-api-key`.
- OAuth (ChatGPT/Claude connectors, no key) exposes 76 tools; an API key exposes the tools of its profile.
- A personal key always comes from the env var `LPM_API_KEY`; an `lpm_mcp_` credential may come from `LPM_MCP_CREDENTIAL` in an agent config (the `lpm` CLI reads only `LPM_API_KEY`). Never print it, paste it in chat or store it in a git repository.
- After setup, restart the agent; in the new session call {{tool:get_mcp_connection_info}} to verify (`lpm_mcp_`: `lpm mcp status`).

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `https://lpm.rocks/mcp` | MCP endpoint; `https://lpm.rocks/sse` is the legacy SSE path | use `/mcp`; replace any `run.app` URL with it |
| `x-api-key: <key>` | personal API key auth | a plain key in `Authorization: Bearer` returns "API key or OAuth token is missing" |
| `Authorization: Bearer lpm_mcp_…` | owner-agent credential auth | this credential cannot call {{tool:get_mcp_connection_info}}; verify with `lpm mcp status` |
| OAuth connector | 76 tools in scopes `workspace:read`, `portfolio:read`, `roadmap:manage`, `mcp:advisor` (default) and `portfolio:manage` (opt-in) | to create or update activities, tick "Gestão de atividades dos projetos" under "Permissões adicionais (opcional)" |
| ChatGPT disconnect/connect | reuses the old authorization; never opens the LPM consent page, never refreshes the tool list | to add a scope or new tools: remove the connector, install it again, tick the box |
| Codex | `~/.codex/config.toml`, table `[mcp_servers.LPM]`; `env_http_headers` maps a header to an env var name | Codex must start with `LPM_API_KEY` in its environment |
| Claude Code | `claude mcp add --transport http --scope user`; tools show as `mcp__lpm__<name>` | user scope keeps the key out of the repository's `.mcp.json` |
| Antigravity | `agy mcp add` writes `~/.gemini/config/mcp_config.json`; flags go before the server name | check with `agy mcp list`, or the UI: Additional Options (...) > MCP Servers |
| Gemini CLI | `gemini mcp add` defaults to `--scope project` | always pass `--scope user`; check with `gemini mcp list` |
| Cursor | `lpm mcp cursor-config` prints the full `mcpServers.lpm` JSON for `~/.cursor/mcp.json`, key included | redirect it to a private file (`umask 077`) in your home, never to the chat or `/tmp`; merge only `mcpServers.lpm`, then delete the file |
| lpm CLI | config file `~/.lpm/config.json` (or `$LPM_CLI_CONFIG_DIR/config.json`); env `LPM_API_KEY` and `LPM_API_URL` override it | the default base URL is `http://localhost:4173`: always pass `--base-url https://lpm.rocks` (no `/mcp`) |
| `lpm auth status` | prints "Authenticated against <baseUrl>" and "Available MCP tools: <n>" | pass when the base URL is `https://lpm.rocks` and n > 0 |
| help article `integracao-oauth-e-mcp-chatgpt-claude-gemini` | shows stdio examples with CLI commands that do not exist | do not copy them; use the rows above |

## Rules
1. Use the server name `LPM` in Codex and `lpm` in the other agents, so tool prefixes match the skills.
2. Keep every other MCP server entry of the config unchanged.
3. Write the key only through env var expansion (`$LPM_API_KEY`, or `LPM_MCP_CREDENTIAL` for an `lpm_mcp_` credential) or `env_http_headers`; never type its value.
4. Never write a key into a file inside a git repository (project scope, `.mcp.json`, `.gemini/settings.json`).
5. One credential and one CLI config dir per agent: set `LPM_CLI_CONFIG_DIR` when two agents share a machine.
6. An existing LPM entry with `run.app` in its URL: change only the URL to `https://lpm.rocks/mcp`.
7. After any change, restart the agent; in the new session verify with {{tool:get_mcp_connection_info}} (OAuth `availableToolCount` > 0, key `allowedToolCount` > 0), `lpm mcp status` for `lpm_mcp_` (`availableTools` > 0) or `lpm auth status`.

## Examples
```text
example: Codex, personal API key (~/.codex/config.toml)
[mcp_servers.LPM]
url = "https://lpm.rocks/mcp"
env_http_headers = { "x-api-key" = "LPM_API_KEY" }
```
```text
example: Codex, lpm_mcp_ agent credential stored in env var LPM_MCP_CREDENTIAL
codex mcp add LPM --url https://lpm.rocks/mcp --bearer-token-env-var LPM_MCP_CREDENTIAL
```
```text
example: Claude Code (API key; omit --header to use OAuth with 76 tools, then authenticate in /mcp)
claude mcp add --transport http --scope user lpm https://lpm.rocks/mcp --header "x-api-key: $LPM_API_KEY"
```
```text
example: Antigravity
agy mcp add --header "x-api-key: $LPM_API_KEY" lpm https://lpm.rocks/mcp
```
```text
example: Gemini CLI
gemini mcp add --scope user --transport http --header "x-api-key: $LPM_API_KEY" lpm https://lpm.rocks/mcp
```
```text
example: Cursor (the output holds the key: merge its mcpServers.lpm into ~/.cursor/mcp.json, then delete the file)
(umask 077; LPM_API_URL=https://lpm.rocks lpm mcp cursor-config > ~/.lpm-cursor.json)
rm ~/.lpm-cursor.json
```
```text
example: lpm CLI
lpm auth login --api-key "$LPM_API_KEY" --base-url https://lpm.rocks
lpm auth status
lpm mcp status
```
```text
example: ChatGPT connector
Add a connector with URL https://lpm.rocks/mcp. On "Autorizar uma conexão" choose the
workspace, tick "Gestão de atividades dos projetos" under "Permissões adicionais (opcional)"
to create or update activities, then click "Autorizar acesso".
```
