# Playbook: portfolio
Use when: portfolio or workspace review, "what needs my attention", or a weekly review of a whole workspace
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user or this session | "none" (step 3) |
| workspaceName | the workspace name the user gave | "none" |
| connector | "yes" when get_project_analytics is not in your tool list (ChatGPT/Claude connector) | "no" |
| fix | a change asked in the same message (cancel, close, assign), unless that question was already answered | "none" |
| fixSkill | dates, owners, cycles: lpm-plan-work; blockers: lpm-unblock-work; requirements: lpm-requirements-scope; AISH jobs: lpm-aish-delivery; decisions: lpm-governance-decisions | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "Review incomplete: <tool> failed: <error text>."
1. IF <input:fix> is not "none" → ASK: "This review changes nothing; <input:fix> is done with skill <input:fixSkill>. Finish the report first? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Use skill <input:fixSkill> for that. Nothing was changed."
2. IF <input:workspaceId> is not "none" → SAVE: workspaceId = <input:workspaceId>; go to step 4.
3. CALL {{tool:list_workspaces}} {} [A]
   SAVE: workspaceId = id of the only item, else of the one item whose name equals <input:workspaceName>, ignoring case (empty if none)
   IF <saved:workspaceId> is empty → STOP. Say: "Which workspace: <names of result>?"
4. IF <input:connector> == "yes" → go to step 6.
5. CALL {{tool:get_workspace_owner_surface}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error containing "RESPONSE_TOO_LARGE" → go to step 7.
   SAVE: view = result.ownerView; source = "get_workspace_owner_surface"; go to step 8.
6. CALL {{tool:get_workspace_read_model}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error containing "RESPONSE_TOO_LARGE" → go to step 7.
   SAVE: view = result.ownerView; source = "get_workspace_read_model"; go to step 8.
7. CALL {{tool:list_workspace_projects}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF result is empty → STOP. Say: "Workspace <saved:workspaceId> has no active project."
   IF result is not empty → STOP. Say: "The workspace is too large for one read. Which projects (at most 5) should I review? <names of result>"
8. SAVE: cands = "<projectName> (<projectId>) <healthStatus> attention <attentionScore>" for the first 3 items of <saved:view>.projects (already sorted by attentionScore) plus each later item with healthStatus "critical", at most 5; rest = names of the later "critical" items beyond those 5, or "none"; portfolio = healthStatus, blockedIssuesOpen, overdueIssues, completionRate × 100 (%), throughput30d, projectsWithoutCurrentBaseline of <saved:view>.portfolio; decisions = <saved:view>.decisions.pendingCount; roles = projectsMissingProjectOwner, projectsMissingProductOwner, projectsMissingDeliveryLead of <saved:view>.governance
   These statuses use the workspace rule (critical = any open blocked issue or avgBlockedTimeDays > 5; watch = any open work; integrity ignored): label them "source: workspace read model", never mix them with a project review.
9. IF <input:connector> == "yes" → go to step 11.
10. CALL {{tool:get_workspace_decision_inbox}} {"workspaceId":"<saved:workspaceId>","requiresActionOnly":true} [A]
   IF the call returns an error → go to step 11.
   SAVE: decisions = result.summary.actionRequiredCount
11. SAVE: pending = a line per row below that fired, in order, + " — <who decides>" (the row's, else delivery lead or project owner), then "<input:fix> → <input:fixSkill>: it confirms each change" if fix is not "none", then "<saved:rest> not reviewed" if rest is not "none"; next = skill and action of the fix line, else "playbook project (risks yes) for the first project of <saved:cands>, then the others one by one"
   ```text
   portfolio blockedIssuesOpen > 0 → lpm-unblock-work
   portfolio overdueIssues > 0 → lpm-plan-work
   projectsWithoutCurrentBaseline > 0 → lpm-requirements-scope — the owner
   decisions > 0 → lpm-governance-decisions — the owner
   any roles count > 0 → lpm-workspace-admin — the owner
   ```

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId> / all non-archived projects / top <the number of cands> by attention
Done: read-only review; portfolio status <the healthStatus in <saved:portfolio>> (source: <saved:source>, workspace read model rule) | nothing reviewed
Evidence: <portfolio <saved:portfolio>; candidates <saved:cands>; decisions <saved:decisions>; missing roles <saved:roles> | not read>
Pending: <the lines of <saved:pending> joined by " | " | none>
Next: <the ASK or STOP text that ended the run | <saved:next>>
```
status: healthy | watch | critical, from step 5 or 6. A portfolio status is not a project status; a project review needs playbook project. The owner bundle (get_workspace_owner_context_bundle) has no health or attention fields: never rank with it. No finance unless asked, then "owner-level reporting rollups, not a budget authorization". Never offer to cancel, delete or clean up. Never claim a number or id that a step above did not read.
