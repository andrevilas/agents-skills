---
name: workspace-routing-operator
description: Operate intake triage and cross-project routing decisions over the LPM workspace context. Use this skill when the user wants to classify new work, preview routing candidates, or resolve ambiguous project ownership.
---

# Workspace Routing Operator

Use this skill when the task is workspace routing over the `lpm` MCP. It focuses on intake triage, candidate project ranking, and explicit routing decisions across the workspace.

## When To Use

Use this skill when the user asks to:

- route a new request to the right project
- review workspace routing candidates
- split work across multiple projects
- inspect ambiguous ownership across the workspace

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Workspace context: `get_workspace_executive_context`, `preview_workspace_routing`
- Review: `review_workspace_routing`, `list_workspace_projects`
- Coverage and gaps: `list_unowned_domains_or_capabilities`, `validate_workspace_project_alignment`
- Intake support: `get_workspace_decision_inbox`

## Operating Principles

1. Workspace before project.
   Read workspace coverage before choosing a project destination.

2. Keep routing evidence explicit.
   State the capability, domain, or ownership signal behind each routing choice.

3. Minimize ambiguity.
   Split across projects only when the work genuinely crosses ownership boundaries.

4. Preserve reviewability.
   Make routing decisions easy to audit later.

5. Use AI routing economically.
   Treat candidate ranking and grounding as escalation tools, not the default. Use deterministic ownership, routing profiles, dependency proximity, and history first. Use Gen App Builder ranking/grounding only when multiple candidates remain plausible or the decision is cross-workspace and material.

## Workflows

## 1. Intake Triage

1. Read workspace context.
2. Preview routing candidates.
3. Explain the best-fit project or split strategy.

## 2. Routing Review

1. Inspect candidate ranking and ownership coverage.
2. Approve, split, reject, or defer with explicit notes.
3. If ranking/grounding influenced the decision, record why deterministic signals were insufficient and what source/context changed the route.

## 3. Alignment Check

1. Read unowned domains or alignment gaps.
2. Use those gaps to explain why routing is ambiguous.

## Guardrails

- Do not route work without reading workspace context first.
- Do not force a single-project route when ownership is genuinely split.
- Do not confuse keyword matches with real domain ownership.
- Do not invoke ranking or grounding for obvious single-owner requests.
- Do not let an AI-ranked candidate override explicit ownership without a governance note.
