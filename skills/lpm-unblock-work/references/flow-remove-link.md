# Flow: remove or close a link
Load when: decision row 10 of SKILL.md (link wrong, dangling, or cross-workspace blocker done)

## Preconditions
1. Same project: project manage rights. Other project: workspace owner/admin. Both deletes need a full/custom API key.
2. Other workspace: links are never deleted, only closed by status; owner/admin in both workspaces.
3. Scope table (create, list, remove tools per scope): {{ref:link-or-context-or-thread}}.

## Steps
1. `linkId` from {{tool:list_issue_links}}(projectId), {{tool:list_workspace_issue_links}}(workspaceId, sourceProjectId|targetProjectId=projectId) or {{tool:list_portfolio_work_item_links}}(workspaceId, projectId) → keep `id`, source, target. Titles: {{tool:list_issues}}(<that side's projectId>, limitCount=100; cursor=`nextCursor` until null) → `items[].title` of the source and target ids (other workspace: `visibleSummary`; dangling id: "not found"). 0 or 2+ → ask (Stop and ask).
2. [C] Ask the confirmation below (Stop and ask); only "yes" continues.
3. {{tool:delete_issue_link}}(projectId, linkId) [C] or {{tool:delete_workspace_issue_link}}(linkId) [C]; "not found" = gone.
4. Cross-workspace: {{tool:get_issue}}(upstreamProjectId, U) → keep `status`.
5. {{tool:update_portfolio_work_item_link}}(linkId, workspaceId, status="resolved" when step 4 is `done`, else "archived") [C].
6. Cross-workspace: {{tool:get_issue}}(projectId, X) → `blockerContext.status == "active"` and `content` names the linkId → {{tool:resolve_project_issue_blocker_context}}(projectId, X, resolution="Portfolio link <linkId> <status>") [A]. The text also lists other causes → after the resolve run SKILL.md P3 step 3 with the remaining causes only.
7. Verify: step 1 list → `id` gone or `status` set; after step 6 {{tool:get_issue}} → `resolved` and {{tool:list_blocked_project_issues}}(projectId) → X gone (or listed for another cause).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| 0 or 2+ links match | "Which link?" then each candidate as `<linkId>: <source id> "<title>" → <target id> "<title>"`, one per line (titles from step 1) |
| before step 3 or 5 | "Remove/close link <linkId> (<source id> "<title>" → <target id> "<title>")? No undo." plus the exact call, e.g. {{tool:delete_issue_link}}(projectId=<projectId>, linkId=<linkId>) or {{tool:update_portfolio_work_item_link}}(linkId=<linkId>, workspaceId=<workspaceId>, status="resolved"), in the user's language |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:delete_issue_link}} | {{tool:list_issue_links}}(projectId) | `id` absent |
| {{tool:delete_workspace_issue_link}} | {{tool:list_workspace_issue_links}}(workspaceId, sourceProjectId or targetProjectId=projectId) | `id` absent |
| {{tool:update_portfolio_work_item_link}} | {{tool:list_portfolio_work_item_links}}(workspaceId, projectId) | `status` == the value sent |
| {{tool:resolve_project_issue_blocker_context}} (step 6) | {{tool:get_issue}}(projectId, X) | `blockerContext.status == "resolved"` |

## Report fields
Scope, linkId, source → target, deleted or new `status`, resolved blocker context (step 6), the list call that proved it, Pending, Next.
