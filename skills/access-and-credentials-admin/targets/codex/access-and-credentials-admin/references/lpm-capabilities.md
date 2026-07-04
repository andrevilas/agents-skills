# LPM Capabilities

Primary tool groups used by this skill:

- API key lifecycle
- workspace AI credential lifecycle
- workspace scope read for guarded access changes

Current endpoint:

- `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`

Guardrails:

- use `list_api_keys` before creating or updating API keys
- prefer `read-only` for analysis-only workflows
- use broader presets or custom tool lists only for explicit mutation
- never expose Workspace AI credential values in comments, issues, notifications, or reports
- treat Workspace AI and Gen App Builder as cost-governed surfaces with flags, caps, and fallback behavior
