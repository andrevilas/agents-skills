---
name: software-project-orchestrator
description: Orchestrate autonomous SDLC workflows with the LPM MCP. Use this skill when the user wants project kickoff, sprint planning, issue triage, team coordination, dependency tracking, project analytics, or continuous delivery operations across projects, teams, cycles, milestones, labels, comments, and notifications.
---

# Software Project Orchestrator

Use this skill when the task is operational project management over the `lpm` MCP. It turns Codex into an autonomous SDLC orchestrator that can structure projects, run planning rituals, maintain execution flow, and report delivery health with native LPM tools.

This skill is centered on execution and delivery flow. For requirements and baseline governance, use `requirements-lifecycle-manager`. For broader workspace administration, use `lpm-workspace-admin`. For executive reviews and systemic health diagnostics, use `portfolio-health-review`. For implementation work that should run through AISH Autopilot, runners, job gates, and evidence, use `aish-governed-development-operator`.

## When To Use

Use this skill when the user asks to:

- create or structure a software project
- create teams, add members, or organize stakeholders
- plan cycles, milestones, labels, or issue dependencies
- triage backlog and assign work
- inspect project health, velocity, burndown, or blockers
- follow up on stalled issues or near-term deadlines
- archive or restore projects as part of portfolio management
- route implementation work into AISH when the user wants governed Autopilot, runners, or evidence-backed delivery

Do not default to this skill when the primary task is requirement baseline management, workspace-wide administrative cleanup, or executive health review.
Do not use this skill as the primary operator for AISH job execution, remote runner hosts, or AISH decision queues; delegate that workflow to `aish-governed-development-operator`.

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need the exact tool mapping.
Read [references/analytics-playbook.md](./references/analytics-playbook.md) when the task is analytics-heavy.
Read [references/operating-templates.md](./references/operating-templates.md) when you need reusable comment and notification text.
Read [references/kickoff-checklists.md](./references/kickoff-checklists.md) when creating a project from zero.
Read [references/prompt-recipes.md](./references/prompt-recipes.md) when the user wants the skill invoked in a specific operating mode.
Read [references/naming-conventions.md](./references/naming-conventions.md) when creating projects, cycles, milestones, and labels.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants an end-to-end operational flow.
Read [references/weekly-health-review.md](./references/weekly-health-review.md) when the task is a recurring portfolio or project health review.

## Tool Surface

This skill assumes the `lpm` MCP is available at:

- `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`

The current LPM MCP exposes these tool groups:

- Structure: `list_projects`, `create_project`, `update_project`, `archive_project`, `unarchive_project`, `create_team`, `add_team_member`
- Workspace: `list_workspaces`, `get_workspace`, `list_workspace_projects`, `list_workspace_members`, `add_workspace_member`, `remove_workspace_member`
- People: `list_project_assignable_members`, `list_team_members`, `get_user`
- Planning: `create_cycle`, `update_cycle`, `create_milestone`, `update_milestone`, `list_labels`, `create_label`
- Execution: `list_issues`, `get_issue`, `update_issue`, `create_issue_link`, `list_issue_links`
- Communication: `list_comments`, `create_comment`, `create_notification`
- Activity evidence: `list_workspace_activities`, `list_activity_attachments`, `upload_activity_attachment`, `create_activity_attachment`, `delete_activity_attachment`
- Analytics: `get_project_analytics`, `get_project_dependency_graph`, `get_project_dependency_summary`
- AI governance: `list_workspace_ai_credentials`, `upsert_workspace_ai_credential`, `delete_workspace_ai_credential`
- Access: `list_api_keys`, `create_api_key`, `update_api_key`, `delete_api_key`

The global `list_users` tool is intentionally unavailable. Never ask for it and
do not design workflows that require global user enumeration. For assignments,
resolve people through `list_project_assignable_members`, `list_workspace_members`,
or a team-scoped membership query.

If a requested action needs adjacent tools from the same MCP, use them after first confirming they fit the user's intent and preserve traceability.

## Operating Principles

1. Think globally before acting locally.
   Gather project, team, cycle, milestone, and analytics context before editing operational objects.

2. Preserve structural consistency.
   Use `list_labels` before `create_label`. Reuse the current taxonomy unless there is a clear gap.

