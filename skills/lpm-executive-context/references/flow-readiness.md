# Playbook: readiness
Use when: readiness review, "what is missing", gap ids or missing executive roles, with no change
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Readiness check incomplete: <tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:generate_workspace_readiness_report}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.report is null → STOP. Say: "LPM cannot build the executive context of <input:workspaceId>. Nothing was changed."
   SAVE: name = result.workspace.name; status = result.report.status; score = result.report.score; ids = every id in result.report.blockers, then every id in result.report.warnings, copied exactly
2. CALL {{tool:validate_workspace_context_completeness}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.validation is null → STOP. Say: "LPM cannot validate the executive context of <input:workspaceId>. Nothing was changed."
   SAVE: completeness = result.validation.status; gapless = "<field>: <message>" of each item of result.validation.issues whose field is "delivery" or "governance"
   Never use result.validation.score: it is not the readiness score.
3. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → SAVE: gapList = "not read (needs an LPM API key)"; go to step 5.
4. CALL {{tool:list_workspace_context_gaps}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: gapList = "read"; ids = <saved:ids> plus each id of result.items that is not in it yet
5. SAVE: pending = one line "<id> → <fix> — <who decides>" for each id in <saved:ids> and each line of <saved:gapless>, from this list (first prefix that matches):
     missing-governance-role: → assign the role (playbook apply) — owner names the holder
     governance: → assign an executive role (playbook apply) — owner names the holder
     missing-mandate:mission → set the mission (playbook apply), or the workspace description (playbook set-description) — owner
     missing-priority-policy: or missing-routing-policy: or delivery: → routing-policy draft (playbook draft), then playbook apply — owner approves
     missing-financial-context: → financial.currency (playbook apply) — owner only, in the owner's own words
     unowned-domain: or unowned-capability: → a project claims it (playbook claim-unowned) — owner picks the project
     inconsistent-project-alignment:<projectId>:routing-profile → re-save that project's routing profile (playbook claim-unowned) — owner
     inconsistent-project-alignment:<projectId>:workspace → move the project (skill lpm-workspace-admin) — owner
   Copy each id exactly; never use a gap title, a gapType or result.report.nextActions as the item.
   Never offer to remove a domain or capability from the context to clear a gap.
   SAVE: next = the question for the first line of <saved:pending>: "Who should hold <role>?", "Which project owns <name>?" or "Approve a routing-policy draft?"; "none" when <saved:pending> is empty

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: workspace <saved:name> (<input:workspaceId>)
Done: review only, nothing changed
Evidence: readiness <saved:status> (completeness <saved:completeness>), score <saved:score>; gap list <saved:gapList>; closed gap ids none
Pending: <each <saved:pending> line, separated by "; " | none>
Next: <the STOP text that ended the run | owner: <saved:next> | none>
```
status and completeness: complete | partial | blocked (steps 1 and 2). score is result.report.score from step 1; a review has no "before → after". 4 missing executive roles on a new workspace are a setup gap, not a delivery problem. Never claim a check that a step above did not run and pass.
