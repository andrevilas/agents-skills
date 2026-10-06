# Playbook: baseline-records
Use when: rename, restore or delete a baseline (owner)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| action | "rename", "restore" or "delete", from the owner's words | STOP. Say: "Rename, restore as current, or delete the baseline?" |
| baseline | the baseline id, name or version | STOP. Say: "Which baseline? (id, name or version)" |
| newName | the new name, only for "rename" | "none" |
| newVersion | the new version, only for "rename" | "none" |
| ownerOrder | the workspace owner's own message in this conversation ordering this exact action, copied word for word | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Baseline records need an LPM API key (delete: profile full or custom)."
2. CALL {{tool:list_requirement_baselines}} {"projectId":"<input:projectId>"} [A]
   SAVE: baselineId = id of the only item whose id, name or version == <input:baseline>; name, version, isCurrent = those fields of that item
   IF no item or 2+ items match → STOP. Say: "Which baseline? <each id, name, version, isCurrent>"
   SAVE: sendName = <input:newName> if not "none", else <saved:name>; sendVersion = <input:newVersion> if not "none", else <saved:version>
   IF <input:action> == "restore" and <saved:isCurrent> == true → STOP. Say: "<saved:baselineId> is already current."
   IF <input:action> == "restore" → go to step 5.
   IF <input:action> == "delete" → go to step 7.
3. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Owner: rename baseline <saved:name> <saved:version> to <saved:sendName> <saved:sendVersion>? Nothing was changed."
4. CALL {{tool:update_requirement_baseline}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>","name":"<saved:sendName>","version":"<saved:sendVersion>"} [O] (never send isCurrent false)
   VERIFY: CALL {{tool:list_requirement_baselines}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or item <saved:baselineId> does not have name <saved:sendName> and version <saved:sendVersion> → STOP. Say: "<saved:baselineId> does not show the new name or version."
   SAVE: outcome = "baseline <saved:baselineId> renamed to <saved:sendName> <saved:sendVersion>"; go to Answer.
5. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Owner: restore baseline <saved:name> <saved:version> as current? The publication gate still applies. Nothing was changed."
6. CALL {{tool:update_requirement_baseline}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>","isCurrent":true} [O]
   IF the call returns an error → STOP. Say: "Not restored: <error text>. 'Material baseline publication requires an approved change set' means the owner must approve a matching change set first."
   VERIFY: CALL {{tool:list_requirement_baselines}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or the items with isCurrent == true are not exactly <saved:baselineId> → STOP. Say: "<saved:baselineId> is not the only current baseline."
   SAVE: outcome = "baseline <saved:baselineId> restored as current"; go to Answer.
7. CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>"} [A]
   SAVE: n = the number of items
8. ASK: "Delete baseline <saved:name> <saved:version> with <saved:n> requirements? They are hard-deleted, linked work loses its baseline, and if it is current the newest other baseline becomes current without the gate. It cannot be restored. (yes/no)" — continue only if the user says yes; otherwise STOP.
9. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Owner: delete baseline <saved:name> <saved:version> (<saved:n> requirements)? Nothing was deleted."
10. CALL {{tool:delete_requirement_baseline}} {"projectId":"<input:projectId>","baselineId":"<saved:baselineId>"} [O]
   VERIFY: CALL {{tool:list_requirement_baselines}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or an item still has id == <saved:baselineId> → STOP. Say: "<saved:baselineId> is still listed."
   SAVE: outcome = "baseline <saved:baselineId> deleted (<saved:n> requirements)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>; baseline <saved:baselineId> <saved:name> <saved:version>
Done: <saved:outcome> | nothing changed
Evidence: owner order "<input:ownerOrder>"; list_requirement_baselines → <the new values | the new current | the id is gone> | reads only
Pending: none | owner decision — the workspace owner
Next: <the ASK or STOP text that ended the run> | none
```
Never use isCurrent false and never create a baseline with create_requirement_baseline here. Never claim a change that a VERIFY did not show.
