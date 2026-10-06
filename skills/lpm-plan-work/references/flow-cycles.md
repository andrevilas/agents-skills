# Flow: cycles and milestones
Load when: decision row 2 of SKILL.md (open, start, close, replace or delete a cycle/sprint or milestone; move a milestone date; move activities between cycles or milestones)

## Preconditions
1. {{tool:create_cycle}}, {{tool:update_cycle}}, {{tool:create_milestone}}, {{tool:update_milestone}} need an LPM API key (planning profile); {{tool:delete_cycle}} and {{tool:delete_milestone}} need full/custom. Connector → core rule 2.
2. Opening a cycle or milestone needs user-given dates (`YYYY-MM-DD`): `startDate` and `endDate` for a cycle, `targetDate` for a milestone. Never invent one. Starting or closing needs no date.
3. Creates are not idempotent: re-list before any retry. Cycle states: `upcoming` → `active` → `completed`; milestone states: `open` → `closed` ({{ref:planning-rules}}).
4. Closing a cycle or milestone does NOT move or close its activities. Never delete a cycle or milestone to close it.
5. Closing a cycle (sprint) or milestone is this flow, never a handoff to {{skill:lpm-deliver-activity}} (that skill closes one activity).

## Steps
1. Open a cycle: {{tool:list_cycles}}(projectId) → a cycle already covers the window → ask "Use <name>?". Check `endDate` > `startDate` yourself.
2. {{tool:create_cycle}}(projectId, name, startDate, endDate, status="upcoming") [A]; name = the user-given name, else "<startDate> to <endDate>" → keep `cycleId`.
3. Milestone: {{tool:list_milestones}}(projectId) → same outcome exists → ask; else {{tool:create_milestone}}(projectId, name=<outcome>, targetDate) [A] → keep `milestoneId`.
4. Start on request ({{ref:planning-rules}} Rule 2): {{tool:list_issues}}(projectId, cycleId, limitCount=100), loop `nextCursor` → cycle ids; {{tool:get_project_dependency_summary}}(projectId) → a `criticalBlockers[]` entry whose `issueId` is a cycle id and whose `blockers[].issueId` is not → report it and ask "Start <cycle> anyway? (yes/no)". Then {{tool:update_cycle}}(projectId, cycleId, status="active") [A].
5. Add or move activities: SKILL.md P1 step 5 with {{tool:update_issue}}(projectId, issueId, cycleId or milestoneId) items [A].
6. Close a cycle: {{tool:list_issues}}(projectId, cycleId, limitCount=100), loop `nextCursor` while `hasMore` → items not `done`/`canceled` → ask "Move <N> open activities to <next cycle> or leave them?" and wait.
7. "move" → steps 1–2 when no next cycle exists; then SKILL.md P1 step 5 with {{tool:update_issue}}(projectId, issueId, cycleId=<next>) items [A].
8. {{tool:update_cycle}}(projectId, cycleId, status="completed") [A]. An `active` cycle past its `endDate` is closed or replaced the same way (steps 6–8).
9. Close a milestone: {{tool:list_issues}}(projectId, milestoneId, limitCount=100), loop `nextCursor` while `hasMore` → report open items → {{tool:update_milestone}}(projectId, milestoneId, status="closed") [A].
10. Move a milestone date (a commitment, [C] per SKILL.md §2 rule 2): {{tool:get_milestone}}(projectId, milestoneId) → ask "Move <name> from <old targetDate> to <new targetDate>? (yes/no)"; on "yes" {{tool:update_milestone}}(projectId, milestoneId, targetDate).
11. Delete one made by mistake, only on explicit request: {{tool:list_issues}}(projectId, cycleId or milestoneId, limitCount=100), loop `nextCursor` while `hasMore` → record the ids → SKILL.md §6 delete question → {{tool:delete_cycle}}(projectId, cycleId) [C] / {{tool:delete_milestone}}(projectId, milestoneId) [C].
12. Verify: {{tool:get_cycle}} / {{tool:get_milestone}} → name, dates and status equal the request; {{tool:list_issues}}(projectId, cycleId, limitCount=100), loop `nextCursor` while `hasMore` → planned or moved ids present; deleted → id absent from {{tool:list_cycles}} / {{tool:list_milestones}}.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| opening a cycle or milestone without user-given dates | "Which start and end dates (YYYY-MM-DD)?" |
| open activities and no answer on where to move them | "Move <N> open activities to <next cycle> or leave them?" and wait |
| more than one `active` cycle | "Cycles <a> and <b> are both active. Which one is current?" |
| an activity of the cycle has an open blocker outside it | "Start <cycle> anyway? (yes/no)" and wait |
| the user wants a cycle or milestone closed, not deleted | steps 6–9, never step 11 |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create / update | {{tool:get_cycle}}(projectId, cycleId) / {{tool:get_milestone}}(projectId, milestoneId) | name, dates and status equal the request |
| moves | {{tool:list_issues}}(projectId, cycleId, limitCount=100), loop `nextCursor` while `hasMore` | every moved id is present |
| delete | {{tool:list_cycles}}(projectId) / {{tool:list_milestones}}(projectId) | the deleted id is absent |
| a cycle or milestone missing from read models | {{tool:get_cycle}} / {{tool:get_milestone}} | it was saved without `startDate` / `targetDate`: set it with {{tool:update_cycle}} [A] / {{tool:update_milestone}} after the step 10 question |

## Report fields
Scope (project, cycle or milestone), created or changed ids with name, dates and status, moved activity ids, open items left, Pending, Next.
