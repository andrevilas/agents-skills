# Playbook: TEMPLATE
Use when: <one line; the same words as the §5 row and as skill.json loadWhen after "playbook TEMPLATE: ">
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| <input> | <the user, a file, or "step N"> | <STOP. Say: "<question>" — or a default in quotes — or "step N"> |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<what did not happen>: <tool> failed: <error text>."
1. CALL {{tool:<read_tool>}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error → STOP. Say: "<specific text and the next action>"
   SAVE: status = result.status; items = result.items
   IF <saved:status> == "<value>" → STOP. Say: "<exact text>"
   IF <condition on a returned field> → switch to playbook <other-playbook>.
   IF <condition on a returned field> → STOP. This belongs to skill {{skill:<sibling-id>}}. Say: "<exact text>"
   IF <condition on a returned field> → go to step 4.
2. FOR EACH item IN <saved:items> (none → go to step 3):
   CALL {{tool:<read_tool>}} {"projectId":"<each:projectId>"} [A]
   IF <condition on result> → STOP. Say: "<exact text>"
3. ASK: "<exact question, with ids>? (yes/no)" — continue only if the user says yes; otherwise STOP.
4. CALL {{tool:<write_tool_C>}} {"projectId":"<input:projectId>","<requiredParam>":"<saved:status>","idempotencyKey":"<prefix>-<input:projectId>-<saved:status>"} [C]
   SAVE: newId = the id in "<the result text, e.g. Created with ID: <id>>"
   VERIFY: CALL {{tool:<read_tool>}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or <the re-read does not show <saved:newId> with the new value> → STOP. Say: "<exact text>"
5. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "<decision request: context, options, recommendation>"
6. CALL {{tool:<write_tool_O>}} {"projectId":"<input:projectId>"} [O]
   VERIFY: CALL {{tool:<read_tool>}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or <the re-read does not show the change> → STOP. Say: "<exact text>"
7. RUN `<shell command with <input:x> placeholders>`
   IF the command fails → STOP. Say: "<exact text>"
   VERIFY: RUN `<read-back command>`
   IF <the output does not show the change> → STOP. Say: "<exact text>"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <workspace>/<input:projectId>/<ids>
Done: <change with id | nothing changed>; status <saved:status>
Evidence: <ids or citations that a VERIFY read back | none>
Pending: none | <exact item> — <who must act>
Next: <the ASK or STOP text that ended the run | one action>
```
status: <every allowed value of the enum, separated by " | ">, from your last read. Never claim a check that a step above did not run and pass.
