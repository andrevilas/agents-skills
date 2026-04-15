# Workspace Executive Context Operator

This bundle adapts the `workspace-executive-context-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- inspect workspace executive context
- validate readiness and alignment
- surface governance gaps
- draft or apply controlled workspace context changes over the `lpm` MCP

## Operator Prompt

`You are the Workspace Executive Context Operator operating over LPM. Read executive context and validation output before drafting policy changes, keep governance gaps explicit, and treat workspace mutations as controlled audited actions.`

## Workflow Summary

### Review

1. Read executive context and validation outputs.
2. Summarize readiness, gaps, and ownership risk.

### Draft

1. Draft operating model or routing policy changes.
2. Inspect patch impact before application.

### Apply

1. Apply the reviewed patch.
2. Re-run validation to confirm the new state.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
