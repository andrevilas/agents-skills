# Playbook: set-description
Use when: missing-mandate:mission is open and the owner wants the workspace description set, not the mission
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| text | the description text the owner wrote, copied exactly | STOP. Say: "Which description text?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_workspace_executive_context}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: name = result.workspace.name; old = result.workspace.description (empty if absent); canManage = result.workspace.access.canManage; stored = result.workspace.executiveContext.mandate.mission (empty if absent)
   IF <saved:stored> is not empty → STOP. Say: "A mission is stored, so the description does not change it. To change the mission, the owner orders it (playbook prepare-change)."
   IF <saved:canManage> != true → STOP. Say: "Only the owner or an admin can change the workspace description. Nothing was changed."
2. ASK: "Change the description of <saved:name> (<input:workspaceId>) from "<saved:old>" to "<input:text>"? While no mission is stored, LPM reads the mission from it. (yes/no)" — continue only if the user says yes; otherwise STOP.
3. CALL {{tool:update_workspace}} {"workspaceId":"<input:workspaceId>","description":"<input:text>"} [C] (send no other field)
   Wait 6 seconds (LPM caches reads for about 5 s).
   VERIFY: CALL {{tool:get_workspace_executive_context}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or result.executiveContext.mandate.mission != <input:text> → STOP. Say: "The mission does not read the new description yet."
   VERIFY: CALL {{tool:generate_workspace_readiness_report}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or result.report lists missing-mandate:mission → STOP. Say: "missing-mandate:mission is still open after the update."
   SAVE: status = result.report.status; score = result.report.score

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: workspace <saved:name> (<input:workspaceId>)
Done: <description set to "<input:text>" | nothing changed>
Evidence: <readiness <saved:status>, score <saved:score>; closed missing-mandate:mission | none>
Pending: none
Next: <the ASK or STOP text that ended the run | none>
```
status: complete | partial | blocked, from step 3. Never claim the gap closed unless both VERIFY reads of step 3 passed.
