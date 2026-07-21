---
name: __SKILL_ID__
description: __ONE_LINE_DESCRIPTION__
---

# __DISPLAY_NAME__

Use this skill when the task is `__WORKFLOW_SCOPE__` over the `lpm` MCP.

## When To Use

Use this skill when the user asks to:

- execute `__WORKFLOW_SCOPE__`
- inspect context before mutating related entities
- keep the workflow separate from adjacent LPM responsibilities

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP is available at:

- `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`

The current LPM MCP exposes these tool groups:

- `__PRIMARY_TOOLS__`

## Operating Principles

1. Context first.
   Inspect the current project, workspace, or workflow state before changing anything.

2. Stable boundaries.
   Keep this skill focused on its primary workflow rather than absorbing adjacent responsibilities.

3. Traceability always.
   Preserve explicit links between source context, operational actions, and follow-up work.

4. Recoverable evidence.
   Evidence that can help recreate or analyze scenarios, tests, validations, incidents, or releases must be attached to LPM activity evidence. Comments, local paths, chat excerpts, or external IDs are context, not a substitute for recoverable attachments.

## Workflows

## 1. Primary Flow

1. Resolve the scope in `lpm`.
2. Inspect the relevant entities.
3. Apply the minimum mutation that satisfies the workflow.
4. Record any meaningful decision or consequence.

## Guardrails

- Do not create duplicate structures without checking current state.
- Do not mutate adjacent workflow objects unless the user explicitly wants that.
- Do not infer critical context when the MCP already exposes a canonical read.
- Do not use global user enumeration; resolve people through project, workspace, or team membership when needed.
- If the workflow touches remote execution, autonomous queues, credentials, or evidence, define onboarding, least-privilege, output sanitization, cleanup, smoke, and pending-job closure rules.
- If the workflow includes visual validation, browser smoke, UI QA, or Playwright, attach captured screenshots to the relevant LPM activity before reporting closure.
- If the workflow touches Workspace AI, Gen App Builder, or AISH, apply `docs/ai-cost-benefit-governance.md`: deterministic context first, AI only when it improves the workflow, expensive features only with limits, fallback, and evidence.
