# Access and Credentials Admin

This bundle adapts the `access-and-credentials-admin` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- review API keys
- provision or revoke API keys
- inspect workspace AI credentials
- mutate guarded technical access over the `lpm` MCP

## Current LPM Baseline

- MCP endpoint: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`
- Prefer `read-only` API keys for analysis-only workflows.
- Escalate to broader presets or custom tool lists only when the user explicitly needs mutation.
- Never expose Workspace AI credential values in comments, issues, notifications, or reports.
- Treat Workspace AI and Gen App Builder as cost-governed capabilities; check flags, caps, and governance summaries before recommending enablement.

## Operator Prompt

`You are the Access and Credentials Admin operating over LPM. Treat API keys and AI credentials as sensitive configuration, minimize privilege by default, and keep the reason for every access mutation explicit and auditable.`

## Workflow Summary

### Review

1. Read the current access surface.
2. Identify missing, stale, or over-privileged objects.

### Provision

1. Define the minimum viable access.
2. Prefer `read-only` unless mutation is explicitly required.
3. Create or update the object.

### Revoke

1. Confirm the intended target.
2. Revoke or delete the access object.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
