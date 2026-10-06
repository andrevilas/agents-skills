# Playbook: daily-sync
Use when: daily sync of a project
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| today | today's date as YYYY-MM-DD | — |
| now | the current UTC time (ISO 8601) | — |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Sync incomplete: <tool> failed: <error text>."
1. CALL {{tool:get_project_execution_context}} {"projectId":"<input:projectId>"} [A]
   Make this call once per sync (it is heavy). This playbook only reads: make no write, even for a problem it finds.
   SAVE: open = result.planning.openIssues (at most 50, not done or canceled); capped = "yes" if it has 50 items, else "no"; cycles = result.planning.activeCycles; milestones = result.planning.openMilestones; decisions = the items of result.governance (the owner's decisions: list them, never decide them)
2. CALL {{tool:list_blocked_project_issues}} {"projectId":"<input:projectId>","limitCount":100} [A]
   IF the call returns an error → go to step 3.
   SAVE: blocked = the id of every item; go to step 4.
3. CALL {{tool:get_project_dependency_summary}} {"projectId":"<input:projectId>"} [A]
   SAVE: blocked = the issueId of every item of result.criticalBlockers
4. CALL {{tool:recommend_next_activity}} {"projectId":"<input:projectId>"} [A]
   SAVE: next = "<result.recommendation.issueId> (<result.recommendation.strategy>)", plus " in project <result.recommendation.projectId>" when that differs from <input:projectId>; "no actionable activity" when result.recommendation is null
5. SAVE: inProgress = the items of <saved:open> with status "in-progress"
   SAVE: stale = the items of <saved:open> with status "in-progress" whose updatedAt is more than 48 hours before <input:now> (comments not checked)
   SAVE: overdue = the items of <saved:open> whose dueDate is a YYYY-MM-DD date before <input:today> (an unparsable dueDate is never overdue)
   SAVE: load = the assigneeId holding more than 40 % of the items of <saved:open> with status "todo" or "in-progress" (empty if none)
   SAVE: staleCycles = the items of <saved:cycles> whose endDate is before <input:today>; twoActive = "yes" if <saved:cycles> has 2 or more items, else "no"
   SAVE: risky = "yes" if one cycleId holds 3 or more activities that are in <saved:stale>, <saved:overdue> or <saved:blocked>, else "no"
   SAVE: line = "in-progress <count of inProgress> · stale <count> (<ids>) · blocked <count> (<ids>) · overdue <count> (<ids>) · next <saved:next>"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: project <input:projectId>, sync of <input:today><; first 50 open activities only when <saved:capped> is "yes">
Done: read-only sync, nothing changed: <saved:line>
Evidence: get_project_execution_context, <list_blocked_project_issues | get_project_dependency_summary (blocked list denied)>, recommend_next_activity
Pending: <none | owner decisions: <each of <saved:decisions> as "<title or id>"> | active cycle past its end: <saved:staleCycles> | two active cycles: which one is current? | load: <saved:load> holds over 40 % of open work>
Next: <the STOP text that ended the run | close or replace <saved:staleCycles> with playbook cycle-close | comment on a stale activity with playbook escalate | health review with skill lpm-review-health (3 or more risky activities in one cycle) | start <saved:next> | none>
```
List every Pending item that applies, separated by "; ". Offer the lpm-review-health hand-off only when <saved:risky> is "yes", and ask which cycle is current only when <saved:twoActive> is "yes". Never write that a check passed when its step did not run.
