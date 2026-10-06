# Flow: owners, estimates and due dates
Load when: decision row 3 of SKILL.md (owners, estimates, due dates on 1 or more activities; unassigned / unestimated / overdue queues)

## Preconditions
1. API key (planning profile): every tool below. Connector (OAuth): estimates and due dates only, through the connector path; owners need an API key ({{tool:list_project_assignable_members}} is not on connectors) → core rule 2.
2. Every owner, estimate or due-date write is [C] whatever the tool (SKILL.md §2 rule 2): the step 3 plan table comes before any write.
3. {{tool:list_overdue_project_issues}} needs a project governance role; denied ("owner surface") → use the step 1 fallback.
4. Assignees come only from {{tool:list_project_assignable_members}}, never from workspace or team member lists. An assignee is operational responsibility, not governance authority.
5. Use only the canonical names {{tool:set_project_issue_due_date}} and {{tool:bulk_set_project_issue_due_dates}} (the `update_*` names are aliases). Dates are `YYYY-MM-DD`; estimates are hours.

## Steps
1. Queue: {{tool:list_unassigned_project_issues}} / {{tool:list_unestimated_project_issues}} / {{tool:list_overdue_project_issues}}(projectId, limitCount=100) → keep `items[].id`, `count` (overdue: loop `nextCursor`). Overdue denied → {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` → open items with `dueDate` < today.
2. {{tool:list_project_assignable_members}}(projectId) → one `uid` per person named by the user (match on `displayName` or `email`). 0 or 2+ matches → STOP and ask exactly "Which person: <displayName> (<email>) or <displayName> (<email>)?" (no displayName → email only). Show only displayName and email: never `hourlyRate`, `currency` or `directoryOrigins`; never pick one yourself.
3. [C] Show the plan table (issue → owner / estimate / due date, old → new); continue only on "yes". Never invent an owner, estimate or date. This "yes" covers steps 4–5.
4. One item: {{tool:assign_project_issue_owner}}(projectId, issueId, assigneeId) [C]; {{tool:set_project_issue_estimate}}(projectId, issueId, estimate); {{tool:set_project_issue_due_date}}(projectId, issueId, dueDate) [C].
5. Many items, values from step 3, one call per kind, exactly these shapes [C] ({{ref:batch-and-bulk}}):
   - `bulk_assign_project_issue_owners {projectId:"<projectId>", updates:[{issueId:"<id>", assigneeId:"<uid>"}, ...]}` (uid from step 2)
   - `bulk_set_project_issue_estimates {projectId:"<projectId>", updates:[{issueId:"<id>", estimate:8}, ...]}` (hours, a number)
   - `bulk_set_project_issue_due_dates {projectId:"<projectId>", updates:[{issueId:"<id>", dueDate:"2026-10-31"}, ...]}`
   These bulk tools take NO `idempotencyKey` (naturally idempotent); never invent one.
6. Read `failedCount` of every call. > 0 → {{tool:get_issue}}(projectId, issueId) for each failed id before any further call. "Issue not found" → drop that id from the later kinds (due date, estimate), do not retry it, list it under Pending with its error. Other errors → fix per `results[].error` and resend only the failed items; still failing → Pending with the error.
7. Verify: rerun the step 1 queue → the fixed ids are gone; or {{tool:get_issue}}(projectId, issueId) → the new values.

## Connector path (OAuth: estimates and due dates)
1. Queue: {{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore` → items not `done`/`canceled` with no `estimate` (unestimated; 0 counts as estimated) or `dueDate` < today (overdue). `list_issues` has no due-date filter: compare yourself.
2. [C] Show the plan table (issue → estimate / due date, old → new); continue only on "yes".
3. One item: {{tool:update_issue}}(projectId, issueId, estimate and/or dueDate). 2+: {{tool:batch_issue_operations}}(operations of {{tool:update_issue}} items, idempotencyKey="plan-<projectId>-<yyyymmdd>-<n>"), ≤ 25 per call.
4. Never send `null` (ignored under OAuth) and never send `assigneeId` (no eligible-member list on connectors): owners → "Assigning owners needs an LPM API key." and core rule 2.
5. Verify: {{tool:get_issue}}(projectId, issueId) → the new values.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| a person matches 0 or 2+ assignable members | "Which person: <displayName> (<email>) or <displayName> (<email>)?"; show only displayName and email (never `hourlyRate`, `currency`, `directoryOrigins`); never pick one yourself |
| "Assignee is not eligible for this project" | re-read {{tool:list_project_assignable_members}}; never a workspace or team member id |
| the plan table is not approved | do nothing; ask "Apply this plan? (yes/no)" |
| owners asked on a connector | "Assigning owners needs an LPM API key." → core rule 2 |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| owner / estimate / due date | the step 1 queue or {{tool:get_issue}}(projectId, issueId) | `failedCount == 0`; the ids carry the new values |
| connector batch | {{tool:get_issue}}(projectId, issueId) per item | `failed` and `skipped` are 0; the ids carry the new values |

## Report fields
Scope (project), changed ids with owner / estimate / due date, failed items with their error, queue counts before and after, Pending, Next.
