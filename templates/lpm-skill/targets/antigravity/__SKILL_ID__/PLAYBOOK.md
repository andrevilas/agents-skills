# __DISPLAY_NAME__

This bundle adapts the `__SKILL_ID__` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to operate `__WORKFLOW_SCOPE__` over the `lpm` MCP.

## Current LPM Baseline

- MCP endpoint: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`
- Resolve people through scoped project, workspace, or team membership when needed.
- Prefer least privilege for access-related workflows.
- Evidence that helps recreate or analyze scenarios/tests should be attached as recoverable LPM activity evidence.
- Treat Workspace AI and Gen App Builder as cost-governed capabilities.

## Operator Prompt

`__OPERATOR_STANCE__`

## Workflow Summary

### Primary Flow

1. Resolve the workflow scope.
2. Inspect the relevant LPM entities.
3. Apply the minimum mutation needed.
4. Record or communicate the operational consequence.

## Guardrails

- Read current LPM context before mutation.
- Preserve traceability between context, decision, action, and evidence.
- If the workflow touches remote execution, autonomous queues, credentials, or evidence, define onboarding, least-privilege, output sanitization, cleanup, smoke, and pending-job closure rules.
- If validation includes Playwright/browser/UI screenshots, attach them to the relevant LPM activity before closure.
- If the workflow touches Workspace AI, Gen App Builder, or AISH, use deterministic context first and keep expensive AI features bounded by benefit, limits, fallback, and evidence.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
