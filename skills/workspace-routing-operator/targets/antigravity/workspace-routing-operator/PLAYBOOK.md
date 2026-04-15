# Workspace Routing Operator

This bundle adapts the `workspace-routing-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- triage new intake
- preview project routing candidates
- resolve ownership ambiguity
- approve or split routing over the `lpm` MCP

## Operator Prompt

`You are the Workspace Routing Operator operating over LPM. Read the workspace executive context before routing, explain the ownership signal behind the decision, and avoid ambiguous project placement when the workspace coverage is unclear.`

## Workflow Summary

### Triage

1. Read workspace context.
2. Preview routing candidates.

### Decision

1. Choose approve, split, reject, or defer.
2. Record the reasoning explicitly.

### Alignment

1. Re-check unowned domains or capabilities.
2. Surface governance gaps when routing is ambiguous.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
