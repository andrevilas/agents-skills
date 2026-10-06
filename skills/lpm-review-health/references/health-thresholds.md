# Health thresholds and payloads
Load when: background for maintainers: how LPM computes each health status (the playbooks already hold every rule they need)
Applies to: lpm-review-health    Source: lpm `src/lib/deliveryHealthAnalytics.ts` (`getHealthStatus`, integrity status), `src/lib/projectOwnerReadModel.ts` (`delivery.healthStatus`, risks), `src/lib/projectResolution.ts` (`getRiskEntityCount`), `src/lib/workspaceOwnerReadModel.ts` (portfolio rule, `attentionScore` sort), `server.ts` (`getWorkspaceReadModelCommand`, `getProjectOwnerSurfaceCommand`, `listProjectResolutionRisksCommand`, `repairOrphanRequirementsForProject`), `src/server/mcpResponseLimit.ts`

## Summary
- The server computes the status; agents copy it and name the tool.
- Project rule (`get_project_analytics` `metrics.healthStatus`): critical if integrity is critical, `blockedIssuesOpen >= 5` or `avgLeadTimeDays >= 14`; watch if integrity is watch, `blockedIssuesOpen > 0`, `avgLeadTimeDays >= 7` or `avgCycleTimeDays >= 5`; else healthy.
- Integrity (`metrics.integrity.status`): critical when `invalidIssueStatuses + orphanAishJobs + orphanAutopilotIssues + terminalIssueJobMismatches >= 5`; watch when any signal fires. So `healthStatus == "healthy"` with signals cannot happen today; playbook project still reports it as an LPM defect if it does.
- Workspace rule (`ownerView.projects[].healthStatus` of the workspace read model and owner surface): critical if any open blocked issue or `avgBlockedTimeDays > 5`; watch if any open work; integrity ignored. `ownerView.portfolio.healthStatus`: critical if any project is critical or any issue is blocked; watch if any project is watch or any issue is overdue.

## Facts
| Field / behavior | Meaning | Where the playbooks use it |
|---|---|---|
| `metrics.completionRate` | percent 0–100 in analytics; ratio 0–1 in every `ownerView` | project step 6; portfolio step 8 (× 100) |
| `projects[0].blockedIssues[]` (analytics) | up to 200 `{issueId, title, status, blockedSince, blockedBy[], reason}`; no governance role needed | project step 6 (replaces `list_blocked_project_issues`, which needs a role) |
| blocked state | analytics, owner surface and `list_blocked_project_issues` count intra-project links and blocker contexts only; `get_project_dependency_summary` also counts workspace (cross-project) links | project step 8 |
| `cycleId` on `get_project_analytics` | declared, ignored | project step 6 |
| burndown, status distribution, velocity, trend | not returned by any MCP tool | project Answer |
| archived project | analytics throws "You do not have access to this project"; read models exclude it | project step 6 |
| caches | analytics ~10 s; project read model ~4 s; workspace read model ~5 s per user | router §7 |
| API-key side effect | `get_project_read_model`, `get_project_owner_surface`, `list_project_resolution_risks`, `get_project_resolution_context`, `list_project_resolution_entities`, `get_project_resolution_action_catalog`, `get_project_execution_context`, `get_project_decision_inbox` re-point orphan requirements to the current baseline before the role check (also when they deny). OAuth skips it. `get_project_scope_resolution_context` does not | project steps 5 and 9; connector step 2 |
| owner-surface quota | `get_project_owner_surface` and `list_project_resolution_risks` run the owner surface, which may spend the daily document-search quota | project step 9 calls only the risks tool |
| `governance:decision-needed` `entityCount` | `ownerView.decisions.actionRequiredCount` | project step 9 |
| missing governance roles | not a resolution risk; only `ownerView.governance` (project) or `projectsMissing*` (workspace) | connector step 5; portfolio step 8 |
| role gate | owner surface, risks and resolution tools need project-owner, product-owner or delivery-lead (or the project ownerId); `get_project_read_model` returns `ownerView` to any reader (LPM access inconsistency) | connector step 6 reads only delivery, decisions and risks |
| RESPONSE_TOO_LARGE | a non-paged result over 1,000,000 bytes returns nothing | portfolio step 7; connector steps 5–6 |
| `ownerView.finance` | reporting rollups in every owner surface and read model; never a budget authorization (owner-only financial tools) | left out of every Answer |
| owner bundle | no health or attention fields; `version` ignores decisions; `executive.mandate`/`readiness` always null | changes steps 4–5 |
