# Playbook: propose-link
Use when: change request: allocate or link one item
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| item | the id or title of the ONE existing source item | STOP. Say: "Which roadmap item?" |
| changeType | "allocate", "link" or "capability-link" | STOP. Say: "Allocate to a project, link to an item, or link to a capability?" |
| target | allocate: the project id; link: the other item's id or title; capability-link: the capability id or name | STOP. Say: "Which project, item or capability?" |
| kind | allocate: "primary", "contributor", "dependent" or "observer"; link: "blocks", "depends_on", "relates_to", "shared_capability" or "enables_future_use"; capability-link: "defines", "delivers", "enables", "extends" or "validates" | allocate "primary"; link "depends_on"; capability-link "delivers" |
| rationale | why, in the user's words | STOP. Say: "Why is this change needed?" |
| stamp | the current UTC time as yyyymmddHHMMss | the current UTC time |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was submitted."
1. CALL {{tool:get_workspace}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: mode = result.roadmapGovernanceMode when it is "off", "shadow" or "enforce", else "off" when result.roadmapGovernanceEnabled == false, else "shadow"
   IF <input:changeType> is neither "allocate", "link" nor "capability-link" → switch to playbook propose-change.
   IF <saved:mode> == "off" → STOP. This belongs to skill {{skill:lpm-roadmap-owner-ops}}. Say: "Governance is off: no change requests. A direct allocation or link needs the owner's order."
2. CALL {{tool:get_workspace_roadmap_overview}} {"workspaceId":"<input:workspaceId>","includeArchived":true,"compact":true} [A]
   SAVE: itemId, title, isArchived, roadmapId = those fields of the only items[] item whose id == <input:item> or whose title equals <input:item> ignoring case and accents; itemUpdatedAt = its updatedAt, copied exactly
   IF no item or 2+ items match → STOP. Say: "Which item exactly? <each id with its title>"
   IF <saved:isArchived> == true → STOP. Say: "<saved:title> is archived: restore it first (playbook propose-change)."
   SAVE: primaryId = id of the allocations[] item with itemId == <saved:itemId>, role "primary" and status "active" or empty, else "none"; openStatuses = ["awaiting-review", "changes-requested", "approved"]
3. FOR EACH openStatus IN <saved:openStatuses> (none → go to step 4):
   CALL {{tool:list_workspace_roadmap_change_requests}} {"workspaceId":"<input:workspaceId>","status":"<each:openStatus>","compact":true,"limit":100} [A]
   IF a result.requests item has itemId == <saved:itemId> or itemIds containing it → STOP. Say: "Request <that id> (<each:openStatus>) is already open on <saved:title>: comment on it, revise it or withdraw it."
4. SAVE: targetKey, targetId, kindKey, replacesId = by <input:changeType>, from the step 2 read:
     allocate → "projectId", <input:target>, "role", and <saved:primaryId> when <input:kind> == "primary" and <saved:primaryId> != "none", else ""
     link → "targetItemId", id of the only OTHER items[] item whose id or title matches <input:target>, "type", ""
     capability-link → "capabilityId", id of the only capabilities[] item with status "active" whose id or name matches <input:target> (ignoring case and accents), "relationship", ""
   IF <saved:targetId> is empty, or <input:kind> is not in its "You need" list → STOP. Say: "No valid target or kind for <input:changeType>: <input:target> / <input:kind>. Nothing was submitted."
   IF <input:changeType> == "capability-link" and a capabilityLinks[] item of step 2 has itemId == <saved:itemId>, capabilityId == <saved:targetId> and status not "archived" → STOP. Say: "<saved:title> is already linked to that capability."
   SAVE: key = "cr-<saved:itemId>-<input:changeType>-<input:stamp>"
5. CALL {{tool:preview_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","itemId":"<saved:itemId>","changeType":"<input:changeType>","patch":{"<saved:targetKey>":"<saved:targetId>","<saved:kindKey>":"<input:kind>","replacesAllocationId":"<saved:replacesId>","rationale":"<input:rationale>"},"expectedUpdatedAt":"<saved:itemUpdatedAt>"} [A]
   Write the patch keys as the saved names (e.g. {"projectId":"prj_1","role":"primary","replacesAllocationId":"","rationale":"…"}).
   SAVE: riskClass = result.riskClass; reviewMode = result.policy.reviewMode
6. ASK: "Submit a change request: <input:changeType> <saved:title> (<saved:itemId>) → <saved:targetId> (<input:kind>)<, replacing allocation <saved:replacesId> when not empty>; risk <saved:riskClass>, review <saved:reviewMode>; rationale "<input:rationale>". (yes/no)" — continue only if the user says yes; otherwise STOP.
7. CALL {{tool:submit_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","itemId":"<saved:itemId>","changeType":"<input:changeType>","patch":{"<saved:targetKey>":"<saved:targetId>","<saved:kindKey>":"<input:kind>","replacesAllocationId":"<saved:replacesId>","rationale":"<input:rationale>"},"expectedUpdatedAt":"<saved:itemUpdatedAt>","rationale":"<input:rationale>","idempotencyKey":"<saved:key>"} [C]
   IF result.idempotentReplay == true → STOP. Say: "Key <saved:key> was used before (old request <result.id>): run again with a new stamp."
   SAVE: changeRequestId = result.id; assignedReviewerId = result.assignedReviewerId
   VERIFY: CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<saved:changeRequestId>"} [A]
   IF the call returns an error or result.status != "awaiting-review" or result.changeType != <input:changeType> → STOP. Say: "<saved:changeRequestId> is not awaiting review as a <input:changeType>."
   SAVE: status, requiredApprovals, ownerConfirmationRequired = those fields of result
   Stop here: never review or apply your own request.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<saved:roadmapId>/<saved:itemId> <saved:title>; mode <saved:mode>
Done: submitted <saved:changeRequestId> (<input:changeType> → <saved:targetId>, risk <saved:riskClass>), status <saved:status> | reads only, nothing submitted
Evidence: get_workspace_roadmap_change_request → status <saved:status> | none
Pending: none | <saved:requiredApprovals> approval(s) by members other than the author, owner confirmation <saved:ownerConfirmationRequired>, reviewer <saved:assignedReviewerId>
Next: <the ASK or STOP text that ended the run> | the reviewer decides in LPM; then the owner orders the apply (playbook apply)
```
mode: off | shadow | enforce, from step 1. status: awaiting-review. risk: material (every allocate or link). Never claim a submit that the VERIFY did not show.
