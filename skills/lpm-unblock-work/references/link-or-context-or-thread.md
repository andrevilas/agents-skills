# Link, blocker context or governance thread
Load when: when choosing how to record a dependency
Applies to: lpm-unblock-work    Source: cards {{tool:create_issue_link}}, {{tool:create_workspace_issue_link}}, {{tool:create_portfolio_work_item_link}}, {{tool:update_portfolio_work_item_link}}, {{tool:set_project_issue_blocker_context}}, {{tool:prepare_governance_thread_from_blocker}}, {{tool:create_governance_thread}}; process rules (GOV-MAX v1)
## Summary
Another activity blocks it → a link (structural dependency).
An external cause blocks it (vendor, person, access, environment) → a blocker context (operational blocker).
A scope or business decision of the owner blocks it → blocker context + governance draft, handed to {{skill:lpm-governance-decisions}}.
No requirement or baseline behind the activity → comment on the activity: threads cannot target activities.
Pick the link tool by scope: same project, other project in the same workspace, other workspace.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| cause = another activity | structural dependency | link, P2; the block ends by itself when the upstream is `done` |
| cause = vendor, person, access, environment | operational blocker | {{tool:set_project_issue_blocker_context}} [A], P3; ends only with {{tool:resolve_project_issue_blocker_context}} [A] |
| cause = scope, priority or business choice | owner decision (GOV-MAX v1) | row 7 flow: context + {{tool:prepare_governance_thread_from_blocker}}; the thread is opened in {{skill:lpm-governance-decisions}} |
| `readyToCreate == false`, `blockingReasons` has `issue_has_no_governed_scope_target` | the activity has no `requirementId` / `baselineId` | {{tool:create_comment}} with the decision needed; no thread |
| `draft` fields | projectId, targetType, targetId, title, anchorKey, content (+ targetName, requirementId, baselineId) | pass only the first six to {{tool:create_governance_thread}}; anchorKey `issue:<issueId>:blocker` detects an existing thread |
| several external causes | one context per activity | write one context that lists every cause, separated by " \| " |

Scope table:
| Scope | Create [auth] | Dedupe / verify list | Remove or close [auth] | Types |
|---|---|---|---|---|
| same project | {{tool:create_issue_link}} [A] | {{tool:list_issue_links}}(projectId) | {{tool:delete_issue_link}} [C], project manage access, full/custom key | `blocks`, `is-blocked-by`, `duplicates`, `related-to` |
| other project, same workspace | {{tool:create_workspace_issue_link}} [A] | {{tool:list_workspace_issue_links}}(workspaceId, sourceProjectId) and (targetProjectId) | {{tool:delete_workspace_issue_link}} [C], workspace owner/admin, full/custom key | same four |
| other workspace | {{tool:create_portfolio_work_item_link}} [C], read access to both workspaces | {{tool:list_portfolio_work_item_links}}(workspaceId, projectId, status="active") | {{tool:update_portfolio_work_item_link}} [C] status `resolved` / `archived`, owner/admin in both workspaces | `blocks`, `depends_on`, `relates_to`, `enables_future_use`, `shared_capability` |

| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| server dedupe | none of the three create tools checks for duplicates | list first; a retry without a re-read creates a second link |
| server type check | issue-link `type` is not validated (any string is stored) | send exactly `blocks` |
| portfolio `type` | reads "source <type> target" | `blocks` with the upstream as source |
| portfolio create result | plain text "Portfolio work item link created with ID: <linkId>" | parse linkId from the text |
| portfolio `visibleSummary` | ≤240 chars, shown to people who cannot read the other workspace | never put confidential text in it |
| portfolio cycle check | rejects only a direct inverse `blocks`/`depends_on` link | longer cycles are not caught: read the graph |
| portfolio `rationale` on update | the key replaces the stored text; empty clears it | omit it to keep the old one |
| portfolio status `active` | reopens; clears `resolvedAt`/`archivedAt`; no cycle check | confirm first |
| issue-link and workspace-link delete | hard delete, no undo | recreating gives a new id |

## Rules
1. Always write `type="blocks"` with the activity that must finish first as the source.
2. Same project → {{tool:create_issue_link}}; other project → {{tool:create_workspace_issue_link}}; other workspace → {{tool:create_portfolio_work_item_link}} after a "yes".
3. Before any create, list with the scope's list tool and stop when the same pair exists.
4. Before {{tool:set_project_issue_blocker_context}}, read {{tool:get_issue}} → `blockerContext`: a set replaces an active context.
5. A cross-workspace dependency also gets a blocker context naming the portfolio link id.
6. Never set the activity status to `blocked`; never move activities to hide a scope problem.
7. A scope decision is never applied here: draft it and hand it to {{skill:lpm-governance-decisions}}.

## Examples
```text
example: "API task abc123 can only start after schema task def456" (same project)
→ list_issue_links(projectId) → no pair → create_issue_link(projectId, sourceIssueId="def456", targetIssueId="abc123", type="blocks").

example: "Waiting for the client's VPN access" → set_project_issue_blocker_context(projectId, "abc123",
blockerContext="Client VPN access missing — client IT — since 2026-10-01").

example: "We cannot build it until the owner decides between offline mode and online-only"
→ P3 context "Waiting for an owner decision: offline mode or online-only" → prepare_governance_thread_from_blocker
→ readyToCreate true → comment "Decision requested: ..." → lpm-governance-decisions with the draft.
```
