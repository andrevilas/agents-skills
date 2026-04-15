# LPM Capability Map For Requirements

Use this file when the user asks for requirements operations over the `lpm` MCP.

## Core Tool Groups

- Baselines: `list_requirement_baselines`, `create_requirement_baseline`, `update_requirement_baseline`, `delete_requirement_baseline`
- Groups: `list_requirement_groups`, `create_requirement_group`, `update_requirement_group`, `delete_requirement_group`
- Requirements: `list_requirements`, `create_requirement`, `update_requirement`, `delete_requirement`
- Execution context: `list_issues`, `get_issue`
- Project context: `get_project`

## Operating Mappings

### Establish A Source Baseline

1. Use `list_requirement_baselines`.
2. Use `create_requirement_baseline` only when the version boundary is intentional.
3. Use `update_requirement_baseline` to mark the current baseline deliberately.

### Organize Requirement Domains

1. Use `list_requirement_groups`.
2. Use `create_requirement_group` for missing domains.
3. Use `update_requirement_group` when names drift from the actual domain model.

### Author And Maintain Requirements

1. Use `list_requirements` scoped by baseline.
2. Use `create_requirement` for new records.
3. Use `update_requirement` to refine title, description, status, type, group, or linked issue.
4. Use `delete_requirement` only when hard removal is explicitly intended.

### Traceability Review

1. Use `list_requirements` for baseline scope.
2. Use `get_issue` when a requirement claims execution linkage.
3. Flag broken or stale issue links before editing baseline structure.

## Guardrails

- Do not create a new baseline for minor wording edits alone.
- Do not rename groups casually if existing requirements already depend on the taxonomy.
- Prefer preserving history through status and baseline transitions before deletion.
