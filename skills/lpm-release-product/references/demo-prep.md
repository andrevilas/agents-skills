# Live demo preparation
Load when: a live LPM demo (row 11)
Applies to: lpm-release-product    Source: owner's demo rules; `advisor-semantics` (24 h scan staleness)
## Summary
- Present from the demo account; the repository scan must be younger than 24 h; the demo change request must still await review.
- Recount every figure from a source read in this run; run only the `demo-` golden subset.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| demo account | a login the owner created, with access to the demo workspace only | never sign in as the owner to present |
| demo workspace, repository link, change request | named by the owner | not named → ask |
| scan age | the repository link's last scan time | > 24 h → re-scan through {{skill:lpm-code-index}} |
| CR status `awaiting-review` | the script shows the review step live | any other status → STOP, tell the owner; a new CR is the owner's decision |
| solo review | allowed only when the demo workspace has exactly one member | adding a member to the demo workspace changes the script |
| claimed figures | numbers in the script (executions, costs) | no source in this run → remove or mark "to confirm" |
| `demo-` golden ids | questions that run in the demo workspace | run them on the released revision; never the `xpory-` ids |

## Rules
1. Run the checks the day of the demo, after the last deploy of the day.
2. Never change the demo workspace's budget, model or members; those are the owner's decisions.
3. Never present production data from other workspaces.
4. Report each check as pass / fail with its source; one failure → tell the owner before the demo.

## Examples
```text
example: demo check — scan 3 h old (pass); CR awaiting-review (pass); demo account signed in (pass);
"48 executions" has no source in this run (fail: remove or confirm with the owner)
```
