# Kickoff Checklists

Use these checklists during project creation so the initial structure is coherent from day 0.

## Default Software Project

- Create project key and description.
- Confirm whether the project needs a dedicated team.
- Create or attach the team.
- Add core stakeholders.
- Create milestones: `MVP`, `Beta`, `Release`.
- Check existing labels before adding new ones.
- Create only the labels needed for triage and reporting.
- Confirm ownership, timeline, and initial issue intake path.

## Product Feature Delivery

- Confirm owning product or engineering team.
- Create milestones around rollout phases.
- Create labels for feature area and severity only if missing.
- Ensure dependency links will be used for cross-team work.
- Create an initial cycle if execution begins immediately.

## Platform Or Infra Work

- Confirm owning infra/platform team.
- Prefer labels like `Infra`, `Reliability`, `Critical` only when missing.
- Create milestones around environment readiness and production rollout.
- Pay extra attention to dependencies and due dates because infra work tends to unblock multiple teams.

## Bugfix Or Stabilization Stream

- Confirm whether the work belongs in an existing project or a dedicated stabilization project.
- Reuse severity labels before creating any new taxonomy.
- Create milestones around stabilization checkpoints or release cutoffs.
- Prioritize notification paths for critical regressions.

## Exit Criteria

The kickoff is structurally complete when:

- project exists
- ownership exists
- milestones exist
- label taxonomy is non-duplicated
- execution can start without ambiguity about team, tracking, or delivery checkpoints
