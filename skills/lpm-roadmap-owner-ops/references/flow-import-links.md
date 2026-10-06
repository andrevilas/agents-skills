# Playbook: import-links
Use when: link and allocate the items of an import
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or skill lpm-start | STOP. Say: "Which LPM workspace?" |
| order | the owner's message, quoted verbatim: the speaker says they are the workspace owner and orders the links or allocations | STOP. Say: "Creating these links is the workspace owner's decision. Nothing was changed." |
| roadmapId | the imported roadmap (playbook import's Answer) or the roadmap the owner named | STOP. Say: "Which imported roadmap?" |
| part | "dependencies", "allocations" or "both", from the order | "both" |
| drop | candidate keys or items the owner said to leave out | "none" |
| primaryPicks | the project the owner chose as primary for an item with two primary candidates | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing more was changed."
1. CALL {{tool:get_workspace}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: mode = result.roadmapGovernanceMode, else "off" when result.roadmapGovernanceEnabled == false, else "shadow"; createdLinks = "none"; createdAllocs = "none"; weak = "none"
   IF <saved:mode> == "enforce" → STOP. This belongs to skill {{skill:lpm-roadmap}}. Say: "In enforce new links and allocations are change requests (changeType link, allocate). Nothing was changed."
2. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: resolve the dependency column and suggest project allocations for <input:roadmapId> now?"
   IF <input:part> == "allocations" → go to step 7.
3. CALL {{tool:resolve_workspace_roadmap_dependencies}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>"} [O] (no confirmed: a read-only preview)
   SAVE: depKeys = "<sourceItemId>:<targetItemId>:depends_on" for each result.candidates[] entry, minus <input:drop>; unresolved = result.unresolved; cycles = result.cycles
   VERIFY: CALL {{tool:list_workspace_roadmap_items}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>","compact":true} [A]
   IF the call returns an error or an item id in <saved:depKeys> is not listed → STOP. Say: "The preview names items outside <input:roadmapId>. Nothing was changed."
   IF <saved:cycles> is not empty → STOP. Say: "These items depend on each other in a loop: <saved:cycles>. Which reference is wrong? Nothing was linked."
   IF <saved:depKeys> is empty and <input:part> == "dependencies" → go to Answer.
   IF <saved:depKeys> is empty → go to step 7.
4. ASK: "Create <the count of <saved:depKeys>> links (<each key as source depends_on target>)? Not resolved: <saved:unresolved>. (yes/no; name any link to leave out)" — continue only if the user says yes; otherwise STOP.
5. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: create the links <saved:depKeys>?"
6. CALL {{tool:resolve_workspace_roadmap_dependencies}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>","confirmed":true,"selectedDependencyKeys":"<saved:depKeys>"} [O] (selectedDependencyKeys as a JSON array)
   SAVE: createdLinks = result.createdLinkIds
   VERIFY: CALL {{tool:list_workspace_roadmap_item_links}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>"} [A]
   IF the call returns an error or an id of <saved:createdLinks> is not listed → STOP. Say: "Link <id> is not listed."
   IF <input:part> == "dependencies" → go to Answer.
7. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: suggest project allocations for <input:roadmapId> now?"
8. CALL {{tool:suggest_workspace_roadmap_allocations}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>"} [O] (no confirmed: a read-only preview)
   SAVE: allocKeys = "<itemId>:<projectId>" for each result.candidates[] entry with confidence > 0.49, minus <input:drop>, keeping per item at most one role "primary" (<input:primaryPicks> decides a tie); weak = items whose candidates all have confidence <= 0.49; shown = each kept key with role, confidence and rationale
   VERIFY: CALL {{tool:list_workspace_roadmap_items}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>","compact":true} [A]
   IF the call returns an error or an item id in <saved:allocKeys> is not listed → STOP. Say: "The suggestions name items outside <input:roadmapId>. Nothing was allocated."
   IF an item has two primary candidates and <input:primaryPicks> == "none" → STOP. Say: "Which project is primary for <item>: <A> or <B>?"
   IF <saved:allocKeys> is empty → go to Answer.
9. ASK: "Create these allocations: <saved:shown>? No project matched: <saved:weak> (name one and I use playbook allocation). (yes/no)" — continue only if the user says yes; otherwise STOP.
10. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: create the allocations <saved:allocKeys>?"
11. CALL {{tool:suggest_workspace_roadmap_allocations}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>","confirmed":true,"selectedAllocationKeys":"<saved:allocKeys>"} [O] (selectedAllocationKeys as a JSON array; only keys from step 8)
   SAVE: createdAllocs = result.createdAllocationIds
   VERIFY: CALL {{tool:list_workspace_roadmap_allocations}} {"workspaceId":"<input:workspaceId>","roadmapId":"<input:roadmapId>"} [A]
   IF the call returns an error or an id of <saved:createdAllocs> is not listed with status "active" or an item has 2+ active primaries → STOP. Say: "The re-read does not show allocation <id> as the only active primary."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <input:roadmapId> (mode <saved:mode>); owner order: "<input:order>"
Done: <links <saved:createdLinks>; allocations <saved:createdAllocs> | nothing changed>
Evidence: <list_workspace_roadmap_item_links and list_workspace_roadmap_allocations list every created id | none>
Pending: <none | unresolved references <saved:unresolved> | items without a project <saved:weak>>
Next: <the ASK or STOP text that ended the run | an item without a project: playbook allocation | none>
```
Committed allocations get routingSource hybrid; a project the suggestions did not list for an item is never a selected key (LPM skips it). Never claim a link or an allocation that a VERIFY above did not show.
