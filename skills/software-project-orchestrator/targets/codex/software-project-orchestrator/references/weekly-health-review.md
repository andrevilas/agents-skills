# Weekly Health Review

Use this playbook for a recurring weekly review. This is broader than the daily sync and should focus on systemic health, not only issue-level nudges.

## Goal

Assess whether the project is structurally healthy, progressing predictably, and staffed in a balanced way.

## Review Flow

1. Resolve the target scope:
   - project
   - optionally active cycle
   - optionally one milestone slice
2. Pull `get_project_analytics`.
3. Review current active work with `list_issues`.
4. Inspect blocker topology with `list_issue_links`.
5. Sample the highest-risk issues with:
   - `get_issue`
   - `list_comments`
6. Summarize:
   - what is healthy
   - what is slowing down
   - which actions should happen next

If no cycle is marked `active`, infer the current execution batch from:

- open issue membership by `cycleId`
- nearest future or overlapping cycle dates
- milestone grouping when cycle state is not trustworthy

## What To Check

### Delivery Flow

- completion rate
- average completion time
- 15-day burndown trend
- ratio of `in-progress` to `done`

### Structural Hygiene

- duplicated or excessive labels
- milestones that no longer reflect real delivery checkpoints
- cycles with too much carry-over

### Coordination Risk

- stale blocked issues
- owners carrying too much active work
- cross-team dependencies without movement
- projects with `teamId: null` or unclear ownership even when teams exist in the workspace

## Recommended Thresholds

- flat burndown for 3 or more days: investigate blockers
- one owner holding more than roughly 40 percent of active work: rebalance
- multiple stale in-progress issues in the same cycle: escalate to cycle-level risk
- repeated due-date misses in one milestone: inspect milestone scope
- open work with no attached team ownership: treat as structural governance risk

## Output Shape

Use this structure:

1. Scope
2. Health summary
3. Main risks
4. Recommended actions

Example:

`Scope: project MOB, active cycle 2026-03-30 to 2026-04-10. Health summary: 68% completion, average completion time 2.6 days, burndown flat for 3 days. Main risks: two blocked payment issues and concentrated ownership in one engineer. Recommended actions: reassign one critical issue, escalate blocker ownership, and split the largest remaining item.`