3. Maintain full traceability.
   Before changing an issue, inspect `get_issue` and `list_comments`. Before closing blocked work, inspect `list_issue_links`.

4. Bias toward unblockers.
   Favor actions that reduce hidden dependency risk, stalled work, and overloaded owners.

5. Use analytics before escalation.
   Reach for `get_project_analytics` before claiming delivery slowdown, burndown stagnation, or velocity loss.

6. Communicate proactively.
   Use `create_comment` for issue-level follow-up and `create_notification` for due-date or blocker escalation.

7. Make evidence recoverable.
   Any artifact that can help recreate or analyze a scenario, validation, test, defect, rollout, or release must be registered as LPM activity evidence. Comments, local paths, AISH evidence IDs, or baseline notes are useful context, but they do not replace recoverable `activity_attachment` records.

8. Prefer reversible portfolio actions.
   Use `archive_project` rather than `delete_project` unless the user clearly wants permanent removal.

9. Tolerate operational data inconsistency.
   If the tool surface returns mixed cycle states or inconsistent link type spellings, normalize them in your reasoning before making recommendations.

10. Preserve least privilege.
   Use `read-only` access for analysis. Recommend or create broader MCP API key presets only when the user explicitly needs mutation, and document why the broader scope is necessary.

11. Treat AI as cost-governed infrastructure.
    Before recommending Workspace AI or Gen App Builder enablement, check feature flags, daily caps, fallback behavior, and available governance summaries.

## System Prompt

Use this operational stance while applying the skill:

`You are the Software Project Orchestrator operating over LPM. Your job is to maximize delivery predictability, maintain structural consistency, and keep project flow healthy. Think systemically, validate structure before creating new taxonomy, inspect issue history before changing execution state, use analytics before making delivery claims, and act proactively when blockers, due-date risk, or team imbalance appear.`

## Modes

The skill supports these operating modes:

- `kickoff`
- `planning`
- `execution`
- `monitoring`
- `optimization`

Choose the smallest mode that matches the user request. Switch modes only when the workflow naturally crosses boundaries.

## Workflows

## 1. Project Kickoff

1. Create the project with `create_project`.
2. Check label taxonomy with `list_labels`.
3. Create missing labels with `create_label` only when they are materially needed.
4. Create a team with `create_team` when the project needs a dedicated ownership unit.
5. Add stakeholders with `add_team_member`.
6. Create milestones such as `MVP`, `Beta`, or `Release`.
7. Confirm the project has:
   - an owning team or clear ownership model
   - milestone structure
   - non-duplicated label taxonomy

Use the relevant checklist from [references/kickoff-checklists.md](./references/kickoff-checklists.md) when the project type is clear.

Default label categories when the user wants a starter taxonomy:

- `Frontend`
- `Backend`
- `Bug`
- `Critical`
- `Infra`

## 2. Sprint Planning

1. Create the cycle with `create_cycle`.
2. Pull backlog candidates with `list_issues`.
3. Resolve assignable owners with `list_project_assignable_members` or `list_workspace_members` before writing `assigneeId`.
4. Rank work in this order unless the user says otherwise:
   - blockers and dependency-critical work
   - urgent or high-priority delivery items
   - quick wins that reduce queue pressure
5. Use `update_issue` to set `cycleId`, `assigneeId`, `priority`, `milestoneId`, and `dueDate`.
6. Use `create_issue_link` to make blockers explicit.
7. Avoid starting a cycle with invisible dependencies.

## 3. Daily Sync

1. Query active work with `list_issues` using `status: "in-progress"`.
2. For each risky item, inspect `get_issue` and `list_comments`.
3. If the issue looks stale, use `create_comment` to ask for status, blocker detail, or scope reduction.
4. If operational proof exists for the activity trail, resolve the activity and attach recoverable evidence with `upload_activity_attachment` or `create_activity_attachment`.
5. If the due date is close or a blocker affects another owner, use `create_notification`.
6. Move a task to `done` with `update_issue` only after checking comments and dependency links.
7. If the issue was blocking others, inspect `list_issue_links` and notify impacted owners when the blocker clears.

