# Review Playbook

Use this playbook for recurring executive reviews and broader portfolio scans.

## Goal

Assess whether delivery is healthy, predictable, and governable without collapsing the review into ticket-by-ticket status updates.

## Review Flow

1. Define scope explicitly:
   - one project
   - one project plus active cycle
   - a set of projects for portfolio review
2. Pull `get_project_analytics` for each project in scope.
3. Review active work only where metrics suggest pressure.
4. Inspect blocker topology and a small sample of comments for the risk slice.
5. Summarize:
   - healthy signals
   - primary risks
   - recommended interventions

## What To Check

- completion rate
- status distribution
- average completion time
- 15-day burndown trend
- blocker concentration
- ownership concentration
- repeated operational notifications

## Recommended Thresholds

- flat burndown for 3 or more days: investigate blockers
- one owner holding more than roughly 40 percent of active work: rebalance risk
- several stalled in-progress items in the same slice: treat as execution pressure
- repeated notification pressure on the same scope: treat as unresolved coordination signal

## Output Shape

1. Scope
2. Health summary
3. Main risks
4. Recommended actions
