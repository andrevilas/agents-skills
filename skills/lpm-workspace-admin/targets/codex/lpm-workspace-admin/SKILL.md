---
name: lpm-workspace-admin
description: Administer LPM workspace structure across projects, teams, labels, cycles, milestones, notifications, and reversible portfolio actions. Use this skill when the user wants structural cleanup, governance, workspace taxonomy maintenance, or portfolio administration over the LPM MCP.
---

# LPM Workspace Admin

Use this skill when the task is workspace governance over the `lpm` MCP. It covers structural administration that is broader than one delivery flow: projects, teams, labels, cycles, milestones, notifications, and cleanup actions.

## When To Use

Use this skill when the user asks to:

- create, rename, archive, restore, or delete project structures
- create or maintain teams and team membership
- standardize labels across projects
- inspect or clean up cycles and milestones
- review notifications or hygiene tasks
- rationalize duplicated structures or stale entities

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end administrative flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Projects: `list_projects`, `get_project`, `create_project`, `update_project`, `archive_project`, `unarchive_project`, `delete_project`
- Teams: `list_teams`, `get_team`, `create_team`, `update_team`, `delete_team`, `list_team_members`, `add_team_member`, `remove_team_member`
- Planning structures: `list_cycles`, `get_cycle`, `create_cycle`, `update_cycle`, `delete_cycle`, `list_milestones`, `get_milestone`, `create_milestone`, `update_milestone`, `delete_milestone`
- Taxonomy: `list_labels`, `create_label`, `update_label`, `delete_label`
- Communication hygiene: `list_notifications`, `mark_notification_read`, `create_notification`
- Access: `list_api_keys`, `create_api_key`, `delete_api_key`

## Operating Principles

1. Prefer reversible actions first.
   Archive before delete unless permanent removal is clearly intended.

2. Inspect before creating.
   Reuse projects, teams, labels, cycles, and milestones when the structure already exists.

3. Standardize taxonomy.
   Normalize label, cycle, and milestone naming before adding net-new entities.

4. Preserve shared workspace health.
   Optimize for clarity across the workspace, not just the local project request.

5. Keep administrative changes auditable.
   State the structural reason for each mutation.

## Workflows

## 1. Portfolio Cleanup

1. List projects in scope.
2. Identify archived, stale, duplicated, or inconsistently named structures.
3. Prefer `update_project`, `archive_project`, or `unarchive_project` before deletion.

## 2. Team And Access Maintenance

1. Inspect teams and current membership.
2. Add or remove members intentionally.
3. Create a team only when ownership boundaries justify it.
4. Treat API key creation and deletion as explicit administrative actions.

## 3. Taxonomy Hygiene

1. Inspect existing labels, cycles, and milestones.
2. Rename or update inconsistent structures before creating more.
3. Keep naming conventions stable across related projects.

## 4. Notification Review

1. Read open notifications.
2. Mark resolved noise as read.
3. Create notifications only when escalation adds operational value.

## Decision Heuristics

- If two labels represent the same concept with cosmetic differences, standardize before expanding the taxonomy.
- If a project is inactive but still useful historically, archive it instead of deleting it.
- If a team has no meaningful ownership boundary, avoid creating another one.
- If cycles or milestones overlap without clear purpose, consolidate naming and ownership before adding more.

## Guardrails

- Do not delete live workspace structures casually.
- Do not create duplicate teams or labels without checking the current catalog.
- Do not treat notifications as a task queue substitute when comments or issue updates would be more appropriate.
- Do not create API keys unless the user explicitly asked for access provisioning.
