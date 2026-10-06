# Playbook: edit-requirement
Use when: edit, link, regroup or set the status of a requirement
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| requirement | the requirement id or exact title | STOP. Say: "Which requirement? (id or title)" |
| newTitle | the new title the user gave | "none" |
| newDescription | the new description the user gave | "none" |
| newType | functional, non-functional, interface, business or technical | "none" |
| newStatus | pending, in-progress, met or not-met | "none" |
| newGroup | the group name the user gave | "none" |
| link | activity titles or ids to link | "none" |
| unlink | activity titles or ids to unlink | "none" |
| ownerOrder | the workspace owner's own words in this conversation ordering this change (or saying it is met), verbatim; anyone else's "yes" is not it | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Editing requirements needs an LPM API key."
2. CALL {{tool:get_project_scope_resolution_context}} {"projectId":"<input:projectId>"} [A]
   SAVE: baselineId, version, baselineCreatedAt = id, version, createdAt of result.currentBaseline
3. CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>"} [A]
   SAVE: requirementId = id of the only item whose id or title == <input:requirement>; title, description, type, status, groupId, issueId, linkedIssueIds, linkedCycleIds, linkedMilestoneIds = those fields of that item; approved = "yes" if its createdAt <= <saved:baselineCreatedAt>, else "no"
   IF no item or 2+ items match → STOP. Say: "Which requirement? <each matching id and title>"
   IF <saved:approved> == "yes" and <input:ownerOrder> == "none" and <input:newDescription> != "none" → switch to playbook proposal.
   IF <saved:approved> == "yes" and <input:ownerOrder> == "none" and (<input:newTitle> != "none" or <input:newType> != "none") → SAVE: change = "title/type change: <input:newTitle> <input:newType>"; go to step 4.
   IF <input:newStatus> == "obsolete" → switch to playbook remove-requirement.
   GO TO step 7
4. CALL {{tool:list_governance_threads}} {"projectId":"<input:projectId>","targetType":"requirement","targetId":"<saved:requirementId>"} [A]
   IF an item has status neither "resolved" nor "closed" → STOP. Say: "Thread <that id> already asks the owner about <saved:requirementId>. Nothing was changed."
5. SAVE: content = this text, filled:
   ```text
   Decision needed: <saved:change> of requirement <saved:title> (<saved:requirementId>) in approved baseline <saved:version> (<saved:baselineId>).
   Options: A) apply it — the working scope changes and the next publication may need a reviewed change set; B) keep the approved text.
   Recommendation: A, because the requester asked for it; the owner decides.
   ```
6. CALL {{tool:create_governance_thread}} {"projectId":"<input:projectId>","targetType":"requirement","targetId":"<saved:requirementId>","title":"Change approved requirement <saved:title>","content":"<saved:content>"} [A]
   SAVE: threadId = the id after "ID: "
   VERIFY: CALL {{tool:list_governance_threads}} {"projectId":"<input:projectId>","targetType":"requirement","targetId":"<saved:requirementId>"} [A]
   IF the call returns an error or no item has id == <saved:threadId> → STOP. Say: "Thread <saved:threadId> is not listed."
   SAVE: outcome = "thread <saved:threadId> opened; requirement unchanged"; go to Answer.
7. CALL {{tool:list_issues}} {"projectId":"<input:projectId>"} [A] (no limitCount: it returns every issue)
   SAVE: issueIds = <saved:linkedIssueIds> plus the id of the only issue whose id or title == each name in <input:link>, minus those named in <input:unlink>; issueId = <saved:issueId> if still in <saved:issueIds>, else its first id, else ""
   IF a name matches no issue or 2+ issues → STOP. Say: "Which activity is '<that name>'?"
   IF <input:newStatus> == "met" and <input:ownerOrder> == "none" and <saved:issueIds>, <saved:linkedCycleIds> and <saved:linkedMilestoneIds> are all empty → STOP. Say: "Not met yet: no linked delivery."
   IF <input:newStatus> == "met" and <input:ownerOrder> == "none" and an id of <saved:issueIds> has status != "done" → STOP. Say: "Not met yet: <that id> is <its status>."
8. CALL {{tool:list_requirement_groups}} {"projectId":"<input:projectId>"} [A]
   SAVE: groupId = id of the only item whose name == <input:newGroup> when it is not "none", else <saved:groupId> ("" if null)
   IF <input:newGroup> != "none" and no item matches → STOP. Say: "No group named '<input:newGroup>' (playbook groups-and-orphans creates it)."
   SAVE: sendTitle, sendDescription, sendType, sendStatus = <input:newTitle>, <input:newDescription>, <input:newType>, <input:newStatus> where not "none", else <saved:title>, <saved:description>, <saved:type>, <saved:status>
9. ASK: "Update <saved:requirementId>: title '<saved:sendTitle>', type <saved:sendType>, status <saved:sendStatus>, group <saved:groupId>, activities <saved:issueIds>, description <changed or unchanged>? Intent: refinement. This changes the working scope; it is approved only when a baseline is published. (yes/no)" — continue only if the user says yes; otherwise STOP.
10. CALL {{tool:update_requirement}} {"projectId":"<input:projectId>","requirementId":"<saved:requirementId>","title":"<saved:sendTitle>","description":"<saved:sendDescription>","type":"<saved:sendType>","status":"<saved:sendStatus>","groupId":"<saved:groupId>","issueId":"<saved:issueId>","linkedIssueIds":["<saved:issueIds>"]} [C] (the array holds every id of <saved:issueIds>, [] if none; "" clears)
   VERIFY: CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>"} [A]
   IF the call returns an error or item <saved:requirementId> does not show every sent value → STOP. Say: "<saved:requirementId> does not show the sent values."
   SAVE: outcome = "requirement <saved:requirementId> updated"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>; baseline <saved:version> (<saved:baselineId>); requirement <saved:requirementId> <saved:title>
Done: <saved:outcome> | nothing changed
Evidence: <list_requirements → the sent values | list_governance_threads → <saved:threadId>> | reads only
Pending: none | owner decision in thread <saved:threadId> — the workspace owner | publishing a baseline needs the owner's order
Next: <the ASK or STOP text that ended the run> | the owner answers in thread <saved:threadId> | none
```
requirement status: pending | in-progress | met | not-met | obsolete. Never claim a change that a VERIFY did not show.
