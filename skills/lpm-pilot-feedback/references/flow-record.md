# Playbook: record
Use when: recording the item in the state file (always last, per item)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| stateFilePath | start-run's input | STOP. Say: "Run start-run first." |
| messageRef | the item ref | STOP. Say: "No item ref." |
| receivedAt | the item's receivedAt | STOP. Say: "When was this received?" |
| class | verify-item's saved class | STOP. Say: "Run verify-item first." |
| issueId | register's saved issueId, or null | null |
| commentId | register's saved commentId, or null | null |

## Steps
Every CALL or RUN with no error line: IF it returns an error → STOP. Say: "<tool or command> failed: <error text>."
1. RUN `cat '<input:stateFilePath>'`
   SAVE: records = parsed.processed array
2. SAVE: newRecord = {"messageRef":"<input:messageRef>","receivedAt":"<input:receivedAt>","class":"<input:class>","activityId":"<input:issueId>","commentId":"<input:commentId>","processedAt":"<current UTC ISO>"}; activityId is the issueId, NOT a feedEntryId
3. RUN `printf '%s\n' '<JSON with newRecord appended to records>' > '<input:stateFilePath>.tmp' && mv '<input:stateFilePath>.tmp' '<input:stateFilePath>'`
4. RUN `cat '<input:stateFilePath>'`
   IF the output does not parse or has no processed array → STOP. Say: "State file broken after write."
   IF the record for <input:messageRef> is missing → STOP. Say: "Record not found in state file."

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: state file <input:stateFilePath>
Done: recorded <input:messageRef> as <input:class>
Evidence: activityId <input:issueId>, commentId <input:commentId>
Pending: none
Next: none
```
Never claim a record that step 4 did not confirm in the state file.
