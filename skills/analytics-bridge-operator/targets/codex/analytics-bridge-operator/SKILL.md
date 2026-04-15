---
name: analytics-bridge-operator
description: Operate analytics bridge runs, observability, and entity sync workflows over the LPM MCP. Use this skill when the user wants to create bridge runs, inspect sync health, or recover analytics coverage for a workspace or project.
---

# Analytics Bridge Operator

Use this skill when the task is analytics bridge operation over the `lpm` MCP. It focuses on bridge run lifecycle, observability, and targeted analytics recovery.

## When To Use

Use this skill when the user asks to:

- create or process an analytics bridge run
- inspect bridge observability
- recover analytics coverage for a project or workspace
- choose between incremental and backfill sync

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Runs: `create_analytics_bridge_run`, `process_analytics_bridge_run`, `list_analytics_bridge_runs`
- Observability: `get_analytics_bridge_observability`
- Scope reads: `get_project`, `get_workspace`

## Operating Principles

1. Scope the run explicitly.
   Decide workspace or project scope before creating a run.

2. Use observability first.
   Read bridge health before escalating to backfill or reset.

3. Minimize destructive recovery.
   Prefer incremental or partial reset over broad backfill when possible.

4. Keep entity coverage explicit.
   Name the entity sets affected by the run.

## Workflows

## 1. Bridge Health Review

1. Read current observability.
2. Identify missing or stale entities.
3. Choose the lightest recovery path.

## 2. Run Creation

1. Select scope and mode.
2. Choose entity types and any reset entities.
3. Create the run with explicit reason.

## 3. Run Processing

1. Process the bridge run.
2. Re-read observability and recent runs.
3. Confirm whether coverage recovered.

## Guardrails

- Do not run broad backfills without evidence from observability.
- Do not reset unrelated entities casually.
- Do not describe analytics coverage as healthy without bridge evidence.
