# Playbook: scope-status
Use when: status, drift or traceability (read-only)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| question | "traceability" if the user asks which requirements have no delivery or which links are stale, else "status" | "status" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Scope check incomplete: <tool> failed: <error text>."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "On a ChatGPT/Claude connector only the project execution context is readable; scope details need an LPM API key."
2. CALL {{tool:get_project_scope_resolution_context}} {"projectId":"<input:projectId>"} [A]
   SAVE: baselineId, baselineVersion = id and version of result.currentBaseline (both "none" if null); added = result.workingScope.addedCount; changed = result.workingScope.changedCount; affected = result.workingScope.affectedCount; orphans = result.requirementsAwaitingBaseline.count; blocked = result.publicationGate.shouldBlockPublication; matchedId = result.publicationGate.matchedApprovedChangeSetId; materiality = result.publicationGate.materiality; reasons = result.publicationGate.reasonCodes
   IF <input:question> == "traceability" and <saved:baselineId> != "none" → go to step 5.
   IF <saved:affected> == 0 → SAVE: delta = "none"; go to Answer.
3. CALL {{tool:list_working_scope_delta_entities}} {"projectId":"<input:projectId>","changeType":"added","limitCount":100} [A]
   SAVE: delta = "<requirementId> <title> (added, <changedAt>)" for each item; more = "yes" if result.nextCursor is not empty
4. CALL {{tool:list_working_scope_delta_entities}} {"projectId":"<input:projectId>","changeType":"changed","limitCount":100} [A]
   SAVE: delta = <saved:delta> plus "<requirementId> <title> (changed, <changedAt>)" for each item; more = "yes" if result.nextCursor is not empty; go to Answer.
5. CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>"} [A]
   SAVE: reqs = id, title, status, issueId, linkedIssueIds, linkedCycleIds, linkedMilestoneIds of each item; noDelivery = "<id> <title>" of each item with empty issueId, linkedIssueIds, linkedCycleIds and linkedMilestoneIds
6. CALL {{tool:list_issues}} {"projectId":"<input:projectId>"} [A] (no limitCount: it returns every issue)
   SAVE: stale = "<requirement id> → <issue id> (<issue status or missing>)" for each linkedIssueIds id of <saved:reqs> whose issue is missing, or is "done" or "canceled" while the requirement status is "pending"
   SAVE: delta = "not read (traceability question)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>; baseline <saved:baselineVersion> (<saved:baselineId>)
Done: read-only check, nothing changed; added <saved:added>, changed <saved:changed>, orphans <saved:orphans>
Evidence: <publication not blocked (materiality <saved:materiality>) | publication blocked: <saved:reasons>, matched change set <saved:matchedId>>; delta: <saved:delta> | traceability: no delivery: <saved:noDelivery>; stale links: <saved:stale>
Pending: removals are never shown by the delta (removedCount is always 0) | <more than 100 items in a delta list> | none
Next: <the ASK or STOP text that ended the run> | create a change set for owner review (playbook change-set) | attach orphans (playbook groups-and-orphans) | the owner orders publication (playbook publish-baseline) | none
```
materiality: none | low | medium | high. Reason codes: cost-threshold (forecast cost ≥ 1000), schedule-threshold (cycles + milestones ≥ 2), scope-threshold (≥ 4 requirements), delivery-threshold (≥ 3 linked issues), activity-threshold (≥ 3 activities), scope-without-delivery (a requirement with no linked issue, cycle or milestone). Medium or high needs a change set approved by the owner before publication; low or none needs none. Never claim "no removals" and never claim a check that a step above did not run.
