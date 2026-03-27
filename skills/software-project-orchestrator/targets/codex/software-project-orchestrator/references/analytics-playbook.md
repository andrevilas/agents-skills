# Analytics Playbook

Use this file when the task requires delivery-health analysis over the `lpm` MCP.

## Scope First

Define the reporting scope explicitly:

- one project
- optionally one cycle
- optionally one milestone
- optionally one team slice or issue subset

State the scope before making any claim.

## Primary Source

Use `get_project_analytics` as the canonical source whenever possible. It provides:

- status distribution across `backlog`, `todo`, `in-progress`, `done`, and `canceled`
- completion rate
- average completion time in days
- 15-day burndown series for remaining issues

Use issue-level tools only to explain the analytics, not to replace them without reason.

## Recommended Workflow

1. Resolve the target project with `get_project` or `list_projects`.
2. Pull analytics with `get_project_analytics`.
3. If the user asks why the project is slowing down, inspect:
   - `list_issues`
   - `get_issue`
   - `list_issue_links`
   - `list_comments`
4. Separate metric facts from interpretation.

## Interpretation Heuristics

### Status Distribution

- High `in-progress` with low `done` suggests WIP overflow.
- High `backlog` with thin `todo` may indicate poor intake grooming.
- Rising `canceled` volume may indicate churn or planning instability.

### Completion Rate

- Use the tool's completion rate directly.
- If canceled work materially changes the conclusion, say so in the narrative.

### Average Completion Time

- Treat a rising average completion time as a velocity warning, not proof of failure by itself.
- Compare the value against current blocker patterns and assignment distribution before escalating.

### Burndown

- Flat burndown for 3 or more days suggests blockers, hidden scope, or excessive WIP.
- Burndown drops with low completion rate can indicate bulk closure or data hygiene issues; verify with issue activity before concluding.

## Recommended Follow-Up Analysis

When analytics show delivery risk:

1. Find stalled `in-progress` issues.
2. Inspect blocker links.
3. Check whether due dates cluster on the same owners.
4. Identify whether a single member owns more than roughly 40 percent of active work.
5. Recommend redistribution, dependency cleanup, or issue splitting.

## Report Template

Use concise operational language:

`Project <name> is <x>% complete across <n> scoped issues. Status mix is <counts>. Average completion time is <y> days. Burndown has been flat for <d> days, which suggests blocker or scope pressure. Recommended next actions: <actions>.`
