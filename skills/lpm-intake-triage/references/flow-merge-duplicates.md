# Playbook: merge-duplicates
Use when: find or merge duplicate entries
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user (both entries are in this project) | STOP. Say: "Which LPM project? (id or name)" |
| primaryEntryId | the entry the user says stays, or primaryEntryId saved by playbook register-report | STOP. Say: "Which entry stays (the primary)?" |
| duplicateEntryId | the entry the user says is the duplicate, or duplicateEntryId saved by playbook register-report | "none" (steps 2-3 look for candidates) |
| reason | the user's words on why they are the same | "Same problem as <input:primaryEntryId>." |
| confirmed | "yes" when the user's message already says yes to merging exactly these two entries | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was merged."
1. CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:primaryEntryId>"} [A]
   SAVE: pTitle = result.title; pDescription = result.description; pCount = result.occurrenceCount
   IF result.duplicateOfEntryId is not empty → STOP. Say: "<input:primaryEntryId> was already merged into <result.duplicateOfEntryId>. Merge into <result.duplicateOfEntryId> instead? Reply with that id as the entry that stays."
   IF result.curationState is "consolidated" or "rejected" or result.status == "archived" → STOP. Say: "<input:primaryEntryId> is <result.curationState>/<result.status> and cannot receive a merge."
   IF <input:duplicateEntryId> != "none" → go to step 4.
2. CALL {{tool:list_operational_entries}} {"projectId":"<input:projectId>","status":"open","limitCount":100} [A]
   Always compare titles before any AI call.
   SAVE: similar = "<id> '<title>'" for each item other than <input:primaryEntryId> whose title shares two or more words of 4+ letters with <saved:pTitle> (ignore case and accents)
   IF <saved:similar> is not empty → STOP. Say: "Possible duplicates of '<saved:pTitle>': <saved:similar>. Which one is the same problem?"
3. CALL {{tool:find_operational_entry_semantic_matches}} {"projectId":"<input:projectId>","entryId":"<input:primaryEntryId>","title":"<saved:pTitle>","description":"<saved:pDescription>","limitCount":5} [A] (spends AI quota: one call, never in a loop)
   IF the call returns an error → STOP. Say: "AI matching is unavailable (<error text>). No title matched; name the duplicate yourself."
   SAVE: matches = "<entryId> '<title>' <strength>" for each item of result.matches; for an item with duplicateOfEntryId write "<duplicateOfEntryId> (primary of <entryId>)" (a match is a candidate, not proof)
   IF <saved:matches> is empty → STOP. Say: "No duplicate of '<saved:pTitle>' found."
   IF <saved:matches> is not empty → STOP. Say: "Candidates (not proof): <saved:matches>. Which one is the same problem?"
4. CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:duplicateEntryId>"} [A]
   SAVE: dTitle = result.title; dCount = result.occurrenceCount; task = result.relatedTaskId (empty if null)
   IF <input:duplicateEntryId> == <input:primaryEntryId> → STOP. Say: "An entry cannot be merged into itself."
   IF result.duplicateOfEntryId is not empty or result.curationState is "consolidated" or "rejected" or result.status == "archived" → STOP. Say: "<input:duplicateEntryId> is already <result.curationState>/<result.status>. Nothing was merged."
   SAVE: taskNote = "; its activity <saved:task> stays linked to the archived entry" when <saved:task> is not empty, else ""
5. ASK: "Merge '<saved:dTitle>' (<input:duplicateEntryId>) into '<saved:pTitle>' (<input:primaryEntryId>) with consolidate_operational_entries, rationale "<input:reason>"? The duplicate is archived for good<saved:taskNote>; the primary gains <saved:dCount> occurrence(s). (yes/no)" — continue only if the user says yes; otherwise STOP.
   When <input:confirmed> == "yes", this question is already answered yes: do not send it; continue with step 6.
6. CALL {{tool:consolidate_operational_entries}} {"projectId":"<input:projectId>","primaryEntryId":"<input:primaryEntryId>","duplicateEntryId":"<input:duplicateEntryId>","rationale":"<input:reason>"} [C]
   Call it once: a second call adds the occurrences again.
   IF the call returns an error → STOP. Say: "Merge failed or timed out: <error text>. Do not call it again; run this playbook again to re-read <input:duplicateEntryId> first."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:duplicateEntryId>"} [A]
   IF the call returns an error or result.curationState != "consolidated" or result.status != "archived" → STOP. Say: "<input:duplicateEntryId> reads <result.curationState>/<result.status>, not consolidated/archived."
   VERIFY: CALL {{tool:get_operational_entry}} {"projectId":"<input:projectId>","entryId":"<input:primaryEntryId>"} [A]
   IF the call returns an error or result.duplicateEntryIds does not contain <input:duplicateEntryId> → STOP. Say: "<input:primaryEntryId> does not list <input:duplicateEntryId> as a duplicate."
   SAVE: newCount = result.occurrenceCount; priority = result.priority

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>: '<saved:pTitle>' (<input:primaryEntryId>)
Done: <<input:duplicateEntryId> merged into <input:primaryEntryId>: consolidated/archived; occurrenceCount <saved:pCount> → <saved:newCount>, priority <saved:priority> | nothing changed>
Evidence: <both entries read back after the merge | candidates only, not proof | none>
Pending: <none | activity <saved:task> stays linked to the archived duplicate>
Next: <the ASK or STOP text that ended the run | none>
```
curationState: new | under_review | classified | approved | rejected | deferred | consolidated; status: open | in_progress | resolved | archived. Never claim a check that a step above did not run and pass.
