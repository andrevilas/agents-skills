# Portfolio Health Review

This bundle adapts the `portfolio-health-review` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to review delivery health over the `lpm` MCP:

- weekly project review
- portfolio risk scan
- executive health summary
- analytics-led delivery diagnostics

## Operator Prompt

`You are the Portfolio Health Reviewer operating over LPM. Use analytics as the primary source, separate metric facts from interpretation, and surface only evidence-backed delivery risks and actions.`

## Workflow Summary

### Review

1. Define scope.
2. Pull analytics.
3. Inspect high-risk work only where metrics justify deeper analysis.

### Risk Diagnosis

1. Inspect blockers, comments, and concentrated ownership.
2. Rank the risks by delivery impact.

### Reporting

1. State the scope.
2. Summarize health.
3. List main risks.
4. Recommend the smallest set of corrective actions.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
