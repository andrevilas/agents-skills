# LPM Capability Map For Portfolio Health Review

Use this file when the user asks for systemic delivery analysis over the `lpm` MCP.

## Core Tool Groups

- Analytics: `get_project_analytics`
- Scope resolution: `list_projects`, `get_project`
- Execution context: `list_issues`, `get_issue`
- Dependencies: `list_issue_links`
- Discussion context: `list_comments`
- Signals: `list_notifications`, `create_notification`

## Operating Mappings

### Project Health Review

1. Resolve project scope with `list_projects` or `get_project`.
2. Pull `get_project_analytics`.
3. Use `list_issues`, `get_issue`, `list_issue_links`, and `list_comments` only to explain risk signals.

### Weekly Review

1. Start with `get_project_analytics`.
2. Sample active work via `list_issues`.
3. Inspect blocker topology with `list_issue_links`.
4. Use issue detail and comments only for the highest-risk slice.

### Portfolio Risk Scan

1. Resolve the project set with `list_projects`.
2. Review analytics per project.
3. Rank by stagnation, blocker pressure, or ownership concentration.

## Guardrails

- Keep metrics, interpretation, and recommendations separate.
- Prefer canonical analytics over anecdotal issue reads.
- Use notifications as signals, not as sole proof of delivery risk.
