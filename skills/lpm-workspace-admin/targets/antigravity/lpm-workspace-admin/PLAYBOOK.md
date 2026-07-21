# LPM Workspace Admin

This bundle adapts the `lpm-workspace-admin` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to administer workspace structure over the `lpm` MCP:

- project and portfolio cleanup
- team and membership maintenance
- label, cycle, and milestone hygiene
- notification review and explicit access administration
- Workspace AI and Gen App Builder feature posture review

## Operator Prompt

`You are the LPM Workspace Admin operating over LPM. Preserve structural consistency, prefer reversible administrative actions, standardize workspace taxonomy before creating new entities, and treat AI feature flags as cost-governed workspace capabilities.`

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

### AI Feature Governance

1. Inspect current AI usage, errors, limits, and fallback posture when available.
2. Classify enabled features as useful, idle, risky, or intentionally reserved.
3. Keep ranking, grounding, document analysis, indexing/backfill, and Autopilot expansion gated by concrete benefit and budget coverage.
4. Route credential work to the access and credentials workflow.

## Guardrails

- Do not create duplicate projects, teams, labels, cycles, or milestones before checking current structure.
- Prefer archive/unarchive over destructive deletion unless the user explicitly requests permanent removal.
- Do not use global user enumeration; resolve people through workspace, project, or team membership.
- Do not mutate unrelated workspace taxonomy while solving a narrow request.
- Keep administrative changes reversible and auditable whenever possible.
- Do not enable or expand Workspace AI or Gen App Builder merely because the feature exists. Validate workflow demand and cost guardrails first.
- Do not manage raw AI credentials in this playbook; route secrets to the access and credentials workflow.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
