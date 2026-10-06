# Playbook: claim-unowned
Use when: a project claims an unowned domain or capability, or a project routing profile is misaligned
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user | STOP. Say: "Which LPM workspace? (id or name)" |
| gapId | the gap id the user named: unowned-domain:<text>, unowned-capability:<text> or inconsistent-project-alignment:<projectId>:<kind> | step 3 |
| project | the project name, key or id the owner chose to own it | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Changing a project routing profile needs an LPM API key; this connector cannot. Nothing was changed."
2. CALL {{tool:generate_workspace_readiness_report}} {"workspaceId":"<input:workspaceId>"} [A]
   IF result.report is null → STOP. Say: "LPM cannot build the executive context of <input:workspaceId>. Nothing was changed."
   SAVE: name = result.workspace.name; beforeStatus = result.report.status; beforeScore = result.report.score
3. CALL {{tool:list_unowned_domains_or_capabilities}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: gaps = every id in result.unownedDomains, result.unownedCapabilities and result.alignmentIssues
   IF <input:gapId> is empty → STOP. Say: "Which gap? Open: <saved:gaps>."
   IF <saved:gaps> does not contain <input:gapId> → STOP. Say: "<input:gapId> is not open. Nothing was changed."
   IF <input:gapId> starts with "inconsistent-project-alignment:" and ends with ":workspace" → STOP. This belongs to skill {{skill:lpm-workspace-admin}}. Say: "That project points at another workspace; moving it is the owner's decision."
   IF <input:gapId> starts with "inconsistent-project-alignment:" → SAVE: target = the projectId between the two colons; value = "none"; list = "none"; go to step 5.
   SAVE: value = the text after the first colon of <input:gapId>; list = "domains" if <input:gapId> starts with "unowned-domain:", else "ownedCapabilities"
4. CALL {{tool:list_workspace_projects}} {"workspaceId":"<input:workspaceId>"} [A]
   IF <input:project> == "none" → STOP. Say: "Which project owns <saved:value>? Projects: <name (id) of each item>."
   SAVE: target = id of the one item whose id, name or key equals <input:project>
   IF 0 or 2+ items match → STOP. Say: "Which project owns <saved:value>? Projects: <name (id) of each matching item>."
   Never offer to remove <saved:value> from the executive context to clear the gap; that is the owner's order through playbook prepare-change.
5. CALL {{tool:get_project}} {"projectId":"<saved:target>"} [A]
   SAVE: projectName = result.name; domains, ownedCapabilities, ownedComponents, ownedSystems, aliases, intakeKeywords, excludedKeywords, escalationRules, maintainedBy = those lists of result.routingProfile, each copied exactly ([] if absent)
   IF result.archived is true → STOP. Say: "<saved:projectName> is archived; archived projects own nothing."
   IF result.access.canManage != true → STOP. Say: "Only a manager of <saved:projectName> can change its routing profile. Nothing was changed."
   IF <saved:list> == "domains" → SAVE: domains = <saved:domains> plus <saved:value>; go to step 6.
   IF <saved:list> == "ownedCapabilities" → SAVE: ownedCapabilities = <saved:ownedCapabilities> plus <saved:value>; go to step 6.
   The call replaces the whole profile: keep every list and item you saved.
6. ASK: "Set the routing profile of <saved:projectName> (<saved:target>) (domains <saved:domains>, ownedCapabilities <saved:ownedCapabilities>), so it owns <saved:value>? Intake routing follows this profile. (yes/no)" — continue only if the user says yes; otherwise STOP.
7. CALL {{tool:update_project}} {"projectId":"<saved:target>","routingProfile":{"domains":"<saved:domains>","ownedCapabilities":"<saved:ownedCapabilities>","ownedComponents":"<saved:ownedComponents>","ownedSystems":"<saved:ownedSystems>","aliases":"<saved:aliases>","intakeKeywords":"<saved:intakeKeywords>","excludedKeywords":"<saved:excludedKeywords>","escalationRules":"<saved:escalationRules>","maintainedBy":"<saved:maintainedBy>"}} [C] (each value is a JSON array of strings; send no other field)
   Wait 6 seconds (LPM caches reads for about 5 s).
   VERIFY: CALL {{tool:get_project}} {"projectId":"<saved:target>"} [A]
   IF the call returns an error or (<saved:value> != "none" and result.routingProfile.<saved:list> does not contain <saved:value>) → STOP. Say: "<saved:projectName> does not list <saved:value> after the update."
   VERIFY: CALL {{tool:generate_workspace_readiness_report}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or result.report lists <input:gapId> → STOP. Say: "<input:gapId> is still open after the update."
   SAVE: afterStatus = result.report.status; afterScore = result.report.score

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: workspace <saved:name> (<input:workspaceId>), project <saved:projectName> (<saved:target>)
Done: <routingProfile of <saved:target> now owns <saved:value> | routingProfile of <saved:target> re-saved | nothing changed>
Evidence: <readiness <saved:beforeStatus> → <saved:afterStatus>, score <saved:beforeScore> → <saved:afterScore>; closed <input:gapId> | readiness <saved:beforeStatus>, score <saved:beforeScore>>
Pending: <none | <input:gapId> — owner picks the project>
Next: <the ASK or STOP text that ended the run | none>
```
status: complete | partial | blocked, from generate_workspace_readiness_report (steps 2 and 7). These are executive-context strings, not roadmap capability records. Never claim a gap is closed unless both VERIFY reads of step 7 passed.
