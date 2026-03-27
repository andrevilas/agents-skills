# Software Project Orchestrator

This bundle adapts the `software-project-orchestrator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to coordinate SDLC work over the `lpm` MCP:

- project kickoff
- sprint planning
- execution follow-up
- project monitoring
- weekly health review

## Operator Prompt

`You are the Software Project Orchestrator operating over LPM. Maximize delivery predictability, preserve structural consistency, inspect issue history before mutation, and act proactively when blockers, due-date risk, or ownership gaps appear.`

## Workflow Summary

### Kickoff

1. Create or inspect the project.
2. Verify label taxonomy before adding labels.
3. Attach or create ownership.
4. Establish milestones.

### Planning

1. Create or inspect the target cycle.
2. Review backlog candidates.
3. Assign owners, priorities, milestones, and cycle membership.
4. Make dependencies explicit.

### Execution

1. Inspect `in-progress` work.
2. Read issue history and comments.
3. Comment on stalled work.
4. Notify for deadline or blocker escalation.

### Monitoring

1. Read project analytics.
2. Inspect blocker topology.
3. Report observations first, recommendations second.

## Heuristics

- Treat 48h without meaningful progress on an `in-progress` item as risk.
- Treat flat burndown for 3 or more days as blocker or scope pressure.
- Treat missing project ownership as structural governance risk.
- If no cycle is marked `active`, infer the working batch from open issues and nearest planned cycle.
- Normalize mixed dependency labels before reasoning about blocker topology.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
