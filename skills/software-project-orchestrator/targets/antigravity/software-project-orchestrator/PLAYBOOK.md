# Software Project Orchestrator

This bundle adapts the `software-project-orchestrator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to coordinate SDLC work over the `lpm` MCP:

- project kickoff
- sprint planning
- execution follow-up
- project monitoring
- weekly health review

## Current LPM Baseline

- MCP endpoint: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`
- Use scoped membership tools for assignment context: `list_project_assignable_members` or `list_workspace_members`.
- Do not use or request `list_users`; global user enumeration is intentionally unavailable.
- Prefer least-privilege MCP API key presets. Use `read-only` for analysis and escalate to broader scopes only when the user explicitly asks for mutation.
- Use `upload_activity_attachment` for new activity evidence files. Do not bypass LPM with direct Storage uploads.
- Use `list_activity_attachments` to confirm evidence and avoid duplicates; use `delete_activity_attachment` only for explicit cleanup.
- Evidence that can help recreate or analyze scenarios/tests must be recoverable from the LPM UI or API. Comments, local paths, AISH evidence IDs, or baseline notes are not enough.
- Visual validation, browser smoke, UI QA, and Playwright runs must attach the captured screenshots as activity evidence.
- Treat Workspace AI and Gen App Builder as cost-governed capabilities. Check runtime flags, daily caps, and governance summaries before recommending enablement.

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
3. Resolve assignable owners through project/workspace membership before assigning work.
4. Assign owners, priorities, milestones, and cycle membership.
5. Make dependencies explicit.

### Execution

1. Inspect `in-progress` work.
2. Read issue history and comments.
3. Attach operational proof with `upload_activity_attachment` or trusted `create_activity_attachment` when evidence exists for the activity trail.
4. Comment on stalled work.
5. Notify for deadline or blocker escalation.

### Monitoring

1. Read project analytics.
2. Inspect blocker topology.
3. Report observations first, recommendations second.

## Guardrails

- Do not create duplicate labels, cycles, milestones, projects, or teams before checking existing structure.
- Do not close issues without checking history, comments, and dependency links.
- Do not claim blockers were cleared unless dependency evidence or comments support it.
- Do not close visually validated issues when screenshots remain only in local files, comments, or chat.
- Do not bypass LPM with direct Storage uploads for activity evidence.
- Do not use global user enumeration; resolve people through project or workspace membership.
- Use `aish-governed-development-operator` for AISH job execution, remote runner hosts, AISH decision queues, and evidence-backed implementation cycles.

## Heuristics

- Treat 48h without meaningful progress on an `in-progress` item as risk.
- Treat flat burndown for 3 or more days as blocker or scope pressure.
- Treat missing project ownership as structural governance risk.
- If no cycle is marked `active`, infer the working batch from open issues and nearest planned cycle.
- Normalize mixed dependency labels before reasoning about blocker topology.
- Treat global user lookup as an anti-pattern; keep all people discovery scoped to project or workspace context.
- Treat activity evidence as a backend-mediated LPM operation: resolve the activity first, upload or attach through MCP, then verify with `list_activity_attachments`.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
