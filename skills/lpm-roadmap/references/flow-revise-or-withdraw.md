# Playbook: revise-or-withdraw
Use when: revise or withdraw a change request
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| changeRequestId | the user, or the request list | STOP. Say: "Which change request? (id)" |
| change | "revise" or "withdraw", from the user's words | STOP. Say: "Revise the request, or withdraw it?" |
| value | revise: the new value for the same change (a field value; or a target id and/or kind for allocate, link, capability-link) | "none" |
| responseToChanges | revise: what changed in answer to the review, in the user's words | "none" |
| reason | withdraw: why, in the user's words | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was revised or withdrawn."
1. CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   SAVE: status, updatedAt, currentRevision, changeType, patch, itemIds, authorUserId = those fields of result; nextRevision = <saved:currentRevision> + 1
   IF <saved:status> is "applied" or "withdrawn" → STOP. Say: "<input:changeRequestId> is already <saved:status>. Undo an applied change with a new, opposite request."
   IF <input:change> == "withdraw" and <input:reason> == "none" → STOP. Say: "Why withdraw <input:changeRequestId>? (one sentence)"
   IF <input:change> == "withdraw" → go to step 7.
   IF <saved:status> != "changes-requested" → STOP. Say: "<input:changeRequestId> is <saved:status>: only a changes-requested request can be revised. Comment on it, or withdraw it and submit a new one."
   IF <input:value> == "none" or <input:responseToChanges> == "none" → STOP. Say: "What is the new value, and what changed in answer to the review?"
2. SAVE: field = the key of <saved:patch> that is not "rationale" (scalar change); newValue = <input:value>; targetKey, kindKey = the target key ("projectId", "targetItemId" or "capabilityId") and kind key ("role", "type" or "relationship") of <saved:patch>; targetId, kind = the new target and kind from <input:value>, else the old ones in <saved:patch>; replacesId = <saved:patch>.replacesAllocationId, else ""; revKey = "crrev-<input:changeRequestId>-<saved:nextRevision>"
   IF <saved:changeType> is "allocate", "link" or "capability-link" → go to step 5.
3. ASK: "Revise <input:changeRequestId> to revision <saved:nextRevision>: <saved:field> → "<saved:newValue>"; response "<input:responseToChanges>". Earlier approvals become void. (yes/no)" — continue only if the user says yes; otherwise STOP.
4. CALL {{tool:revise_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>","patch":{"<saved:field>":"<saved:newValue>","rationale":"<input:responseToChanges>"},"expectedUpdatedAt":"<saved:updatedAt>","responseToChanges":"<input:responseToChanges>","idempotencyKey":"<saved:revKey>"} [C]
   IF the call returns an error → STOP. Say: "Not revised: <error text>. "Only the author can revise this change": only <saved:authorUserId> can; comment instead."
   VERIFY: CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   IF the call returns an error or result.status != "awaiting-review" or result.currentRevision != <saved:nextRevision> → STOP. Say: "<input:changeRequestId> does not show revision <saved:nextRevision> awaiting review."
   SAVE: status = result.status; outcome = "revised to revision <saved:nextRevision>"; go to Answer.
5. ASK: "Revise <input:changeRequestId> to revision <saved:nextRevision>: <saved:changeType> → <saved:targetId> (<saved:kind>); response "<input:responseToChanges>". Earlier approvals become void. (yes/no)" — continue only if the user says yes; otherwise STOP.
6. CALL {{tool:revise_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>","patch":{"<saved:targetKey>":"<saved:targetId>","<saved:kindKey>":"<saved:kind>","replacesAllocationId":"<saved:replacesId>","rationale":"<input:responseToChanges>"},"expectedUpdatedAt":"<saved:updatedAt>","responseToChanges":"<input:responseToChanges>","idempotencyKey":"<saved:revKey>"} [C]
   IF the call returns an error → STOP. Say: "Not revised: <error text>. "Only the author can revise this change": only <saved:authorUserId> can; comment instead."
   VERIFY: CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   IF the call returns an error or result.status != "awaiting-review" or result.currentRevision != <saved:nextRevision> → STOP. Say: "<input:changeRequestId> does not show revision <saved:nextRevision> awaiting review."
   SAVE: status = result.status; outcome = "revised to revision <saved:nextRevision>"; go to Answer.
7. ASK: "Withdraw <input:changeRequestId> (<saved:status>, <saved:changeType> on <saved:itemIds>)? Reason: "<input:reason>". A withdrawn request can never be reopened. (yes/no)" — continue only if the user says yes; otherwise STOP.
8. CALL {{tool:withdraw_workspace_roadmap_change}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>","expectedUpdatedAt":"<saved:updatedAt>","reason":"<input:reason>","idempotencyKey":"crwd-<input:changeRequestId>"} [C]
   IF the call returns an error → STOP. Say: "Not withdrawn: <error text>. Only the author or the workspace owner or an admin can withdraw it."
   VERIFY: CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<input:workspaceId>","changeRequestId":"<input:changeRequestId>"} [A]
   IF the call returns an error or result.status != "withdrawn" → STOP. Say: "<input:changeRequestId> is <result.status>, not withdrawn."
   SAVE: status = result.status; outcome = "withdrawn"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<input:changeRequestId> (<saved:changeType>)
Done: <saved:outcome>, status <saved:status> | reads only, nothing changed (status <saved:status>)
Evidence: get_workspace_roadmap_change_request → status <saved:status> | none
Pending: none | a member other than the author reviews revision <saved:nextRevision>
Next: <the ASK or STOP text that ended the run> | the reviewer decides in LPM | submit a new request (playbook propose-change or propose-link)
```
status: awaiting-review | changes-requested | approved | rejected | stale | applied | withdrawn, from step 1 or the VERIFY. Never claim a revise or withdraw that the VERIFY did not show.
