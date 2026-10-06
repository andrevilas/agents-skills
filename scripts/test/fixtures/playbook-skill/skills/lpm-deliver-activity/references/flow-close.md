# Playbook: close
Use when: close the activity, or answer "can I close it?"
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity` | STOP. Say: "Which LPM activity? (id or title)" |
| testResults | "<test> → <result>" lines the user wrote | "none" |
| order | "close" if the user said to close it, else "question" | "question" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Closure check incomplete: <tool> failed: <error text>."
1. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: title, status, description = those fields of result; related = the issue ids after "Depends on:" in <saved:description>
   IF <saved:status> is "done" or "canceled" → STOP. Say: "<input:issueId> is already <saved:status>."
2. FOR EACH related IN <saved:related> (none → go to step 3):
   CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<each:issueId>"} [A]
   IF result.status is neither "done" nor "canceled" → STOP. Say: "<input:issueId> waits for <each:issueId> (<result.status>)."
3. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   Always make this call.
   SAVE: m = the number of items + 1; closeKey = "close-<input:issueId>-<saved:m>"
4. SAVE: missing = the first line of <saved:description> with no "<test> → <result>" proof in <input:testResults> (empty if none)
   IF <saved:missing> is not empty → STOP. Say: "Which evidence proves <saved:missing>?"
5. IF <input:order> == "question" → ASK: "All criteria have proof. Close <input:issueId> now? (yes/no)" — continue only if the user says yes; otherwise STOP.
6. CALL {{tool:create_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","content":"Closure check: <input:testResults>","idempotencyKey":"<saved:closeKey>"} [A]
   SAVE: commentId = the id in "Comment created with ID: <id>"
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or item <saved:commentId> is missing → STOP. Say: "Closure comment missing; nothing was closed."
7. CALL {{tool:update_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","status":"done"} [A]
   IF the call returns an error → STOP. Say: "<input:issueId> was not closed: <error text>."
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or result.status != "done" → STOP. Say: "<input:issueId> is <result.status>, not done."
   SAVE: status = result.status

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:issueId> <saved:title>
Done: <closure comment <saved:commentId> | read-only check, nothing changed>; status <saved:status>
Evidence: <input:testResults> | none
Pending: none | <saved:missing>
Next: <the ASK or STOP text that ended the run | none — activity closed>
```
status: backlog | todo | in-progress | done | canceled, from your last get_issue. Never claim a check that a step above did not run and pass.
