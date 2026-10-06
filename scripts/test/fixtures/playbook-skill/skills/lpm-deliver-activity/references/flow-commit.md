# Playbook: commit
Use when: commit with the LPM-Activity trailer, then comment progress
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity`; never a guess | STOP. Say: "Which LPM activity is this for? (id or title)" |
| repo | the folder of the git repository with your change | STOP. Say: "Which repository folder?" |
| date | today's UTC date as yyyy-mm-dd | — |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>. Nothing more was written."
1. SAVE: subject = one line, imperative, at most 72 characters, saying what changed
2. RUN `git -C <input:repo> commit -m "<saved:subject>" -m "LPM-Activity: <input:issueId>"`
   IF the command fails → STOP. Say: "The commit failed: <first error line>."
   SAVE: sha = the 7-character hash git printed
   VERIFY: RUN `git -C <input:repo> log -1 --format=%B`
   IF the output has no line exactly "LPM-Activity: <input:issueId>" → STOP. Say: "Commit <saved:sha> lacks the trailer."
3. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: n = 1 + the number of items whose createdAt starts with <input:date>; day = <input:date> without dashes; key = "progress-<input:issueId>-<saved:day>-<saved:n>"
4. CALL {{tool:create_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","content":"Commit <saved:sha> <saved:subject>","idempotencyKey":"<saved:key>"} [A]
   SAVE: commentId = the id in "Comment created with ID: <id>"
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or item <saved:commentId> is missing → STOP. Say: "Comment <saved:commentId> is not listed."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>/<input:issueId>
Done: <commit <saved:sha> <saved:subject> with LPM-Activity: <input:issueId> | no commit>; <comment <saved:commentId> | no comment>
Evidence: none attached
Pending: none | evidence not attached
Next: <the STOP text that ended the run | run playbook close>
```
Never claim a commit or a comment that a step above did not run and verify.
