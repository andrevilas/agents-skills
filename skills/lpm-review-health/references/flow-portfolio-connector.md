# Flow: portfolio review (P3) and connector fallback (P4)
Load when: decision rows 2, 3, 8, 10 or 11 of SKILL.md (a portfolio or weekly review, "what needs my attention", or one project on a ChatGPT/Claude connector or after -32003 in P1/P2)
Applies to: lpm-review-health    Source: lpm `server.ts` (`getWorkspaceReadModelCommand`, `getWorkspaceOwnerSurfaceCommand`, `getProjectOwnerSurfaceCommand`, `getWorkspaceOwnerContextBundleCommand`), `src/lib/projectOwnerReadModel.ts` (`delivery.healthStatus`, risks), `src/server/mcpResponseLimit.ts`, `src/server/oauthToolPolicy.ts`

## Preconditions
1. Connector = {{tool:get_project_analytics}} is absent from the tool list. On a connector these tools are OAuth reads: {{tool:get_workspace_read_model}} (workspace:read), {{tool:get_project_owner_surface}}, {{tool:get_project_read_model}}, {{tool:list_project_resolution_risks}}, {{tool:list_workspace_projects}} (portfolio:read).
2. The owner bundle ({{tool:get_workspace_owner_context_bundle}}) has no health or attention fields: never rank projects with it.
3. Came from -32003 in P1/P2: do not stop (SKILL.md §2 item 2); keep the `howToEnable` text for Pending.

## Steps
### P3 Portfolio — rows 8, 10, 11
1. API key: {{tool:get_workspace_owner_surface}}(workspaceId); connector: {{tool:get_workspace_read_model}}(workspaceId) → `ownerView`. RESPONSE_TOO_LARGE → {{tool:list_workspace_projects}}(workspaceId); more than 5 → ask the user to pick at most 5; then per project SKILL.md P1 step 2 (API key; "ranking source: per-project analytics") or P4 (connector).
2. Candidates = the top 3 of `ownerView.projects[]` by `attentionScore` plus every project whose `healthStatus` is `critical` ("source: workspace read model"). Up to 5 → review each (P1 + P2; connector P4). More than 5 → ask "All <n> (slower) or the top 5?".
3. Decisions: API key {{tool:get_workspace_decision_inbox}}(workspaceId, requiresActionOnly=true); connector `ownerView.decisions`.
4. Verify: counts equal `ownerView.portfolio` (per-project fallback: write "no portfolio totals").
### P4 Connector fallback — rows 2, 3, 10
1. {{tool:get_project_owner_surface}}(projectId) → status = `ownerView.delivery.healthStatus` (the analytics status, integrity included), `.decisions`. No governance role → {{tool:get_project_read_model}}(projectId) → `ownerView.delivery`. RESPONSE_TOO_LARGE → status "not read"; write "integrity derivation not possible on a connector".
2. {{tool:list_project_resolution_risks}}(projectId) → `risks[]` (`id`, `severity`, `entityCount`, `requiresHumanReview`). Denied → step 1 `ownerView.risks[]` (`id`, `severity`, `title` only; `entityCount` "not read").
3. Do not derive integrity signals yourself: the status already includes them. A finding you infer (e.g. a cycle past its end date) goes under Interpretation as "derived by agent" and never changes the status.
4. Pending: "integrity breakdown and risk drill-down need an LPM API key" (+ the `howToEnable` text when you came from -32003).
5. Verify: the reported status equals step 1 `ownerView.delivery.healthStatus` exactly.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| more than 5 candidates | "All <n> (slower) or the top 5?" |
| RESPONSE_TOO_LARGE and more than 5 projects | "Which projects (at most 5) should I review?" |
| a P4 step 1 tool is missing too | core rule 2 |
