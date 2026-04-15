# LPM Capability Map For Workspace Administration

Use this file when the user asks for structural or administrative actions over the `lpm` MCP.

## Core Tool Groups

- Projects: `list_projects`, `get_project`, `create_project`, `update_project`, `archive_project`, `unarchive_project`, `delete_project`
- Teams: `list_teams`, `get_team`, `create_team`, `update_team`, `delete_team`
- Team members: `list_team_members`, `add_team_member`, `remove_team_member`
- Labels: `list_labels`, `create_label`, `update_label`, `delete_label`
- Cycles: `list_cycles`, `get_cycle`, `create_cycle`, `update_cycle`, `delete_cycle`
- Milestones: `list_milestones`, `get_milestone`, `create_milestone`, `update_milestone`, `delete_milestone`
- Notifications: `list_notifications`, `create_notification`, `mark_notification_read`
- Access: `list_api_keys`, `create_api_key`, `delete_api_key`

## Operating Mappings

### Portfolio Governance

1. Use `list_projects` and `get_project`.
2. Use `update_project`, `archive_project`, or `unarchive_project` for reversible cleanup.
3. Use `delete_project` only when permanent removal is explicitly desired.

### Team Maintenance

1. Use `list_teams` and `list_team_members`.
2. Use `create_team` only when ownership boundaries need a new container.
3. Use `add_team_member` and `remove_team_member` deliberately.

### Taxonomy Hygiene

1. Use `list_labels`, `list_cycles`, and `list_milestones`.
2. Prefer updates and normalization before net-new entities.

### Notification And Access Review

1. Use `list_notifications` to inspect operational noise.
2. Use `mark_notification_read` to close resolved items.
3. Use API key tools only for explicit access administration.

## Guardrails

- Prefer reversible mutations.
- Inspect existing structures before creating new ones.
- Do not delete active entities without clear confirmation.
