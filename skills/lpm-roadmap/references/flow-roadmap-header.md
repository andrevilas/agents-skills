# Playbook: roadmap-header
Use when: create or edit a roadmap header
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| action | "create" or "edit" ("archive" belongs to lpm-roadmap-owner-ops) | STOP. Say: "Create a roadmap, or edit one?" |
| name | create: the new title; edit: the roadmap id or its current title | STOP. Say: "Which roadmap title?" |
| newTitle | edit: the new title the owner gave | "unchanged" |
| description | the description the owner gave | create: ""; edit: "unchanged" |
| status | "draft" or "active", only when the owner named it | create: "draft"; edit: "unchanged" |
| ownerOrder | the exact words in this conversation where the workspace owner orders this exact change; a plain request is not one | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_workspace}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: mode = result.roadmapGovernanceMode when it is "off", "shadow" or "enforce", else "off" when result.roadmapGovernanceEnabled == false, else "shadow"; ask = "Owner decision needed: <input:action> roadmap "<input:name>" (mode <saved:mode>; enforce does not block it, so the owner's order is the only gate). A) the workspace owner orders it here; B) do nothing."
   IF <input:action> == "archive" → STOP. This belongs to skill {{skill:lpm-roadmap-owner-ops}}. Say: "Archiving a roadmap is an owner operation."
2. CALL {{tool:list_workspace_roadmaps}} {"workspaceId":"<input:workspaceId>","includeArchived":true} [A]
   Always make this call: LPM does not deduplicate roadmap titles.
   SAVE: roadmapId, curTitle, curDescription, curStatus = id, title, description, status of the only item whose id == <input:name> or whose title equals <input:name> ignoring case and accents, else "none"
   IF <input:action> == "create" and <saved:roadmapId> != "none" → STOP. Say: "Roadmap <saved:roadmapId> '<saved:curTitle>' already exists (<saved:curStatus>). Reuse it or edit it?"
   IF <input:action> == "edit" and <saved:roadmapId> == "none" → STOP. Say: "Which roadmap? <each title (id, status)>"
   IF <input:action> == "edit" and <saved:curStatus> == "archived" and <input:status> == "unchanged" → STOP. Say: "Roadmap <saved:roadmapId> is archived: say "draft" or "active" to un-archive it."
   SAVE: setTitle = <input:newTitle>, or <saved:curTitle> when "unchanged"; setDescription = <input:description>, or <saved:curDescription> when "unchanged"; setStatus = <input:status>, or <saved:curStatus> when "unchanged"
   IF <input:action> == "edit" → go to step 5.
3. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "<saved:ask>"
4. CALL {{tool:create_workspace_roadmap}} {"workspaceId":"<input:workspaceId>","title":"<input:name>","description":"<input:description>","status":"<input:status>"} [O]
   Send status "active" only when the owner said active; several active roadmaps are allowed but unusual.
   IF the call returns an error → STOP. Say: "Not created: <error text>. Do not call create again: after a timeout run this playbook again (step 2 finds a roadmap that was created)."
   SAVE: roadmapId = result.id
   VERIFY: CALL {{tool:list_workspace_roadmaps}} {"workspaceId":"<input:workspaceId>","includeArchived":true} [A]
   IF the call returns an error or no item has id == <saved:roadmapId> and title == <input:name> → STOP. Say: "Roadmap <saved:roadmapId> is not listed."
   SAVE: outcome = "roadmap <saved:roadmapId> created, status <input:status>"; go to Answer.
5. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "<saved:ask>"
6. CALL {{tool:update_workspace_roadmap}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","title":"<saved:setTitle>","description":"<saved:setDescription>","status":"<saved:setStatus>"} [O]
   Never send status "archived".
   VERIFY: CALL {{tool:list_workspace_roadmaps}} {"workspaceId":"<input:workspaceId>","includeArchived":true} [A]
   IF the call returns an error or item <saved:roadmapId> does not have title <saved:setTitle> and status <saved:setStatus> → STOP. Say: "Roadmap <saved:roadmapId> does not show the new values."
   SAVE: outcome = "roadmap <saved:roadmapId> updated: '<saved:setTitle>', <saved:setStatus>"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<saved:roadmapId> <input:name>; mode <saved:mode>
Done: <saved:outcome> | reads only, nothing changed
Evidence: list_workspace_roadmaps → <saved:roadmapId> with the new values; owner order: "<input:ownerOrder>" | none
Pending: none | owner decision: option A or B
Next: <the ASK or STOP text that ended the run> | add items with playbook create-item (owner order) | none
```
mode: off | shadow | enforce, from step 1. roadmap status: draft | active | archived, from step 2 or the VERIFY. Never claim a change that the VERIFY did not show.
