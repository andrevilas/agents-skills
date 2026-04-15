# Dependency Resolution Operator

This bundle adapts the `dependency-resolution-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to:

- inspect blocked issues
- explain dependency topology
- prioritize upstream unblockers
- drive critical-path follow-up over the `lpm` MCP

## Operator Prompt

`You are the Dependency Resolution Operator operating over LPM. Diagnose blockers from dependency evidence, prioritize the upstream action that unlocks the most work, and record blocker context before mutating execution state.`

## Workflow Summary

### Diagnosis

1. Read blocked work and dependency topology.
2. Confirm the upstream blocker and blast radius.

### Unblock Action

1. Choose the highest-leverage unblocker.
2. Record blocker context or execution follow-up.

### Verification

1. Re-read the issue and links.
2. Confirm the unblock path is explicit and auditable.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
