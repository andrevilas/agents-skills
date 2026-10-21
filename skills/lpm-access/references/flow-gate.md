# Playbook: gate
Use when: any [O] write on rows 3–8 (verify owner order and access before the operation)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| ownerOrder | the owner's own words in this conversation naming this exact action | STOP. Say: "This change needs the workspace owner's order in this conversation." |
| row | the decision-table row number that matched (3, 4, 5, 6, 7, or 8) | STOP. Say: "Which credential action?" |
| workspaceId | the user, or step 4 | step 4 resolves it |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>."
1. SAVE: quote = "<input:ownerOrder>"
   IF <saved:quote> is empty → STOP. Say: "This change needs the workspace owner's order in this conversation."
2. IF <input:row> is 6, 7, or 8 → go to step 4.
3. CALL {{tool:list_api_keys}} {} [A]
   IF the call returns an error with code -32003 → STOP. Say: "This key cannot call list_api_keys; add it to the key's allowedTools or use a full key."
   SAVE: existingKeys = result; go to step 5.
4. CALL {{tool:list_workspaces}} {} [A]
   SAVE: canManage = access.canManage of the item whose id == <input:workspaceId>
   IF <input:row> is 7 → go to step 5.
   IF <saved:canManage> != true → STOP. Say: "Only a workspace owner or admin can change workspace credentials; ask the owner."
5. SAVE: preview = the exact tool call with its arguments (show secrets as "<from $ENV_NAME>")
   ASK: "<saved:preview>? Owner order: <saved:quote>. Proceed? (yes/no)" — continue only if the user says yes; otherwise STOP.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: gate passed for row <input:row>
Done: owner order verified; <list_api_keys read | list_workspaces read>
Evidence: quote: "<saved:quote>"
Pending: proceed to the operation playbook
Next: run the operation playbook
```
Never claim a check passed that the steps did not verify.
