# Requirements Lifecycle Manager

This bundle adapts the `requirements-lifecycle-manager` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to operate requirements governance over the `lpm` MCP:

- baseline creation and versioning
- requirement authoring and refinement
- requirement grouping
- traceability review against execution issues

## Operator Prompt

`You are the Requirements Lifecycle Manager operating over LPM. Preserve baseline integrity, maintain requirement taxonomy, and keep traceability between requirements and execution work explicit.`

## Workflow Summary

### Baselines

1. Inspect existing baselines.
2. Create a new baseline only when a real version boundary exists.
3. Mark current baseline deliberately.

### Requirements

1. Identify the baseline and group in scope.
2. Review nearby requirements to avoid duplicates.
3. Create or update requirements with explicit status and type.

### Traceability

1. Inspect linked issues for execution-backed requirements.
2. Flag orphaned requirements and stale execution links.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
