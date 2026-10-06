# Planning rules
Load when: planning or starting a cycle, or running a daily sync
Applies to: lpm-plan-work    Source: cards {{tool:get_project_execution_context}}, {{tool:list_cycles}}, {{tool:update_cycle}}, {{tool:update_milestone}}, {{tool:recommend_next_activity}}, {{tool:list_overdue_project_issues}}, {{tool:set_project_issue_estimate}}; legacy digests software-project-orchestrator (§1.5–1.6, §2.3), governed-project-integrity-review (§1.10); help `como-operar-issues-ciclos-e-marcos`

## Summary
Rank work: blockers and dependency-critical first, then urgent/high, then quick wins.
An `in-progress` activity with no update and no comment for 48 h is stale: comment with the stale template.
One person holding more than 40 % of open work is a load concern; 3 or more risky activities in one cycle → {{skill:lpm-review-health}}.
An `active` cycle whose `endDate` passed is an integrity signal: close it or replace it after checking its open work.
Activities, cycles and milestones coordinate execution; a scope doubt is decided in governance.

## Daily sync
Decision row 1 of SKILL.md. Read-only unless the user asks to act on an item.
1. {{tool:get_project_execution_context}}(projectId) → keep `planning.openIssues` (max 50), `planning.activeCycles`, `planning.openMilestones`, `governance`. `governance` items are the owner's decisions: list them, never decide.
2. {{tool:list_blocked_project_issues}}(projectId, limitCount=100) → keep `items[].id`. Connector or "You do not have access to this owner surface" → {{tool:get_project_dependency_summary}}(projectId) → `criticalBlockers`.
3. {{tool:recommend_next_activity}}(projectId) → keep `recommendation.issueId`; `null` → report "no actionable activity".
4. Apply the Rules and Facts below (ranking, 48 h stale, load, stale cycle).
5. User asked to act on a stale item → {{tool:list_comments}}(projectId, issueId) → none in 48 h → SKILL.md row 5 ({{ref:flow-escalate}}) with the stale template (key `stale-<issueId>-<yyyymmdd>`, {{ref:comment-templates}}).

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| cycle `status` `upcoming` \| `active` \| `completed` | the only cycle states; "planned" does not exist | new cycles start `upcoming`; start with `active`; close with `completed` |
| milestone `status` `open` \| `closed` | the only milestone states | close with `closed`; never delete to close |
| `active` cycle with `endDate` < today | integrity signal `stale-active-cycles`; project health is at least `watch` | {{ref:flow-cycles}} steps 6–8 (decision row 2): close or replace it after listing its open activities |
| more than one `active` cycle | the server allows it | report it; ask which one is current |
| no `active` cycle, open work points at one `upcoming` cycle | that cycle is the working batch | say it is an inference in the report |
| {{tool:list_cycles}} / {{tool:list_milestones}} order | unsorted, unpaginated | sort by `startDate` / `targetDate` yourself |
| cycle `completed` / milestone `closed` | does NOT move or close their activities | list open activities first and ask where to move them |
| {{tool:create_cycle}} / {{tool:create_milestone}} | not idempotent; values stored as sent, no date check | re-list before a retry; always send `startDate` / `targetDate` (records without them vanish from read models) |
| `planning.openIssues` of {{tool:get_project_execution_context}} | max 50, not done/canceled, urgent first | more → {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` |
| {{tool:get_project_execution_context}} cost | heavy read; with an API key it also re-points orphan requirements to the current baseline | call once per sync |
| `recommendation.strategy` | `critical-path-actionable`, `upstream-unblocker`, `highest-criticality-actionable`, `fallback-active` | `upstream-unblocker` can point at another project: check `recommendation.projectId` |
| `recommendation == null` | no open activity | report "no actionable activity" |
| stale | `status == "in-progress"`, `updatedAt` and newest comment older than 48 h | comment with the stale template; mark it a delivery risk |
| load | one `assigneeId` holds > 40 % of `todo` + `in-progress` activities | report a load-balancing concern; do not reassign without approval |
| risky activity | stale, overdue or blocked | 3 or more in one cycle → hand off to {{skill:lpm-review-health}} |
| `estimate` | treated as hours; forecast cost = estimate × project hourly rate | estimates move cost and the critical path: show bulk changes first |
| `dueDate` | date-only values compare at 00:00 UTC; an unparsable string never counts as overdue | always send `YYYY-MM-DD` |
| assignee | operational responsibility, not governance authority | never use assignment to grant roles |

## Rules
1. Rank work in this order unless the user says otherwise: blockers and dependency-critical work; urgent or high priority; quick wins that reduce queue pressure. Never starve critical-path work.
2. Before starting a cycle, read {{tool:get_project_dependency_summary}}(projectId): an activity in the cycle with an open blocker outside the cycle → report it and ask before activating ({{ref:flow-cycles}} step 4).
3. Name a cycle with the user-given name (e.g. `Sprint 4 2026`), else `YYYY-MM-DD to YYYY-MM-DD`; name milestones after the outcome, never after a cycle.
4. State the scope first, then facts, then recommendations. Keep metric facts apart from interpretation.
5. Prefer a comment for activity follow-up. Send an in-app notification only for a deadline, blocker or ownership escalation the user asked for. Send both only when the item is stale and time-critical.
6. Never solve a scope doubt by moving activities, cycles or milestones; route it to governance.
7. Never fabricate an ID. Two or more matches → ask before writing.

## Examples
```text
example: cycle name "2026-10-12 to 2026-10-23", status "upcoming", then "active" on the start day
example: sync line "in-progress 6 · stale 2 (<id>, <id>) · blocked 1 · overdue 3 · next <issueId> (critical-path-actionable)"
example: milestone name "Checkout accepts card payments" (outcome), not "Sprint 4"
```
