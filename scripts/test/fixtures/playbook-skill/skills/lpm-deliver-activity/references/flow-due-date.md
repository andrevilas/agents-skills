# Playbook: due-date
Use when: set the due date of one activity
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user | STOP. Say: "Which LPM activity? (id or title)" |
| dueDate | the user, as yyyy-mm-dd | STOP. Say: "Which due date? (yyyy-mm-dd)" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Due date not set: <tool> failed: <error text>."
1. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: title = result.title
2. CALL {{tool:set_project_issue_due_date}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","dueDate":"<input:dueDate>"} [A]
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or result.dueDate != <input:dueDate> → STOP. Say: "The due date of <input:issueId> is not <input:dueDate>."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:issueId> <saved:title>
Done: due date <input:dueDate> | nothing changed
Evidence: get_issue shows dueDate <input:dueDate> | none
Pending: none
Next: <the STOP text that ended the run | none>
```
Never claim a date that the VERIFY of step 2 did not read back.
