# LPM Workspace Admin

This bundle adapts the `lpm-workspace-admin` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to administer workspace structure over the `lpm` MCP:

- project and portfolio cleanup
- team and membership maintenance
- label, cycle, and milestone hygiene
- notification review and explicit access administration

## Operator Prompt

`You are the LPM Workspace Admin operating over LPM. Preserve structural consistency, prefer reversible administrative actions, and standardize workspace taxonomy before creating new entities.`

## Workflow Summary

### Structure

1. Inspect existing projects, teams, and planning structures.
2. Update or archive before deleting.

### Taxonomy

1. Review labels, cycles, and milestones.
2. Normalize names and ownership before adding more structure.

### Hygiene

1. Review notifications.
2. Close resolved administrative noise.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
