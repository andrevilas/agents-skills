# Playbook: allocation
Use when: add, change or remove a project allocation on an item
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or skill lpm-start | STOP. Say: "Which LPM workspace?" |
| order | the owner's message, quoted verbatim: the speaker says they are the workspace owner and orders this change | STOP. This belongs to skill {{skill:lpm-roadmap}}. Say: "There is no owner order, so I can only propose this as a change request; nothing was changed." |
| roadmap | the roadmap title or id the user named | STOP. Say: "Which roadmap?" |
| item | the roadmap item title or id | STOP. Say: "Which roadmap item?" |
| project | the project name, key or id | STOP. Say: "Which project?" |
| change | "create", "edit" (role or rationale) or "archive" | STOP. Say: "Allocate, change or remove the allocation?" |
| role | primary, contributor, dependent or observer, from the order | create: STOP. Say: "Which role: primary, contributor, dependent or observer?"; else "unchanged" |
| rationale | the owner's reason, verbatim ("Motivo:", "porque"); an archive stores it as the rationale | the quoted order |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing more was changed."
1. CALL {{tool:get_workspace}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: mode = result.roadmapGovernanceMode, else "off" when result.roadmapGovernanceEnabled == false, else "shadow"
2. CALL {{tool:get_workspace_roadmap_overview}} {"workspaceId":"<input:workspaceId>","compact":true,"includeArchived":true} [A]
   SAVE: roadmapId = id of the one roadmaps[] entry whose title or id equals <input:roadmap>; itemId, isArchived = those fields of the one items[] entry with roadmapId == <saved:roadmapId> whose title or id equals <input:item>; allocs = allocations[] entries with itemId == <saved:itemId> (id, projectId, role, status)
   IF a name matches 0 or 2+ entries → STOP. Say: "Which one do you mean: <the matching titles with ids>?"
3. CALL {{tool:list_workspace_projects}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: projectId = id of the one project whose name, key or id equals <input:project>
   IF 0 or 2+ projects match → STOP. Say: "Which project: <the matching names with ids>?"
   SAVE: allocId, allocRole = id, role of the <saved:allocs> entry with projectId == <saved:projectId> and status "active" or no status, empty if none; primaryId = id of the <saved:allocs> entry with role "primary" and status "active" or no status, empty if none
4. IF <input:change> == "create" and <saved:allocRole> == <input:role> → SAVE: readBack = "already active: <saved:allocId>"; go to Answer.
   IF <input:change> == "create" and <saved:isArchived> == true → STOP. Say: "<input:item> is archived; restore it first (playbook items)."
   IF <input:change> != "create" and <saved:allocId> is empty → STOP. Say: "<input:project> has no active allocation on <input:item>."
   IF <input:change> == "edit" and <input:role> == "primary" → STOP. Say: "Making a role primary here can leave two primaries. Use change create with role primary: it replaces the current primary."
   IF <saved:mode> == "enforce" and <input:change> == "create" → STOP. This belongs to skill {{skill:lpm-roadmap}}. Say: "In enforce a new allocation is a change request (changeType allocate). Nothing was changed."
   SAVE: newRole = <input:role>, else <saved:allocRole> when "unchanged"; newStatus = "archived" for archive, else "active"; replaces = <saved:primaryId> when <input:change> == "create" and <input:role> == "primary", else ""
5. IF <saved:mode> == "enforce" → switch to playbook governance.
   Hand it mode "window", kind "allocation", entityId <saved:allocId>, newValue <saved:newRole>, newStatus <saved:newStatus>, rationale <input:rationale>.
   IF <input:change> != "create" → go to step 8.
6. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: allocate <input:project> as <saved:newRole> on <input:item>?"
   IF <saved:replaces> is not empty → ASK: "Replace the primary allocation <saved:replaces> of <input:item> with <input:project>? The old one becomes superseded. (yes/no)" — continue only if the user says yes; otherwise STOP.
   IF the order does not name the project, the item and the role → ASK: "Allocate <input:project> as <saved:newRole> on <input:item>? (yes/no)" — continue only if the user says yes; otherwise STOP.
7. CALL {{tool:create_workspace_roadmap_allocation}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","itemId":"<saved:itemId>","projectId":"<saved:projectId>","role":"<saved:newRole>","rationale":"<input:rationale>","replacesAllocationId":"<saved:replaces>"} [O]
   SAVE: allocId = result.id
   VERIFY: CALL {{tool:list_workspace_roadmap_allocations}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>"} [A]
   IF the call returns an error or <saved:allocId> is not listed with status "active" or <saved:itemId> has 2+ active primaries → STOP. Say: "The re-read shows <what was read> for <saved:allocId>."
   SAVE: readBack = "<saved:allocId> <saved:newRole> active"
   GO TO Answer
8. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: set allocation <saved:allocId> to <saved:newRole>, <saved:newStatus>?"
9. CALL {{tool:update_workspace_roadmap_allocation}} {"workspaceId":"<input:workspaceId>","allocationId":"<saved:allocId>","role":"<saved:newRole>","status":"<saved:newStatus>","rationale":"<input:rationale>"} [O]
   VERIFY: CALL {{tool:get_workspace_roadmap_overview}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","compact":true,"includeArchived":true} [A]
   IF the call returns an error or allocations[] entry <saved:allocId> has status != <saved:newStatus> or role != <saved:newRole> → STOP. Say: "Allocation <saved:allocId> reads <status>, <role>."
   SAVE: readBack = "<saved:allocId> <saved:newRole> <saved:newStatus>"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <saved:roadmapId> / <saved:itemId> / <saved:projectId> (mode <saved:mode>); owner order: "<input:order>"
Done: <allocation <saved:allocId>: role <saved:newRole>, status <saved:newStatus>; replaced <saved:replaces> | nothing changed>
Evidence: <re-read: <saved:readBack> | none>
Pending: <none | <the change not done>>
Next: <the ASK or STOP text that ended the run | undo: archive with this playbook | none>
```
role: primary | contributor | dependent | observer (observer is never materialized); status: active | superseded | rejected | archived. Never claim a change that a VERIFY above did not show.
