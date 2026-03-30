# End-to-End Examples

Use these examples when the user wants complete administrative workflows over the `lpm` MCP.

Replace placeholder IDs with the actual IDs returned by LPM.

## Example 1: Workspace Taxonomy Cleanup

Goal: standardize labels and planning structure without creating unnecessary duplicates.

1. `list_labels`
2. Review overlapping labels such as `backend`, `Backend`, and `BE`
3. `update_label`
   - normalize the preferred shared naming
4. `list_cycles`
   - `projectId: "<project-id>"`
5. `list_milestones`
   - `projectId: "<project-id>"`
6. `update_cycle` or `update_milestone`
   - normalize names where the same delivery concept is fragmented

Expected outcome:

- label taxonomy is cleaner
- planning structures are easier to understand across the workspace

## Example 2: Project Portfolio Cleanup

Goal: archive stale structures and retain useful history safely.

1. `list_projects`
2. Identify inactive or duplicated projects
3. `get_project`
   - inspect the projects in the cleanup set
4. `archive_project`
   - for stale but historically useful projects
5. `update_project`
   - rename or clarify ambiguous active projects
6. `delete_project`
   - only when hard removal is explicitly intended

Expected outcome:

- stale projects are removed from the active surface
- active portfolio naming is clearer

## Example 3: Team Maintenance And Administrative Signals

Goal: clean up team ownership and reduce administrative noise.

1. `list_teams`
2. `list_team_members`
   - inspect the ownership set for one team
3. `add_team_member` or `remove_team_member`
   - align the team to current ownership boundaries
4. `list_notifications`
5. `mark_notification_read`
   - close resolved noise
6. `create_notification`
   - only when an administrative escalation is still needed

Expected outcome:

- team ownership matches reality
- notifications better reflect unresolved administrative work

## Placeholder Rules

- Never fabricate IDs.
- Prefer reversible administration before deletion.
- Do not create API keys as part of a generic cleanup flow unless explicitly requested.
