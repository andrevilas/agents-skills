# Playbook: open-thread
Use when: open a thread asking for a decision
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| targetType | "requirement", "baseline", "roadmap-item" or "roadmap-change-request" from the user; "activity" when the topic is one activity | STOP. Say: "Which requirement, baseline, roadmap item or change request is this about?" |
| targetId | the user, or an id read in skill lpm-requirements-scope (requirement, baseline) or lpm-roadmap (item, change request) | STOP. Say: "Which <input:targetType> exactly? (id)" — never guess it |
| question | the decision to ask for, one line | STOP. Say: "Which decision is needed?" |
| optionA | the first choice with its consequences (cost, risk, what changes, reversible or not), from the user | what the user asked for |
| optionB | the second choice with its consequences, from the user | keep the current scope |
| recommendation | the option the user recommends, with the reason | "A", with the user's reason |
| topic | short kebab-case words for the anchor ("pdf-export") | made from <input:question> |
| aiSpend | "yes" if the decision enables, expands or cuts AI or AISH spend | "no" |
| aiFields | the 7 AI fields the user gave: feature scope, benefit, budget/limit, fallback, owner, review date (YYYY-MM-DD), rollback trigger | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "No thread was opened: <tool> failed: <error text>."
1. IF <input:targetType> == "activity" → switch to playbook activity-note.
   Governance threads cannot target activities; discussion about an activity is an activity comment.
2. CALL {{tool:get_project}} {"projectId":"<input:projectId>"} [A]
   SAVE: workspaceId = result.workspaceId; deciders = each "<role> <userId>" of result.governanceAssignments, else "project owner (unassigned)"
   IF <input:targetType> is "roadmap-item" or "roadmap-change-request" and <saved:workspaceId> is empty → STOP. Say: "<input:projectId> has no workspace, so it cannot hold roadmap threads. Target a requirement or baseline."
   IF <input:targetType> != "roadmap-change-request" → go to step 4.
3. CALL {{tool:get_workspace_roadmap_change_request}} {"workspaceId":"<saved:workspaceId>","changeRequestId":"<input:targetId>"} [A]
   IF result.status is "applied", "rejected", "withdrawn" or "superseded" → ASK: "Change request <input:targetId> is <result.status>. Open a thread on it anyway? (yes/no)" — continue only if the user says yes; otherwise STOP.
4. CALL {{tool:list_governance_threads}} {"projectId":"<input:projectId>","targetType":"<input:targetType>","targetId":"<input:targetId>","limitCount":100} [A]
   Always make this call before opening a thread.
   IF an item has status "open", "answered" or "decision-needed" → STOP. Say: "Thread <that item's id> ("<its title>") is already open on <input:targetId>. Reply there with playbook reply; no second thread was opened."
5. IF <input:aiSpend> == "yes" and <input:aiFields> does not hold all 7 fields → STOP. Say: "This decision changes AI spend. Give these fields first: <the missing ones of: feature scope, benefit, budget/limit, fallback, owner, review date (YYYY-MM-DD), rollback trigger>."
6. SAVE: content = this text, filled (labels in the user's language; facts and ids only from the user's message and steps 2-4; one recommendation; no option pre-selected; never write that a decision was made):
   ```text
   Decision needed: <input:question>
   Context: <facts with ids>
   Options:
     A) <input:optionA>
     B) <input:optionB>
     C) do nothing - consequences: <what stays as is>
   Recommendation: <input:recommendation>
   AI fields: <input:aiFields>   (write this line only when <input:aiSpend> == "yes")
   Decision requested from: <saved:deciders>
   ```
   SAVE: title = <input:question> cut to 120 characters; anchorKey = "<input:targetType>:<input:targetId>:<input:topic>"
7. CALL {{tool:create_governance_thread}} {"projectId":"<input:projectId>","targetType":"<input:targetType>","targetId":"<input:targetId>","title":"<saved:title>","content":"<saved:content>","anchorKey":"<saved:anchorKey>"} [A]
   IF the call returns an error → STOP. Say: "No thread was opened: <error text>. Do not retry before running this playbook again (step 4 finds a thread that was created)."
   SAVE: threadId = the id in "Governance thread created with ID: <id>"
   VERIFY: CALL {{tool:list_governance_threads}} {"projectId":"<input:projectId>","targetType":"<input:targetType>","targetId":"<input:targetId>","limitCount":100} [A]
   IF the call returns an error or no item has id == <saved:threadId> and status "open" → STOP. Say: "Thread <saved:threadId> is not listed as open on <input:targetId>; do not open it again."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<input:targetType> <input:targetId>
Done: <thread <saved:threadId> opened, status open | nothing changed>
Evidence: <list_governance_threads shows <saved:threadId> open | none>; decision requested from <saved:deciders>
Pending: <the decider answers <saved:threadId> | none>
Next: <the ASK or STOP text that ended the run | the decider decides; then record it with playbook record-decision>
```
status: open | answered | decision-needed | resolved | closed, from step 4 or the VERIFY. Never claim the thread is open unless the VERIFY listed it; the thread never states a decision.
