# Playbook: activity-note
Use when: a note on one activity
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity` | STOP. Say: "Which LPM activity? (id or title)" |
| text | the note to post, from the user | STOP. Say: "What should the note on <input:issueId> say?" |
| topic | short kebab-case words for this note ("pdf-layout"); new text gets a new topic | made from <input:text> |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "No note was posted: <tool> failed: <error text>."
1. IF <input:text> asks to change approved scope, a requirement, a baseline or the roadmap → STOP. Say: "This changes scope, so it needs a decision on the requirement, baseline or roadmap item, not on <input:issueId>. Which one? (id) Then I open a thread there with playbook open-thread."
   A comment records execution detail; it is never a decision.
2. CALL {{tool:create_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","content":"<input:text>","idempotencyKey":"gov-note-<input:issueId>-<input:topic>"} [A]
   SAVE: commentId = the id in "Comment created with ID: <id>"
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or item <saved:commentId> is missing or its content does not start with the first 100 characters of <input:text> → STOP. Say: "Comment <saved:commentId> is not listed with this text; the key may belong to an older note: use a new topic."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:issueId>
Done: <comment <saved:commentId> posted | nothing posted>
Evidence: <list_comments shows <saved:commentId> with the text | none>
Pending: none
Next: <the ASK or STOP text that ended the run | none>
```
A governance thread was not opened: threads cannot target activities. Never claim the comment is posted unless the VERIFY listed it.
