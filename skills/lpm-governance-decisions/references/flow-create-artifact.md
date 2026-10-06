# Playbook: create-artifact
Use when: create or link a decided artifact
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project?" |
| threadId | the user, or playbook record-decision | STOP. Say: "Which thread holds the decision?" |
| artifactId | an existing artifact to link: from skill lpm-roadmap, skill lpm-requirements-scope or an earlier run | "none" |
| artifactType | "roadmap-item", "roadmap-change-request", "change-set", "issue" or "requirement" | "none" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing more changed."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "This needs an LPM API key."
2. CALL {{tool:get_governance_thread_resolution_context}} {"projectId":"<input:projectId>","threadId":"<input:threadId>","messageLimitCount":100} [A]
   SAVE: workspaceId = result.project.workspaceId; status = result.thread.status; type, summary, actionTitle = those fields of result.decision.outcome (actionTitle "" if null)
   SAVE: issueTitle, issueText = title, description of result.drafts.issue.draft; reqBaseline = result.drafts.requirement.currentBaseline.id; reqTitle, reqText, reqType = title, description, type of result.drafts.requirement.draft
   IF <saved:status> is neither "resolved" nor "closed" → STOP. Say: "<input:threadId> is <saved:status>: record the decision first (playbook record-decision)."
   IF result.decision.outcome.actionTargetId is not empty → STOP. Say: "<input:threadId> is already linked to <result.decision.outcome.actionTargetId>."
   IF <input:artifactId> != "none" → SAVE: newId = <input:artifactId>; linkType = <input:artifactType>; created = "existing"; go to step 10.
   IF <saved:type> is neither "create-activity", "derive-requirement" nor "propose-change-set" → STOP. Say: "Outcome <saved:type>: nothing to create."
3. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: create and link the artifact of <input:threadId> (\"<saved:summary>\")? Linking is owner-only: the decider must order it."
   Get this order before creating: an unlinked artifact stays orphaned.
4. IF <saved:type> == "propose-change-set" → STOP. This belongs to skill {{skill:lpm-requirements-scope}}. Say: "Create the change set there (it checks the WHOLE working-scope delta), then link it here (artifactType change-set)."
   IF <saved:type> == "derive-requirement" and <saved:reqBaseline> is empty → STOP. This belongs to skill {{skill:lpm-requirements-scope}}. Say: "<input:projectId> has no current baseline."
   IF <saved:type> == "derive-requirement" → go to step 7.
5. CALL {{tool:list_issues}} {"projectId":"<input:projectId>","status":"todo","limitCount":100} [A]
   Always make this call: a prior run may have created it.
   IF an item has title == <saved:issueTitle> → ASK: "Activity <its id> has this title; link it instead? (yes/no)" — continue only if the user says yes; otherwise STOP.
   IF an item has title == <saved:issueTitle> → SAVE: newId = its id; linkType = "issue"; created = "existing"; go to step 10.
6. CALL {{tool:create_issue}} {"projectId":"<input:projectId>","title":"<saved:issueTitle>","description":"<saved:issueText>"} [A]
   IF the call returns an error → STOP. Say: "Not created: <error text>. Rerun; step 5 finds a created copy."
   SAVE: newId = the id in "Issue created with ID: <id>"; linkType = "issue"; created = "new"
   VERIFY: CALL {{tool:get_issue}} {"projectId":"<input:projectId>","issueId":"<saved:newId>"} [A]
   IF the call returns an error or result.title != <saved:issueTitle> → STOP. Say: "<saved:newId> cannot be read back; not linked."
   GO TO step 10
7. CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:reqBaseline>"} [A]
   Always make this call: a prior run may have created it.
   IF an item has title == <saved:reqTitle> → ASK: "Requirement <its id> has this title; link it instead? (yes/no)" — continue only if the user says yes; otherwise STOP.
   IF an item has title == <saved:reqTitle> → SAVE: newId = its id; linkType = "requirement"; created = "existing"; go to step 10.
8. ASK: "Create requirement \"<saved:reqTitle>\" (<saved:reqType>, pending) in current baseline <saved:reqBaseline>? It changes the working scope until a baseline is published. (yes/no)" — continue only if the user says yes; otherwise STOP.
9. CALL {{tool:create_requirement}} {"projectId":"<input:projectId>","baselineId":"<saved:reqBaseline>","title":"<saved:reqTitle>","description":"<saved:reqText>","type":"<saved:reqType>","status":"pending"} [C]
   IF the call returns an error → STOP. Say: "Not created: <error text>. Rerun; step 7 finds a created copy."
   SAVE: newId = the id in "Requirement created with ID: <id>"; linkType = "requirement"; created = "new"
   VERIFY: CALL {{tool:list_requirements}} {"projectId":"<input:projectId>","baselineId":"<saved:reqBaseline>"} [A]
   IF the call returns an error or no item has id == <saved:newId> → STOP. Say: "<saved:newId> is not listed; not linked."
10. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Link <saved:linkType> <saved:newId> to <input:threadId>? Only the decider can order it."
11. CALL {{tool:resolve_governance_thread_with_outcome}} {"projectId":"<input:projectId>","threadId":"<input:threadId>","outcomeType":"<saved:type>","summary":"<saved:summary>","actionTitle":"<saved:actionTitle>","status":"<saved:status>","actionTargetType":"<saved:linkType>","actionTargetId":"<saved:newId>"} [O]
   It replaces the whole outcome: resend type, summary, actionTitle, status from step 2.
   IF the call returns an error → STOP. Say: "<saved:newId> exists but is NOT linked: <error text>. Never create it again; rerun with artifactId <saved:newId>."
   VERIFY: CALL {{tool:get_governance_thread_resolution_context}} {"projectId":"<input:projectId>","threadId":"<input:threadId>","messageLimitCount":100} [A]
   IF the call returns an error or result.decision.outcome.actionTargetId != <saved:newId> or result.decision.outcome.type != <saved:type> → STOP. Say: "<input:threadId> does not show the link to <saved:newId>."
   SAVE: reasonCodes = result.policy.automationPolicy.reasonCodes

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId>/<input:projectId>/<input:threadId> <saved:type>
Done: <<saved:created> <saved:linkType> <saved:newId> linked | <saved:linkType> <saved:newId> created, NOT linked | nothing created>
Evidence: order "<the quoted order>"; actionTargetId <saved:newId>; reasonCodes <saved:reasonCodes> | none
Pending: <none | change set review (lpm-requirements-scope) | baseline publication (owner) for <saved:newId>>
Next: <the ASK or STOP text that ended the run | none>
```
reasonCodes after a link include artifact-created-from-reviewed-draft. Never claim a link that step 11's VERIFY did not show.
