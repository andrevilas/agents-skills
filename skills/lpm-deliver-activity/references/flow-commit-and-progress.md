# Playbook: commit-and-progress
Use when: commit with the LPM-Activity trailer, or comment progress
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| issueId | the user or `.lpm-activity`; never a guess | STOP. Say: "Which LPM activity is this for? (id or title)" |
| repo | the folder of the git repository with your change | "none" (comment only) |
| testResult | "<command> → <passed/total>" from the user or your own run | "not run" |
| push | "yes" only when the user asked for a push | "no" |
| date | today's UTC date as yyyy-mm-dd | — |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>. Nothing more was written."
1. CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error → STOP. Say: "<input:issueId> was not found in <input:projectId>: <error text>. Which activity is this for? (id or title)"
   SAVE: title = result.title; status = result.status; workspaceId = result.workspaceId
   IF <saved:status> is "done" or "canceled" → STOP. Say: "<input:issueId> is <saved:status>. Reopen it first with playbook start? (yes/no)"
   IF <input:repo> is "none" → go to step 9.
2. RUN `git -C <input:repo> status --short`
   SAVE: files = the listed paths that you changed for this activity (leave out every other path)
   IF <saved:files> is empty → STOP. Say: "Nothing of <input:issueId> to commit in <input:repo>."
   IF a path in <saved:files> is a `.env`, key, token or credentials file → STOP. Say: "<path> holds secrets; I will not commit it."
3. RUN `git -C <input:repo> add -- <saved:files>`
4. SAVE: subject = one line, imperative, at most 72 characters, saying what changed
   SAVE: body = what changed and why, then "Tests: <input:testResult>"
5. RUN `git -C <input:repo> commit -m "<saved:subject>" -m "<saved:body>" -m "LPM-Activity: <input:issueId>"`
   Your client's own trailers (e.g. Co-Authored-By) go in that last -m, on lines after LPM-Activity.
   IF the command fails → STOP. Say: "The commit failed: <first error line>. I did not bypass the hook or the check."
   SAVE: sha = the 7-character hash git printed
   VERIFY: RUN `git -C <input:repo> log -1 --format=%B`
   IF the output has no line exactly "LPM-Activity: <input:issueId>" → STOP. Say: "Commit <saved:sha> lacks the trailer. Fix it with git commit --amend before any push."
   IF <input:push> is "no" → go to step 9.
6. SAVE: checks = the commands that the repository's AGENTS.md, CLAUDE.md or CONTRIBUTING.md say to run before a push (read the files that exist)
7. FOR EACH check IN <saved:checks> (none → go to step 8):
   RUN `<each:command>`
   IF the command fails → STOP. Say: "Check <each:command> failed: <first error line>. Nothing was pushed."
8. RUN `git -C <input:repo> push`
   IF the command fails → STOP. Say: "The push failed: <first error line>."
   VERIFY: RUN `git -C <input:repo> status -sb`
   IF the first line shows "ahead" → STOP. Say: "The push did not reach the remote branch."
9. CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   SAVE: n = 1 + the number of items whose createdAt starts with <input:date>; day = <input:date> without dashes; key = "progress-<input:issueId>-<saved:day>-<saved:n>"
10. SAVE: progress = this text, filled, labels in the user's language (Progresso, Commits, Testes, Pendente, Próximo passo):
   ```text
   Progress: <one line: what changed>
   Commits: <saved:sha> <saved:subject>, or none
   Tests: <input:testResult>
   Pending: <"push not done" when <input:push> is "no">; evidence not attached
   Next: <one action>
   ```
11. CALL {{tool:create_comment}} {"projectId":"<input:projectId>","issueId":"<input:issueId>","content":"<saved:progress>","idempotencyKey":"<saved:key>"} [A]
   SAVE: commentId = the id in "Comment created with ID: <id>"
   VERIFY: CALL {{tool:list_comments}} {"projectId":"<input:projectId>","issueId":"<input:issueId>"} [A]
   IF the call returns an error or item <saved:commentId> is missing or has other text → STOP. Say: "Comment <saved:commentId> does not show the progress text (key <saved:key> was reused)."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<input:issueId> <saved:title>
Done: <commit <saved:sha> <saved:subject> with LPM-Activity: <input:issueId> | no commit>; <pushed | not pushed>; <comment <saved:commentId> | no comment>; status <saved:status>
Evidence: none attached; tests <input:testResult>
Pending: <none | push not done (not asked) | evidence not attached>
Next: <the STOP text that ended the run | attach the test report with playbook evidence, then run playbook close>
```
status: backlog | todo | in-progress | done | canceled, from step 1; a commit never changes it. Never claim a push, a check or a comment that a step above did not run and verify.
