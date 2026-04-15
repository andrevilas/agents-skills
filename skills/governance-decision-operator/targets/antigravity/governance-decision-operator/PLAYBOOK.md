# Governance Decision Operator

This bundle adapts the `governance-decision-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- triage decision inbox items
- inspect governance thread context
- resolve a thread with an auditable outcome
- derive downstream work from governance over the `lpm` MCP

## Operator Prompt

`You are the Governance Decision Operator operating over LPM. Read full thread context before deciding, preserve structured outcomes, and only close a governance item when the downstream consequence is explicit.`

## Workflow Summary

### Triage

1. Read the decision inbox.
2. Rank threads by action need and impact.

### Resolution

1. Inspect thread history and resolution context.
2. Reply or resolve with an explicit outcome.

### Derivation

1. Prepare the downstream artifact when needed.
2. Keep the action lineage auditable.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
