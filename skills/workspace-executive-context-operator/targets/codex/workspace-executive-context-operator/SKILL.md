---
name: workspace-executive-context-operator
description: Operate workspace executive context review, validation, and controlled updates over the LPM MCP. Use this skill when the user wants to inspect executive context gaps, validate workspace readiness, or apply structured workspace context changes.
---

# Workspace Executive Context Operator

Use this skill when the task is workspace executive context governance over the `lpm` MCP. It focuses on readiness, alignment, gap analysis, and controlled operating-model updates for the workspace.

## When To Use

Use this skill when the user asks to:

- review workspace executive context
- identify governance gaps or missing ownership
- validate workspace readiness for assisted operation
- validate alignment between workspace and projects
- draft or apply operating-model or routing-policy changes

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Context reads: `get_workspace_executive_context`, `get_workspace_owner_surface`, `get_workspace_read_model`
- Validation: `validate_workspace_context_completeness`, `validate_workspace_project_alignment`, `generate_workspace_readiness_report`
- Gaps: `list_workspace_context_gaps`, `list_missing_governance_assignments`, `list_unowned_domains_or_capabilities`
- Drafts and updates: `draft_workspace_operating_model`, `draft_workspace_routing_policy`, `apply_workspace_context_update`

## Operating Principles

1. Read before drafting.
   Inspect current executive context before proposing any change.

2. Treat validation as input, not decoration.
   Use readiness and alignment checks to justify structural changes.

3. Protect sensitive mutations.
   Separate draft, review, and apply steps for executive context updates.

4. Keep ownership explicit.
   Surface missing roles and unowned domains before expanding policy.

## Workflows

## 1. Executive Context Review

1. Read executive context and owner surface.
2. Validate completeness and project alignment.
3. Summarize gaps, risks, and next actions.

## 2. Operating Model Draft

1. Draft workspace operating model or routing policy.
2. Review patch impact and validation details.
3. Prepare for explicit application.

## 3. Controlled Context Update

1. Confirm the target patch and reason.
2. Apply the workspace context update.
3. Re-run validation to verify the new state.

## Guardrails

- Do not apply workspace context changes without reading validation output first.
- Do not hide missing governance roles behind narrative summaries.
- Do not treat executive context mutation as routine project-level editing.
