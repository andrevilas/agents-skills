# End-to-End Examples

Use these examples when the user wants a full analytics-led review rather than a narrow metric explanation.

Replace placeholder IDs with the actual IDs returned by LPM.

## Example 1: Weekly Project Health Review

Goal: move from analytics to a concise executive readout with evidence-backed actions.

1. `get_project`
   - `projectId: "<project-id>"`
2. `get_project_analytics`
   - `projectId: "<project-id>"`
3. If the metrics show pressure:
   - `list_issues`
   - focus on `in-progress` and near-due work
4. `list_issue_links`
   - inspect blocker topology
5. For the riskiest issues only:
   - `get_issue`
   - `list_comments`
6. Summarize:
   - scope
   - metric facts
   - main risks
   - recommended actions

Expected outcome:

- the review starts from canonical analytics
- risks are tied to concrete evidence

## Example 2: Portfolio Risk Scan

Goal: rank several projects by delivery risk and recommend the smallest interventions with highest leverage.

1. `list_projects`
2. For each project in scope:
   - `get_project_analytics`
3. Rank projects by:
   - flat burndown
   - high WIP
   - rising completion time
   - ownership concentration
4. For the top-risk slice only:
   - `list_issues`
   - `list_issue_links`
5. Summarize which projects need intervention first and why

Expected outcome:

- the portfolio review is evidence-based
- the response prioritizes the few projects that matter most

## Example 3: Diagnose Flat Burndown

Goal: explain why progress appears stalled without defaulting to anecdotal ticket reading.

1. `get_project_analytics`
2. If burndown is flat for 3 or more days:
   - `list_issues`
   - inspect active work volume
3. `list_issue_links`
   - inspect blocked topology
4. Sample the riskiest issues:
   - `get_issue`
   - `list_comments`
5. If repeated operational pressure is visible:
   - `list_notifications`
6. Recommend the smallest corrective actions

Expected outcome:

- the diagnosis stays metric-led
- issue-level evidence explains, rather than replaces, the analytics

## Placeholder Rules

- Never fabricate IDs.
- Pull analytics before drawing conclusions.
- Do not mutate execution objects unless the user explicitly changes the task from review to action.
