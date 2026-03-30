---
name: portfolio-health-review
description: Review project and portfolio health over the LPM MCP using analytics, burndown, blocker topology, workload concentration, and notification signals. Use this skill when the user wants an executive health readout, weekly review, risk scan, or delivery diagnostics rather than day-to-day execution updates.
---

# Portfolio Health Review

Use this skill when the task is executive or systemic delivery analysis over the `lpm` MCP. It turns Codex into a portfolio health reviewer that reads canonical analytics first, then drills into issues, blockers, and ownership only to explain risk signals.

## When To Use

Use this skill when the user asks to:

- review project health
- run a weekly health review
- scan portfolio delivery risk
- explain a flat burndown or weak completion trend
- identify concentrated ownership or dependency pressure
- summarize what leadership should pay attention to next

Do not default to this skill when the primary request is to mutate execution state or perform workspace administration.

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/review-playbook.md](./references/review-playbook.md) when the task is a recurring or executive-style review.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants realistic end-to-end examples.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Analytics: `get_project_analytics`
- Project scope: `list_projects`, `get_project`
- Execution context: `list_issues`, `get_issue`
- Dependencies: `list_issue_links`
- Discussion context: `list_comments`
- Signaling: `list_notifications`, `create_notification`

## Operating Principles

1. Scope first.
   State the exact project, cycle, milestone, or portfolio slice before making claims.

2. Use canonical metrics first.
   Pull `get_project_analytics` before forming a delivery-health narrative.

3. Separate fact from interpretation.
   Keep raw metrics, inferred risks, and recommended actions distinct.

4. Explain metrics with evidence.
   Use issue, blocker, and comment inspection only to explain the analytics, not to replace them.

5. Escalate only with pattern evidence.
   Treat repeated stall signals, blocked topology, or owner concentration as systemic only when multiple indicators align.

## Workflows

## 1. Project Health Review

1. Resolve project scope.
2. Pull analytics.
3. Summarize status distribution, completion rate, completion time, and burndown shape.
4. Drill into blockers and risky work only where the metrics suggest pressure.
5. Return a concise health summary and actions.

## 2. Weekly Executive Review

1. Resolve the current working batch.
2. Pull analytics for the target project.
3. Inspect active work, blocker topology, and a small sample of highest-risk issues.
4. Summarize what is healthy, what is slowing down, and what should change next week.

## 3. Portfolio Risk Scan

1. Identify projects in scope.
2. Review each target project's health signals.
3. Rank projects by immediate delivery risk, governance risk, or staffing concentration.
4. Report the highest-signal interventions first.

## Decision Heuristics

- Flat burndown for 3 or more days suggests blockers, hidden scope, or excessive WIP.
- High `in-progress` with low `done` suggests flow pressure.
- Rising average completion time is a warning signal, not proof by itself.
- One owner holding more than roughly 40 percent of active work indicates concentration risk.
- Repeated notifications around the same scope suggest unresolved operational pressure.

## Reporting Style

Use this pattern:

`Scope: <scope>. Health summary: <metric facts>. Main risks: <evidence-backed interpretation>. Recommended actions: <actions>.`

## Guardrails

- Do not infer health without first reading analytics when the tool is available.
- Do not report blocker clearance unless issue links or comments support it.
- Do not turn a thin local signal into a portfolio-wide claim without comparable evidence.
- Do not mutate operational objects unless the user explicitly asks for execution.
