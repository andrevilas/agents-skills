---
name: scope-baseline-publisher
description: Operate working scope review, change sets, and baseline publication over the LPM MCP. Use this skill when the user wants to inspect scope drift, prepare a change set, or publish a reviewed baseline.
---

# Scope Baseline Publisher

Use this skill when the task is scope publication governance over the `lpm` MCP. It focuses on baseline drift, change-set drafting, publication gates, and explicit scope release.

## When To Use

Use this skill when the user asks to:

- inspect differences between working scope and current baseline
- prepare or review a change set
- understand whether publication should be blocked
- publish a new baseline from current scope

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Scope: `get_project_scope_resolution_context`, `list_working_scope_delta_entities`
- Change sets: `create_change_set`, `update_project_change_set_status`, `list_change_sets`
- Publication: `publish_project_baseline_from_resolution`, `publish_change_set`
- Baselines and requirements: `list_requirement_baselines`, `list_requirements`

## Operating Principles

1. Baseline first.
   Always inspect the current baseline before proposing publication.

2. Respect publication gates.
   Treat formal review requirements as hard governance constraints.

3. Separate draft from release.
   Make change-set state explicit before publication.

4. Preserve traceability.
   Keep the link between delta, review rationale, and published baseline clear.

## Workflows

## 1. Scope Drift Review

1. Read current baseline and working scope delta.
2. Explain material changes and their signals.
3. Decide whether a change set is required.

## 2. Change Set Handling

1. Draft or inspect the current change set.
2. Update status through the review lifecycle.
3. Record publication target clearly.

## 3. Baseline Publication

1. Confirm gate conditions.
2. Publish the reviewed baseline.
3. Re-read scope state to verify alignment.

## Guardrails

- Do not publish scope without reading the current delta.
- Do not bypass formal review when materiality requires it.
- Do not blur baseline, change set, and working scope states.