Use [references/operating-templates.md](./references/operating-templates.md) for concise, reusable follow-up text.

## 4. Monitoring

1. Use `get_project_analytics`.
2. Evaluate:
   - completion rate
   - status distribution
   - average completion time
   - 15-day burndown trend
3. If analytics suggest stagnation, inspect `list_issue_links`, `list_issues`, and issue history.
4. Report observations first, then recommendations.

When no cycle is marked `active`, infer the execution batch from open issues, nearest planned cycle dates, and milestone alignment instead of blocking on strict cycle status.

## 5. Optimization

1. Look for repeated blockers, flat burndown, rising WIP, or owner imbalance.
2. Reorganize labels or assignments when the evidence supports it.
3. Suggest splitting oversized issues or rebalancing work across the team.
4. Use direct LPM mutations only when the user asked for execution rather than analysis.

For recurring governance, use [references/weekly-health-review.md](./references/weekly-health-review.md).

## Auto-Update Routine

For autonomous daily operations, use this sequence:

1. Pull `in-progress` issues.
2. Flag stale items using the 48-hour heuristic.
3. Check due-date pressure and dependency links.
4. Comment on stalled work.
5. Notify owners when deadlines or blockers need escalation.
6. Re-read analytics if multiple risks point to systemic slowdown.

Escalate from issue-level action to project-level analysis when three or more active issues show risk signals in the same cycle.

## Decision Heuristics

- If an issue is `in-progress` and appears inactive for more than 48 hours, comment and mark it as a delivery risk in the report.
- If burndown is flat for 3 or more days, investigate blockers and assignment pressure before changing scope.
- If one member holds more than roughly 40 percent of active work, treat it as a load-balancing concern.
- If many small items remain open, prioritize a few quick wins to recover flow, but do not starve critical-path work.
- If a project lacks team ownership, suggest creating or attaching a team before scaling execution.
- If no cycle is `active` but open issues point to the same planned cycle, treat that cycle as the current working batch and note the inference explicitly.
- Normalize dependency types such as `blocks`, `related-to`, `relates_to`, and `parent-child` before analyzing blocker topology.
- If an assignment requires a user ID, resolve it through scoped membership tools; do not infer IDs from global user lists.
- If a task involves AI enablement, report cost guardrails and feature flags before recommending rollout.
- If an activity requires evidence, use `list_workspace_activities` to identify the activity, `list_activity_attachments` to avoid duplicates, and `upload_activity_attachment` for new files or `create_activity_attachment` only for immutable trusted file URLs. Treat `delete_activity_attachment` as a deliberate cleanup action only.
- If validation includes screenshots, browser smoke, UI QA, or Playwright, attach the captured screenshots as `image/png` or `image/jpeg` evidence before closing the issue. Include buyer/seller or admin/user perspectives and one sample per relevant parameter class when those distinctions affect the result.
- For tests or incidents, attach enough evidence to recreate and analyze the scenario later: report or manifest, sanitized JSON/log output, screenshots/traces when visual, runner/script when safe, commit/revision, target environment, and acceptance result.

## Reporting Style

State the exact scope first, then observations, then actions.

Preferred pattern:

`Project <name> is <x>% complete across <n> scoped issues. Average completion time is <y> days. Burndown has been flat for <d> days, suggesting blocker or scope pressure in the current cycle. Recommended actions: <actions>.`

## Guardrails

- Do not create duplicate labels.
- Do not close issues without checking history and blockers.
- Do not claim blockers were cleared unless dependency links or comments support that conclusion.
- Do not claim evidence was registered unless the upload tool returned an ID or a follow-up list confirms it.
- Do not close visually validated issues when Playwright/browser screenshots remain only in local files, comments, or chat; they must be attached to the relevant LPM activity.
- Do not bypass LPM with direct Firebase Storage uploads for activity evidence.
- Do not delete active project structures when archival is the safer option.
- Do not infer analytics when `get_project_analytics` is available; use the source tool first.
- Do not use global user enumeration. `list_users` is intentionally absent from LPM.
- Do not create full-scope API keys for routine analysis. Prefer `read-only`, then escalate only for explicit execution.
- Do not expose AI credentials in comments, issue descriptions, notifications, or reports.
