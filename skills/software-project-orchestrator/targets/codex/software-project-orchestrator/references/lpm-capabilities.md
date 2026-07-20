# LPM Capability Map

Use this file when the user asks for a lifecycle-management action and you need to map it to the `lpm` MCP surface.

Current endpoint:

- `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`

Security baseline:

- `list_users` is intentionally unavailable.
- Assignments must resolve people through project, workspace, or team membership.
- MCP API keys should default to least privilege. Use `read-only` for analysis and broader scopes only for explicit mutation.
- Workspace AI and Gen App Builder are cost-governed surfaces. Check flags, caps, and governance summaries before recommending enablement.

## Core Tool Groups

### Structure

- Projects: `list_projects`, `create_project`, `update_project`, `delete_project`, `archive_project`, `unarchive_project`, `get_project`
- Workspaces: `list_workspaces`, `create_workspace`, `update_workspace`, `get_workspace`, `list_workspace_projects`
- Teams: `list_teams`, `create_team`, `update_team`, `delete_team`, `get_team`
- Team members: `list_team_members`, `add_team_member`, `remove_team_member`
- Workspace members: `list_workspace_members`, `add_workspace_member`, `remove_workspace_member`
- Assignable project members: `list_project_assignable_members`
- Users: `get_user` only for known/scoped user IDs

### Planning

- Cycles: `list_cycles`, `create_cycle`, `update_cycle`, `get_cycle`, `delete_cycle`
- Milestones: `list_milestones`, `create_milestone`, `update_milestone`, `get_milestone`, `delete_milestone`
- Labels: `list_labels`, `create_label`, `update_label`, `delete_label`

### Execution

- Issues: `list_issues`, `create_issue`, `update_issue`, `get_issue`, `delete_issue`
- Issue links: `list_issue_links`, `create_issue_link`, `delete_issue_link`
- Activity evidence: `list_workspace_activities`, `list_activity_attachments`, `upload_activity_attachment`, `create_activity_attachment`, `delete_activity_attachment`

### Communication

- Comments: `list_comments`, `create_comment`, `update_comment`, `delete_comment`
- Notifications: `list_notifications`, `create_notification`, `mark_notification_read`

### Analytics And Access

- Analytics: `get_project_analytics`, `get_project_dependency_graph`, `get_project_dependency_summary`, `get_project_dependency_heatmap`
- Governance: `list_governance_threads`, `create_governance_thread`, `reply_governance_thread`, `resolve_governance_thread_with_decision`
- Workspace AI: `list_workspace_ai_credentials`, `upsert_workspace_ai_credential`, `delete_workspace_ai_credential`
- API keys: `list_api_keys`, `create_api_key`, `update_api_key`, `delete_api_key`
- Operational exports and webhooks: `list_export_requests`, `create_export_request`, `list_webhook_subscriptions`, `create_webhook_subscription`, `update_webhook_subscription`, `delete_webhook_subscription`

## Operating Mappings

### Project Kickoff

1. Use `create_project`.
2. Use `list_labels` before `create_label`.
3. Use `create_team` and `add_team_member` when the project needs a dedicated team.
4. Use `list_workspace_members` or `add_workspace_member` when ownership belongs at workspace level.
5. Use `create_milestone` for major delivery checkpoints.

### Sprint Planning

1. Use `create_cycle` for the sprint container.
2. Use `list_issues` to inspect backlog candidates.
3. Use `list_project_assignable_members` before setting `assigneeId`.
4. Use `update_issue` to assign `cycleId`, `assigneeId`, `priority`, and `milestoneId`.
5. Use `create_issue_link` for explicit dependencies.

### Daily Sync

1. Use `list_issues` with `status: "in-progress"`.
2. Use `get_issue` and `list_comments` before changing issue status.
3. Use `create_comment` for stale work follow-ups.
4. Use `upload_activity_attachment` when the user provides operational proof that should be attached to an activity.
5. Use `create_notification` for deadlines, assignments, and blocker escalation.

### Activity Evidence

1. Resolve the target activity with `list_workspace_activities` and the relevant `projectId`.
2. Use `list_activity_attachments` before adding duplicate evidence to the same activity.
3. Use `upload_activity_attachment` for new evidence files with `contentBase64`, `fileName`, `fileType`, optional `description`, and optional `capturedAt`.
4. Use `create_activity_attachment` only for metadata-only compatibility when the file URL already exists and is intentionally trusted.
5. Attach every artifact that helps recreate or analyze the scenario later: sanitized report, manifest, JSON/log output, screenshots/traces, runner/script, commit/revision, environment, and acceptance result.
6. For visual validation, browser smoke, UI QA, or Playwright, attach screenshots as `image/png` or `image/jpeg`; do not rely only on comments, local paths, baseline notes, or external evidence IDs.
7. After writing evidence, re-read `list_activity_attachments` and confirm the activity shows recoverable attachments before reporting closure.
8. Use `delete_activity_attachment` only when the user explicitly asks to remove evidence or a cleanup is required.

### Monitoring

1. Use `get_project_analytics` before making delivery-health claims.
2. Use `list_issue_links` to inspect blocking topology when burndown stalls.
3. Use `list_notifications` to check whether the system is already surfacing a risk.
4. If no cycle is `active`, infer the current execution batch from open issues and nearest planned cycle dates.

### Access And AI Governance

1. Use `list_api_keys` before creating or changing MCP credentials.
2. For analysis-only workflows, prefer `read-only` API keys.
3. For mutation workflows, choose the narrowest preset or custom tool list that satisfies the requested operation.
4. Use workspace AI credential tools only when the user explicitly asks to configure AI providers.
5. Before recommending Gen App Builder or Workspace AI rollout, check available governance summaries, runtime flags, and daily caps.

## Guardrails

- Do not create labels without checking `list_labels` first.
- Do not move an issue to `done` before checking `get_issue`, `list_comments`, and, when relevant, `list_issue_links`.
- Do not mark evidence as attached unless `list_activity_attachments` confirms the attachment or `upload_activity_attachment` returns an ID.
- Do not close issues whose validation depends on screenshots, traces, or logs while those artifacts exist only in local files, comments, chat, or AISH metadata.
- Do not upload activity evidence outside the LPM backend; the MCP upload contract is `upload_activity_attachment`.
- Do not claim a blocker was cleared unless links or comments confirm the dependency was handled.
- Prefer `archive_project` over `delete_project` unless permanent removal is explicitly intended.
- Normalize mixed link spellings such as `related-to` and `relates_to` before reporting dependency patterns.
- Do not use or request `list_users`.
- Do not enumerate users globally to assign work; use `list_project_assignable_members`, `list_workspace_members`, or `list_team_members`.
- Do not expose Workspace AI credentials in operational comments or reports.
- Do not create broad or full-scope API keys unless the user explicitly needs broad mutation and the reason is recorded.
