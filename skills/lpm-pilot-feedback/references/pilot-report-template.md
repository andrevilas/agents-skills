# Template: pilot report to the owner
Use in: SKILL.md §8 (after the last item); one report per run, sent to the owner only. The first 5 lines are the §8 header, word for word.
```text
Scope: pilot run <UTC start> to <UTC end>; <n> new items, <k> already processed; state <path>, <m> appended
Done: <item ref> → <class> → <issueId | commentId | none> (one line per item)
Evidence: <log line (time) | code path:line@<sha> | attachment id>
Pending: <none | unverified, owner decisions — who acts>
Next: <one sentence, who acts: "Owner: fix <issueId> via lpm-deliver-activity" | "Re-check <item ref> next run">

Items (always; one line each, in message order):
- [<class>] <message time> <item ref> "<symptom, at most 80 chars>" → <outcome>
  Sources: <log query + matched line time | code path:line@<sha> | LPM record id>

Registered (one line per issue or comment):
- <issueId> <title> (new | comment <commentId> on duplicate | regression of <issueId>)
  Regression: <golden-set fixture via lpm-release-product (Advisor) | vitest case in the fix's change (other)>

Connection / authorization procedures for the reporter (the owner relays them):
- <item ref>: <remove the connector, reinstall it, tick "<box>" | other exact steps>

Explanations (data / expected behaviour):
- <item ref>: <one-sentence cause with its source>

Owner decisions and questions:
- <item ref>: <decision request: context, options, recommendation, consequences>
- <item ref>: <question, e.g. "Which managed project receives <symptom>?" | "Which tool, error or screen is it?">

Unverified (re-checked on the next run; write "none" when empty — never omit):
- <item ref>: <what is missing to confirm or reject it>

Draft reply requested by the owner (not sent):
<draft text; the owner decides whether and when to send it>

Draft pilot notice (send only after the fix is promoted and smoke-tested):
correction: <what changed> → reproducible test: <steps> → registered evidence: <ids>
→ result: <approved | specific pending item> → next step: <what the pilot retests>
```
## Fill rules
1. Every item handed over in this run appears exactly once, with one class value of the state file.
2. Every id, time and count comes from a tool result, a log line or the state file of this run.
3. Never paste tokens, keys, grant ids, or personal data beyond what the report already holds.
4. Never send this report or the draft notice to the pilot or the pilot's group; the owner decides.
5. Omit an empty section; keep "Items" and "Unverified" even when empty ("none").
6. The draft notice is only for items whose fix is already live; otherwise write "no notice yet".
7. Add "Draft reply requested by the owner" only when the owner asked for a reply in this run; never send it.
8. Sources name the code revision you read (`path:line@<revision or sha>`); "main differs from revision <revision>" when it does. Not read → `@revision-unknown` (keep the `@` part) and list it under Pending.
9. `Regression:` goes under every product-defect line of Registered (new or comment on duplicate), never under a managed-workspace demand. Add no other sub-line (no "Defect:", no "Status:").
10. Output only the header and these sections: no other headings, no state-file JSON, no claim of steps you did not run.
