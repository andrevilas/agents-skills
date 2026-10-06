# Playbook: create-item
Use when: create a roadmap item (never a change request)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| roadmap | the roadmap id or title the user named | "none" (step 2 takes the only active roadmap) |
| title | the new item's title, in the user's words | STOP. Say: "What is the title of the new item?" |
| priority | "urgent", "high", "medium", "low" or "none", from the user's words | "none" |
| description | the description the user gave | the title |
| ownerOrder | the exact words in this conversation where the workspace owner orders creating this item (e.g. "I am the workspace owner: create item X in rm_1"); a plain request ("add item X") is not one | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. No item was created."
1. CALL {{tool:get_workspace}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: mode = result.roadmapGovernanceMode when it is "off", "shadow" or "enforce", else "off" when result.roadmapGovernanceEnabled == false, else "shadow"
   A new item never goes through a change request: never `changeType: "create"` (LPM has no governed create path; its apply writes nothing). Never call an owner-ops tool here.
2. CALL {{tool:list_workspace_roadmaps}} {"workspaceId":"<input:workspaceId>","includeArchived":true} [A]
   SAVE: roadmapId, roadmapTitle, roadmapStatus = id, title, status of the only item whose id == <input:roadmap> or whose title equals <input:roadmap> ignoring case and accents; when <input:roadmap> == "none": of the only item with status "active"
   IF no item or 2+ items match → STOP. Say: "Which roadmap? <each title (id, status)>"
   IF <saved:roadmapStatus> == "archived" → STOP. Say: "Roadmap <saved:roadmapId> is archived: pick another roadmap."
3. CALL {{tool:list_workspace_roadmap_items}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","includeArchived":true,"compact":true} [A]
   Always make this call before the create: LPM does not deduplicate titles.
   IF an item's title equals <input:title> ignoring case and accents → STOP. Say: "<that id> '<that title>' already exists (lifecycle <its lifecycle>). Reuse it, or change it with a change request (playbook propose-change)?"
4. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Owner decision needed: create roadmap item "<input:title>" (priority <input:priority>) in <saved:roadmapTitle> (<saved:roadmapId>), mode <saved:mode>. LPM has no change request that creates an item, so the only path is the owner's direct create, as a draft. A) the workspace owner orders it here, and I run create_workspace_roadmap_item {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","title":"<input:title>","priority":"<input:priority>"}; B) do nothing. Recommendation: A if the owner wants the item now."
5. CALL {{tool:create_workspace_roadmap_item}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","title":"<input:title>","description":"<input:description>","priority":"<input:priority>"} [O]
   Never send lifecycle: the default draft keeps every later review gate.
   IF the call returns an error → STOP. Say: "Not created: <error text>. Do not call create again: after a timeout run this playbook again, and step 3 finds an item that was created. Permission error: only the workspace owner or an owner/admin member can create items."
   SAVE: itemId = result.id
   VERIFY: CALL {{tool:list_workspace_roadmap_items}} {"workspaceId":"<input:workspaceId>","roadmapId":"<saved:roadmapId>","includeArchived":true} [A]
   IF the call returns an error or no item has id == <saved:itemId> with lifecycle "draft" → STOP. Say: "Item <saved:itemId> is not listed as a draft in <saved:roadmapId>."
   SAVE: lifecycle, priority = those fields of the item with id == <saved:itemId>

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>/<saved:roadmapId>/<saved:itemId> <input:title>; mode <saved:mode>
Done: create_workspace_roadmap_item → <saved:itemId>, lifecycle <saved:lifecycle>, priority <saved:priority>, by the owner's direct create (LPM has no change request for new items) | reads only, nothing created
Evidence: list_workspace_roadmap_items → <saved:itemId> lifecycle <saved:lifecycle>; owner order: "<input:ownerOrder>" | none
Pending: none | owner decision: create "<input:title>" (option A) or do nothing (option B)
Next: <the ASK or STOP text that ended the run> | later changes (prioritize, lifecycle, allocate, link) go through change requests (playbook propose-change)
```
mode: off | shadow | enforce, from step 1. lifecycle: draft, from the VERIFY. priority: urgent | high | medium | low | none. Never claim an item exists unless the VERIFY listed its id; never offer a change request or an owner-ops preview as a way to create it.
