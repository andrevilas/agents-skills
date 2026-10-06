# Playbook: entry-to-activity
Use when: turn an entry into an activity, or link one
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| entryId | the user, or an id the user picked from the project's triage queue | STOP. Say: "Which operational entry? (id, or pick one from the queue)" |
| issueId | "new" to create an activity, or the existing activity id (same project) the user named | STOP. Say: "Create a new activity, or link an existing one? (id)" |
| reason | the user's words on why it becomes work | STOP. Say: "What is the reason? It is saved as the decision rationale." |
| now | the current UTC time, ISO 8601 (LPM replaces it with the server time) | today's date + "T00:00:00Z" |
| confirmed | "yes" when the user's message already says yes to this conversion or link | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. No activity was created or linked."
1. CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   SAVE: title = result.title; state = result.curationState; decisionType = result.decision.decisionType (empty if no decision)
   IF result.relatedTaskId is not empty → STOP. Say: "<input:entryId> is already linked to activity <result.relatedTaskId>. Nothing was changed."
   IF result.duplicateOfEntryId is not empty → STOP. Say: "<input:entryId> was merged into <result.duplicateOfEntryId>: use that entry."
   IF <saved:state> is neither "approved" nor "classified" → STOP. Say: "<input:entryId> is <saved:state>; it must be classified or approved first (playbooks classify-entry, decide-entry)."
   IF <input:issueId> != "new" → go to step 4.
   IF <saved:decisionType> == "link_existing_task" → STOP. Say: "<input:entryId> is set to link an existing activity: which activity id?"
2. ASK: "Create activity '<saved:title>' in <input:projectId> from entry <input:entryId> with convert_operational_entry_to_issue, rationale "<input:reason>"? A classified entry is approved by this call. Owner, cycle and dates stay unset. (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 3.
3. CALL {{tool:convert_operational_entry_to_issue}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","rationale":"<input:reason>"} [C]
   Call it once. After a timeout, run this playbook again: step 1 shows relatedTaskId if it worked.
   IF the call returns an error → STOP. Say: "Not converted: <error text>. Converting needs a project manager, project owner, product owner or delivery lead."
   SAVE: activityId = result.issueId
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.relatedTaskId != <saved:activityId> or result.curationState != "approved" → STOP. Say: "<input:entryId> does not show activity <saved:activityId> and approved."
   SAVE: state = result.curationState; status = result.status; go to Answer.
4. IF <saved:state> == "approved" → go to step 7.
5. ASK: "Approve <input:entryId> '<saved:title>' and link it to activity <input:issueId> (decision link_existing_task), rationale "<input:reason>"? (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 6.
6. CALL {{tool:update_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","curationState":"approved","relatedTaskId":"<input:issueId>","decision":{"decisionType":"link_existing_task","decidedBy":"caller","decidedAt":"<input:now>","rationale":"<input:reason>","targetTaskId":"<input:issueId>"}} [C] (LPM replaces decidedBy and decidedAt)
   IF the call returns an error → STOP. Say: "Not linked: <error text>. The activity must exist in <input:projectId>; approving needs a project manager, project owner, product owner or delivery lead."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.relatedTaskId != <input:issueId> or result.curationState != "approved" → STOP. Say: "<input:entryId> does not show activity <input:issueId> and approved."
   SAVE: activityId = <input:issueId>; state = result.curationState; status = result.status; go to Answer.
7. ASK: "Link approved entry <input:entryId> '<saved:title>' to activity <input:issueId>? (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 8.
8. CALL {{tool:update_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>","relatedTaskId":"<input:issueId>"} [C]
   IF the call returns an error → STOP. Say: "Not linked: <error text>. The activity must exist in <input:projectId>."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:entryId>"} [A]
   IF the call returns an error or result.relatedTaskId != <input:issueId> → STOP. Say: "<input:entryId> does not show activity <input:issueId>."
   SAVE: activityId = <input:issueId>; state = result.curationState; status = result.status

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:entryId> '<saved:title>'
Done: <activity <saved:activityId> created from the entry | entry linked to activity <saved:activityId> | nothing changed>; curationState <saved:state>, entry status <saved:status>
Evidence: <get_operational_entry relatedTaskId <saved:activityId> | none>
Pending: <owner, cycle and dates of activity <saved:activityId> are not set | none>
Next: <the ASK or STOP text that ended the run | plan activity <saved:activityId> (owner, cycle, dates) with skill lpm-plan-work>
```
curationState: new | under_review | classified | approved | rejected | deferred | consolidated; entry status: open | in_progress | resolved | archived (it stays open after conversion). Never claim a check that a step above did not run and pass.
