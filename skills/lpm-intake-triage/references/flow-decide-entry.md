# Playbook: decide-entry
Use when: approve, reject or defer an entry
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| entryId | the user, or an id the user picked from the project's triage queue | STOP. Say: "Which operational entry? (id, or pick one from the queue)" |
| decision | "approve", "reject" or "defer", from the user's words (or input then of playbook classify-entry) | STOP. Say: "Approve, reject or defer this entry? Reason? (defer: re-evaluation date)" |
| reason | the user's reason, in their words | STOP. Say: "What is the reason? It is saved as the decision rationale." |
| revaluationDate | yyyy-mm-dd, only for "defer" | "none" |
| now | the current UTC time, ISO 8601 (LPM replaces it with the server time) | today's date + "T00:00:00Z" |
| confirmed | "yes" when the user's message already says yes to this decision (same decision and reason) | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was decided."
1. CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   SAVE: title = result.title; state = result.curationState; status = result.status
   IF result.duplicateOfEntryId is not empty → STOP. Say: "<input:entryId> was merged into <result.duplicateOfEntryId>: decide on that entry."
   IF <saved:state> is "consolidated" or "rejected" → STOP. Say: "<input:entryId> is <saved:state>, a final state. Nothing was changed."
   IF <input:decision> == "approve" and <saved:state> == "approved" → STOP. Say: "<input:entryId> is already approved."
   IF <input:decision> == "approve" and <saved:state> != "classified" → switch to playbook classify-entry.
   IF <input:decision> == "defer" and <saved:state> == "new" → switch to playbook classify-entry.
   IF <input:decision> == "defer" and <input:revaluationDate> == "none" → STOP. Say: "Defer until when? (re-evaluation date, yyyy-mm-dd)"
2. IF <input:decision> == "reject" → go to step 7.
   IF <input:decision> == "defer" → go to step 5.
   IF <input:decision> != "approve" → STOP. Say: "Approve, reject or defer this entry? Reason?"
3. ASK: "Approve <input:entryId> '<saved:title>' (decision create_task), reason "<input:reason>"? Then it can become an activity. (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 4.
4. CALL {{tool:update_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","curationState":"approved","decision":{"decisionType":"create_task","decidedBy":"caller","decidedAt":"<input:now>","rationale":"<input:reason>"}} [C] (LPM replaces decidedBy and decidedAt with the caller and the server time)
   IF the call returns an error → STOP. Say: "Not approved: <error text>. Approve, reject and defer need a project manager, project owner, product owner or delivery lead."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.curationState != "approved" or result.decision.decisionType != "create_task" → STOP. Say: "<input:entryId> reads <result.curationState>, not approved."
   SAVE: state = result.curationState; status = result.status; priority = result.priority; decided = "create_task"; go to Answer.
5. ASK: "Defer <input:entryId> '<saved:title>' until <input:revaluationDate> (decision defer), reason "<input:reason>"? It stays open. (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 6.
6. CALL {{tool:update_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","curationState":"deferred","decision":{"decisionType":"defer","decidedBy":"caller","decidedAt":"<input:now>","rationale":"<input:reason>","revaluationDate":"<input:revaluationDate>"}} [C] (LPM replaces decidedBy and decidedAt)
   IF the call returns an error → STOP. Say: "Not deferred: <error text>. Approve, reject and defer need a project manager, project owner, product owner or delivery lead."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.curationState != "deferred" → STOP. Say: "<input:entryId> reads <result.curationState>, not deferred."
   SAVE: state = result.curationState; status = result.status; priority = result.priority; decided = "defer until <input:revaluationDate>"; go to Answer.
7. ASK: "Reject <input:entryId> '<saved:title>' (decision reject), reason "<input:reason>"? It is archived for good: rejected is final over MCP. (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 8.
8. CALL {{tool:update_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","curationState":"rejected","status":"archived","decision":{"decisionType":"reject","decidedBy":"caller","decidedAt":"<input:now>","rationale":"<input:reason>"}} [C] (a rejected entry must be archived; LPM replaces decidedBy and decidedAt)
   IF the call returns an error → STOP. Say: "Not rejected: <error text>. Approve, reject and defer need a project manager, project owner, product owner or delivery lead."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.curationState != "rejected" or result.status != "archived" → STOP. Say: "<input:entryId> reads <result.curationState>/<result.status>, not rejected/archived."
   SAVE: state = result.curationState; status = result.status; priority = result.priority; decided = "reject"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:entryId> '<saved:title>'
Done: <decision <saved:decided>, rationale "<input:reason>"; curationState <saved:state>, status <saved:status>, priority <saved:priority> | nothing changed>
Evidence: <get_operational_entry read back <saved:state>/<saved:status> | none>
Pending: <none | re-evaluation on <input:revaluationDate>>
Next: <the ASK or STOP text that ended the run | turn <input:entryId> into an activity (playbook entry-to-activity) | none>
```
curationState: new | under_review | classified | approved | rejected | deferred | consolidated; status: open | in_progress | resolved | archived (underscore). Never claim a check that a step above did not run and pass.
