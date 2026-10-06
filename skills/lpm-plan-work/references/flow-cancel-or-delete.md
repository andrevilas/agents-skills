# Playbook: cancel-or-delete
Use when: cancel or delete an activity
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user | STOP. Say: "Which activity? (id or title)" |
| change | "cancel", or "delete" only when the user said delete ("apagar", "excluir", "delete") | "cancel" |
| named | "yes" when the user named this activity by id or exact title, "no" when you picked it | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was canceled or deleted."
1. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: title, status, requirementId, baselineId = those fields of result (empty if absent); factory = "yes" if result.factoryGovernance is set, else "no"
   IF <saved:status> == "done" → STOP. This belongs to skill {{skill:lpm-deliver-activity}}. Say: "<input:issueId> is done; undoing a closure is not planning."
   IF <saved:status> == "canceled" and <input:change> == "cancel" → STOP. Say: "<input:issueId> is already canceled."
2. IF <saved:requirementId> is empty → go to step 3.
   ASK: "<saved:title> delivers requirement <saved:requirementId>. Does that requirement stay in scope without it? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Removing it changes scope: that is a governance decision (skill lpm-governance-decisions). Nothing was changed."
3. IF <input:change> == "cancel" and <input:named> == "no" → ASK: "Cancel <saved:title> (<input:issueId>)? (yes/no)" — continue only if the user says yes; otherwise STOP.
   IF <input:change> == "cancel" → go to step 6.
4. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: commits = the items whose content starts with "Vinculação automática de" or contains "/commit/" (commits linked by LPM-Activity)
   SAVE: reasons = "AISH factory activity" if <saved:factory> == "yes"; "linked commits" if <saved:commits> is not empty; "bound to requirement <saved:requirementId>" or "bound to baseline <saved:baselineId>" when set (empty if none)
   IF <saved:reasons> is empty → go to step 7.
5. ASK: "<saved:title> has <saved:reasons>. Deleting it would break that history, so I will not delete it. Cancel it instead? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was deleted."
6. CALL {{tool:update_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","status":"canceled"} [A]
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or result.status != "canceled" → STOP. Say: "<input:issueId> is <result.status>, not canceled."
   SAVE: status = result.status; outcome = "canceled (history kept)"; go to Answer.
7. ASK: "Delete <saved:title> (<input:issueId>)? There is no undo: its comments and links are destroyed. Cancel keeps the history. (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was deleted."
8. CALL {{tool:delete_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [C]
   IF the call returns an error → STOP. Say: "Not deleted: <error text>. Do not retry; deleting needs an LPM API key with profile full or custom."
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or the issue, unless that error is "Issue not found" → STOP. Say: "<input:issueId> still reads back (<error text or its status>); the delete is not confirmed."
   SAVE: status = "deleted"; outcome = "deleted"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: project <input:projectId>, activity <input:issueId> <saved:title>
Done: <<saved:outcome> | nothing changed>; status <saved:status>
Evidence: <get_issue re-read: status canceled | get_issue re-read: "Issue not found" | none>
Pending: <none | <saved:reasons> kept it from being deleted>
Next: <the ASK or STOP text that ended the run | none>
```
status: backlog | todo | in-progress | done | canceled, from your last get_issue, or "deleted" when that get_issue said "Issue not found". Never claim a cancel or delete that its VERIFY did not show.
