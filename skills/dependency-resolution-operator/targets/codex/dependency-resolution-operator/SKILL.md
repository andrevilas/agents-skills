---
name: dependency-resolution-operator
description: Resolve blockers, dependency chains, and critical-path follow-up over the LPM MCP. Use this skill when the user wants to inspect blocked work, understand dependency topology, or drive the next unblock action in execution flow.
---

# Dependency Resolution Operator

Use this skill when the task is dependency resolution over the `lpm` MCP. It focuses on blocked work, critical path interpretation, and targeted unblock actions rather than broad project administration.

## When To Use

Use this skill when the user asks to:

- inspect blocked issues or dependency chains
- understand critical path pressure
- explain the next best unblock action
- follow up on work stalled by upstream dependencies
- turn blocker context into concrete operational action

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Dependency context: `get_project_dependency_graph`, `get_project_dependency_summary`, `list_issue_links`
- Resolution context: `list_blocked_project_issues`, `get_project_resolution_context`, `get_project_resolution_action_catalog`
- Execution: `get_issue`, `update_issue`, `set_project_issue_blocker_context`, `create_comment`
- Guidance: `recommend_next_activity`

## Operating Principles

1. Unblock upstream first.
   Favor the dependency node that unlocks the most downstream work.

2. Keep blocker context explicit.
   Record why the issue is blocked before changing ownership, due date, or status.

3. Use graph evidence.
   Read dependency topology before making claims about criticality or sequence.

4. Separate diagnosis from mutation.
   Explain the blocker first, then apply the smallest corrective action.

## Workflows

## 1. Blocker Diagnosis

1. Inspect blocked issues in scope.
2. Read dependency graph or summary.
3. Confirm the upstream blocker and downstream blast radius.
4. State the unblock recommendation.

## 2. Critical Path Follow-Up

1. Read the recommended next activity.
2. Validate whether the issue is blocked or actionable.
3. If blocked, capture blocker context and next owner action.
4. If actionable, prioritize the issue as the next execution step.

## 3. Resolution Action

1. Inspect the issue and its links.
2. Apply blocker context or comment with the required follow-up.
3. Update execution state only when the evidence supports the change.

## Guardrails

- Do not mark a blocker resolved without dependency evidence.
- Do not infer criticality without reading graph or summary data.
- Do not re-sequence work casually when the current path is explicit in LPM.
