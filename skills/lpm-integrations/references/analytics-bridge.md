# Analytics bridge (Firestore → Cloud Storage → BigQuery)
Load when: bridge work
Applies to: lpm-integrations    Source: lpm `server.ts` bridge commands (:2277-2380, :4226-4811), `src/lib/analyticsBigQueryBridge.ts`, `src/lib/analyticsBigQueryLoadJob.ts`, `docs/analytics-bigquery-load-runbook.md`; cards {{tool:create_analytics_bridge_run}}, {{tool:process_analytics_bridge_run}}, {{tool:get_analytics_bridge_observability}}, {{tool:list_analytics_bridge_runs}}
## Summary
A run copies LPM records to NDJSON files in Cloud Storage and, when `runtime.bigQueryLoadEnabled == true`, appends them to BigQuery.
Nothing processes a queued run automatically: call {{tool:process_analytics_bridge_run}} yourself, once, after a yes.
Creating a run at once resets the watermarks of each selected entity (`cursorValue`, `lastSuccessfulRunId`, `lastSuccessfulAt` → null), even if the run is never processed, so every run re-exports the full history of its entities (`incremental` costs the same as `backfill` today) and BigQuery gets duplicate rows.
The cost levers are scope (project before workspace) and the entity set. Wide runs spend money: owner decision.
A `failed` or stuck `running` run cannot be retried or cancelled: a recovery is a new run. The bridge does not feed LPM's own dashboards.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| entity `audit_events` | table `audit_events_raw`, cursor `createdAt` | reads the WHOLE global audit collection every run, with or without BigQuery: always wide |
| entity `issues` | table `issues_snapshot`, cursor `updatedAt` | — |
| entity `requirements` | table `requirements_snapshot`, cursor `updatedAt` | — |
| entity `projects` | table `projects_snapshot`, cursor `updatedAt` | — |
| entity `delivery_health_daily` | table `delivery_health_daily`, cursor `metricDate` | processing also merges these Firestore rows (`sourceRunId`) |
| entity `team_delivery_health_daily` | table `team_delivery_health_daily`, cursor `metricDate` | same as above |
| `entityTypes` omitted, empty or unknown | normalized to all six entities (also when a stored run is listed or processed) | never omit it; send exact names; check the create result |
| `mode` | `incremental` (default) or `backfill`; there is no "reset" mode | use `incremental` unless the user asks backfill |
| `resetEntities` | subset of `entityTypes`; the create result shows all six even when none were sent | normalization artifact, not an error; omit it |
| run `status` | `queued`, `running`, `completed`, `failed`, `canceled` (no tool sets `canceled`) | process acts only on `queued`; other statuses return unchanged |
| process call | synchronous; can pass connector timeouts (~60 s) | after a timeout read {{tool:list_analytics_bridge_runs}}, never create again |
| partial outcome | a run ends `failed` when any load job fails; watermarks still advance for entities `loaded` or `skipped` | report per entity, not per run |
| `loadJobs[entity].status` | `loaded`, `skipped` ("BigQuery load jobs are disabled in this runtime."), `failed` | `skipped` = files only, nothing in BigQuery |
| `exportedRows == 0` with expected changes | runbook alert | report it as a failure signal |
| watermark key | per exact scope (workspace scope and project scope are separate) | verify in the scope the run used |
| {{tool:list_analytics_bridge_runs}}(workspaceId) | also returns project runs of that workspace (they carry its `workspaceId`) | a listed run's scope is its own `workspaceId` + `projectId`, not the filter |
| `watermarks[].lastSuccessfulAt == null` | never synced in this scope, or a run was created and never processed | not a health verdict by itself |
| visibility | lists and observability `stats`/`recentRuns` show only the caller's runs (max 20 / 15) | empty ≠ no runs; never process another user's run (MCP does not check ownership) |
| observability `runtime` | `datasetId`, `bucketName`, `bigQueryProjectId`, `bigQueryLoadEnabled` | infrastructure names: never share outside the team |
| BigQuery switch | deploy-time setting | no tool enables it; owner/deploy decision |
| product analytics | {{tool:get_project_analytics}} computes delivery health live | stale dashboards are not a bridge problem |
| no tool | cancel or retry a run, see other users' runs, query BigQuery, read the NDJSON files | say so; do not hunt for one |
| access | reads `portfolio:read` (connector ok); create and process need a `full`/`custom` key | missing tool → core rule 2 |

## Rules
1. Read observability and the run list before creating a run. Process an existing `queued` run instead of creating one only when its scope (`workspaceId` + `projectId`) and its returned `entityTypes` equal the request; else report it (no cancel tool exists) and ask.
2. Choose the smallest scope and the fewest entities that answer the user's need.
3. A run is wide when any of: (a) `audit_events` is in `entityTypes`, with or without BigQuery; (b) `entityTypes` omitted or all six; (c) workspace scope with `bigQueryLoadEnabled == true`. Wide → decision request with cost and duplicate rows. Never omit `entityTypes`.
4. Never promise incremental savings: every run re-exports its entities in full.
5. Do not process a run whose returned `entityTypes` differ from the request.
6. Call process once per run; never loop or auto-create a new run after `failed`.
7. Claim success only when `completed`, every entity `loaded` (or `skipped` with loading off) and the watermark names this run.

## Examples
```text
example: create_analytics_bridge_run(projectId="<projectId>", entityTypes=["issues"], mode="incremental", requestedReason="refresh warehouse issues")
→ {id: "<runId>", status: "queued", entityTypes: ["issues"]}
process_analytics_bridge_run(runId="<runId>") → {status: "completed", exportedRows: 120, loadJobs: {issues: {status: "loaded"}}}
get_analytics_bridge_observability(projectId="<projectId>") → watermarks[issues].lastSuccessfulRunId == "<runId>" → pass.
```
