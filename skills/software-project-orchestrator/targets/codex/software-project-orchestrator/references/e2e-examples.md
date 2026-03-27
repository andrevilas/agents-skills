# End-to-End Examples

Use these examples when the user wants the full operational flow rather than a single action.

Replace placeholder IDs with the actual IDs returned by LPM.

## Example 1: New Project Kickoff

Goal: create a project, attach ownership, establish taxonomy, and define delivery checkpoints.

1. `create_project`
   - `name: "MOB Checkout Revamp"`
   - `key: "MOB"`
   - `description: "Improve checkout reliability and conversion"`
2. `list_labels`
3. `create_label`
   - only for missing labels such as `Frontend`, `Backend`, `Critical`
4. `create_team`
   - `name: "Mobile Team"`
5. `add_team_member`
   - add engineering and stakeholder ownership
6. `create_milestone`
   - `MVP`
   - `Beta`
   - `Production Release`

Expected outcome:

- project exists
- ownership exists
- milestones exist
- label taxonomy is usable without duplication

## Example 2: Sprint Planning

Goal: create a cycle and move the right issues into it with explicit dependencies.

1. `create_cycle`
   - `projectId: "<project-id>"`
   - `name: "2026-03-30 to 2026-04-10"`
2. `list_issues`
   - `projectId: "<project-id>"`
   - focus on backlog or todo work
3. `update_issue`
   - assign `cycleId`
   - assign `assigneeId`
   - set `priority`
   - set `milestoneId` if relevant
4. `create_issue_link`
   - connect blocking work explicitly

Expected outcome:

- cycle exists
- selected issues are assigned
- blockers are visible

## Example 3: Daily Auto-Update Pass

Goal: keep active work moving without waiting for manual follow-up.

1. `list_issues`
   - `status: "in-progress"`
2. For each risk item:
   - `get_issue`
   - `list_comments`
3. If stale:
   - `create_comment`
4. If near due date or critical blocker:
   - `create_notification`
5. If resolved:
   - `list_issue_links`
   - `update_issue` to `done`

Expected outcome:

- stalled work receives follow-up
- delivery risk gets escalated
- done-state changes preserve traceability

## Example 4: Health Review To Action

Goal: move from analytics to concrete project intervention.

1. `get_project_analytics`
2. If burndown is flat or velocity worsens:
   - `list_issues`
   - `get_issue` on the riskiest items
   - `list_issue_links`
3. If a blocker is confirmed:
   - `create_comment` on the blocked issue
   - `create_notification` to the relevant owner
4. If assignment is imbalanced:
   - recommend reassignment or execute `update_issue` when explicitly requested

Expected outcome:

- analytics are translated into visible operational action

## Placeholder Rules

- Never fabricate IDs.
- Resolve IDs from LPM before mutation.
- If multiple matching projects or issues exist, disambiguate before writing.
