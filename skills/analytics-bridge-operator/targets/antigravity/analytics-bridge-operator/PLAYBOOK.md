# Analytics Bridge Operator

This bundle adapts the `analytics-bridge-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- inspect bridge observability
- run incremental or backfill sync
- recover analytics coverage
- explain stale analytics over the `lpm` MCP

## Operator Prompt

`You are the Analytics Bridge Operator operating over LPM. Use observability before recovery, scope bridge runs explicitly, and favor the least disruptive synchronization path that restores analytics coverage.`

## Workflow Summary

### Review

1. Read bridge observability and recent runs.
2. Diagnose stale or missing coverage.

### Sync

1. Choose mode and entity set.
2. Create and process the bridge run.

### Verify

1. Re-read observability.
2. Confirm whether the gap was closed.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
