# Playbook: api-key
Use when: create an API key for a workspace
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace?" |
| keyName | the user | STOP. Say: "Which name for the API key?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "No key was created: <tool> failed: <error text>."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Creating an API key needs an LPM API key connection."
2. ASK: "Create API key <input:keyName> in workspace <input:workspaceId>? It is shown once. (yes/no)" — continue only if the user says yes; otherwise STOP.
3. CALL {{tool:create_api_key}} {"workspaceId":"<input:workspaceId>","name":"<input:keyName>"} [C]
   SAVE: keyId = the id in the result (never print the key itself)
   VERIFY: CALL {{tool:get_mcp_connection_info}} {} [A]
   IF the call returns an error or result is empty → STOP. Say: "Key <saved:keyId> could not be confirmed."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId>
Done: API key <saved:keyId> created | nothing changed
Evidence: key id <saved:keyId> | none
Pending: none
Next: <the ASK or STOP text that ended the run | store the key in your secret manager>
```
Never claim a key that step 3 did not create.
