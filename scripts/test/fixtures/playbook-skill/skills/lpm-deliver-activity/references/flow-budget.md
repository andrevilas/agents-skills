# Playbook: budget
Use when: change the AISH budget on the owner's order
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "The budget was not changed: <tool> failed: <error text>."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   SAVE: credential = result.credential
2. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision request: change the AISH budget of <input:workspaceId>? Options: keep it, or change it. Recommendation: keep it."
3. CALL {{tool:configure_aish_budget}} {"workspaceId":"<input:workspaceId>"} [O]
   VERIFY: CALL {{tool:get_mcp_connection_info}} {} [A]
   IF the call returns an error or result.credential != <saved:credential> → STOP. Say: "The budget change could not be confirmed."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>
Done: AISH budget changed on the owner's order | nothing changed
Evidence: <the owner's order, quoted> | none
Pending: none
Next: <the ASK or STOP text that ended the run | none>
```
Never claim a change that step 3 did not make.
