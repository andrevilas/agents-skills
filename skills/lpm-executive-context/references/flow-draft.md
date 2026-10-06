# Playbook: draft
Use when: show a routing-policy or operating-model draft, nothing saved
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| draftType | "routing-policy" when the user names routing, priority rules or the curation SLA; "operating-model" when the user names the operating model, mandate, decision, escalation or release policy, or cadence | STOP. Say: "Which draft: routing policy or operating model?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Draft failed: <tool>: <error text>. Nothing was saved."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Drafts need an LPM API key; this connector cannot build them. Nothing was saved."
2. IF <input:draftType> == "operating-model" → go to step 4.
3. CALL {{tool:draft_workspace_routing_policy}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.draft is null → STOP. Say: "LPM cannot build a draft for <input:workspaceId>. Nothing was saved."
   SAVE: name = result.workspace.name; patch = result.draft.proposedPatch.patch as one-line JSON, copied verbatim; areas = result.draft.review.touchedAreas; rationale = result.draft.rationale; assumptions = result.draft.assumptions
   SAVE: closes = "missing-priority-policy:priority-rules, missing-routing-policy:routing-policy-summary, delivery: curation SLA"; notClosed = each id of result.draft.sourceGapIds that starts with "unowned-" ("none" if there is none); go to Answer.
   The draft never closes an unowned-domain or unowned-capability gap, even when sourceGapIds lists it: only a project routing profile closes it.
4. CALL {{tool:draft_workspace_operating_model}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.draft is null → STOP. Say: "LPM cannot build a draft for <input:workspaceId>. Nothing was saved."
   SAVE: name = result.workspace.name; patch = result.draft.proposedPatch.patch as one-line JSON, copied verbatim; areas = result.draft.review.touchedAreas; rationale = result.draft.rationale; assumptions = result.draft.assumptions
   SAVE: closes = "no gap id"; notClosed = each id of result.draft.sourceGapIds ("none" if empty)
   An operating-model draft never sets the mission and never assigns a role. An operatingModel value "workspace-first" is a derived default the draft copies: ask the owner for real text.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: workspace <saved:name> (<input:workspaceId>), <input:draftType> draft
Done: draft shown, nothing saved
Evidence: patch <saved:patch>; touchedAreas <saved:areas>; rationale <saved:rationale>; assumptions <saved:assumptions>
Pending: closes <saved:closes>; does not close <saved:notClosed>; these policies are descriptive text and do not change project routing profiles; saving it needs the workspace owner's order (playbook apply)
Next: <the STOP text that ended the run | owner: approve this exact patch, or edit it, before playbook apply saves it>
```
touchedAreas: mandate | governance | portfolio | delivery (step 3 or 4). Never claim the draft saved anything or closed a gap. Never claim a check that a step above did not run and pass.
