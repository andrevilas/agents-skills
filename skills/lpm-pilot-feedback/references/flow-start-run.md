# Playbook: start-run
Use when: beginning a pilot run (always first, before any item)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| stateFilePath | the request, else `${XDG_STATE_HOME:-~/.local/state}/lpm/pilot-feedback-state.json`; never a scratchpad | use the default |
| pilotProjectId | the request (always wins), else the ref's Facts | STOP. Say: "Which project receives pilot defects?" |
| milestoneId | the request (always wins), else the ref's Facts | STOP. Say: "Which milestone receives pilot defects?" |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>. Nothing processed."
1. RUN `test -f '<input:stateFilePath>' || printf '{"processed":[]}\n' > '<input:stateFilePath>'; cat '<input:stateFilePath>'`
   IF the output is not valid JSON → STOP. Say: "State file <input:stateFilePath> unreadable; nothing processed."
   SAVE: processed = parsed.processed array (latest record per ref wins)
2. CALL {{tool:get_mcp_connection_info}} {} [A]
   SAVE: credential = result.credential
3. CALL {{tool:list_milestones}} {"projectId":"<input:pilotProjectId>"} [A]
   SAVE: milestoneRow = the item with id == <input:milestoneId>
   IF no item matches → STOP. Say: "Which milestone receives pilot defects?"
   IF milestoneRow.status == "closed" → STOP. Say: "Milestone <input:milestoneId> is closed. Which milestone receives pilot defects?"
   SAVE: pilotWorkspaceId = milestoneRow.workspaceId; prefix = milestoneRow.name; milestoneStatus = milestoneRow.status

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: pilot run on <input:pilotProjectId>, milestone <input:milestoneId>
Done: state <input:stateFilePath> read (<saved:processed> length records); credential <saved:credential>; milestone <saved:prefix> (<saved:milestoneStatus>); pilotWorkspaceId <saved:pilotWorkspaceId>
Evidence: none
Pending: none
Next: continue with playbook verify-item for each new item
```
Never claim a milestone or state-file content that step 1 or step 3 did not confirm.
