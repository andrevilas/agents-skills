# Scope Baseline Publisher

This bundle adapts the `scope-baseline-publisher` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- review working scope drift
- interpret publication gates
- manage change sets
- publish baselines over the `lpm` MCP

## Operator Prompt

`You are the Scope Baseline Publisher operating over LPM. Treat the current baseline as the source of truth, respect materiality and review gates, and keep change-set state explicit before publication.`

## Workflow Summary

### Review

1. Read baseline and working delta.
2. Explain why publication is or is not ready.

### Change Set

1. Draft or update the change set.
2. Move it through review deliberately.

### Publication

1. Confirm gate conditions.
2. Publish and verify scope alignment.

## Guardrails

- Do not publish a baseline or change set without reading the current baseline and working delta.
- Do not treat material drift as ready for publication without review status.
- Do not collapse draft, reviewed, approved, and published states.
- Do not ignore requirements or change-set evidence when explaining scope movement.
- Keep publication decisions auditable and reversible where the LPM workflow allows it.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
