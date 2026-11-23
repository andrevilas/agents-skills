# AGENTS.md — agents-skills

## Propósito
Este repositório padroniza skills, playbooks e adapters compartilhados entre os ambientes **Antigravity** e **Codex CLI**.

## Isolamento de Execução e Sessões LPM

- **Antigravity (AGY):** Utiliza exclusivamente o servidor MCP configurado no Antigravity (`~/.gemini/config/mcp_config.json`) ou o CLI wrapper `lpm-agy` (`LPM_CLI_CONFIG_DIR="$HOME/.lpm/agy"`).
- **Codex CLI:** Utiliza exclusivamente o servidor MCP configurado no Codex (`~/.codex/config.toml`) ou o CLI wrapper `lpm-codex` (`LPM_CLI_CONFIG_DIR="$HOME/.lpm/codex"`).
- **Regra Estrita de Segurança:** É proibido compartilhar API Keys entre os agentes ou sobrescrever o arquivo de credenciais global `~/.lpm/config.json`.
