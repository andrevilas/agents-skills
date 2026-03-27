# LPM Capability Map

Use this file when the user asks for a lifecycle-management action and you need to map it to the `lpm` MCP surface.

## Core Tool Groups

### Structure

- Projects: `list_projects`, `create_project`, `update_project`, `delete_project`, `archive_project`, `unarchive_project`, `get_project`
- Teams: `list_teams`, `create_team`, `update_team`, `delete_team`, `get_team`
- Team members: `list_team_members`, `add_team_member`, `remove_team_member`
- Users: `get_user`

### Planning

- Cycles: `list_cycles`, `create_cycle`, `update_cycle`, `get_cycle`, `delete_cycle`
- Milestones: `list_milestones`, `create_milestone`, `update_milestone`, `get_milestone`, `delete_milestone`
- Labels: `list_labels`, `create_label`, `update_label`, `delete_label`

### Execution

- Issues: `list_issues`, `create_issue`, `update_issue`, `get_issue`, `delete_issue`
- Issue links: `list_issue_links`, `create_issue_link`, `delete_issue_link`

### Communication

- Comments: `list_comments`, `create_comment`, `update_comment`, `delete_comment`
- Notifications: `list_notifications`, `create_notification`, `mark_notification_read`

### Analytics And Access

- Analytics: `get_project_analytics`
- API keys: `list_api_keys`, `create_api_key`, `delete_api_key`

## Operating Mappings

### Project Kickoff

1. Use `create_project`.
2. Use `list_labels` before `create_label`.
3. Use `create_team` and `add_team_member` when the project needs a dedicated team.
4. Use `create_milestone` for major delivery checkpoints.

### Sprint Planning

1. Use `create_cycle` for the sprint container.
2. Use `list_issues` to inspect backlog candidates.
3. Use `update_issue` to assign `cycleId`, `assigneeId`, `priority`, and `milestoneId`.
4. Use `create_issue_link` for explicit dependencies.

### Daily Sync

1. Use `list_issues` with `status: "in-progress"`.
2. Use `get_issue` and `list_comments` before changing issue status.
3. Use `create_comment` for stale work follow-ups.
4. Use `create_notification` for deadlines, assignments, and blocker escalation.

### Monitoring

1. Use `get_project_analytics` before making delivery-health claims.
2. Use `list_issue_links` to inspect blocking topology when burndown stalls.
3. Use `list_notifications` to check whether the system is already surfacing a risk.
4. If no cycle is `active`, infer the current execution batch from open issues and nearest planned cycle dates.

## Guardrails

- Do not create labels without checking `list_labels` first.
- Do not move an issue to `done` before checking `get_issue`, `list_comments`, and, when relevant, `list_issue_links`.
- Do not claim a blocker was cleared unless links or comments confirm the dependency was handled.
- Prefer `archive_project` over `delete_project` unless permanent removal is explicitly intended.
- Normalize mixed link spellings such as `related-to` and `relates_to` before reporting dependency patterns.
