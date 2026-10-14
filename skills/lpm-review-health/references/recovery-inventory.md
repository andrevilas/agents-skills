# Recovery compatibility inventory (read-only)

Use `get_project_agent_recovery_inventory` with an existing API-key connection and project **manage** access. An API-key read-only profile permits the tool but does not grant project management. OAuth is not enabled for this tool. Do not mint/reuse a human token or read the production database to bypass denial.

1. Call `{ "projectId": "<resolved project ID>", "limit": 25 }`. Omit `runId` to page runs. Save each returned run ID, status and scope status; follow `nextCursor` unchanged until `hasMore=false`, subject to the agreed read budget.
2. For each in-scope run, call `{ "projectId": "<same ID>", "runId": "<returned run ID>", "limit": 25 }`. Follow that run's cursor separately. Maximum limit is 50. Never reuse a cursor across projects, workspaces, modes or runs.
3. Report page/read counts, observed timestamps, run statuses and checkpoint classifications; keep raw prompts, context, task IDs, channels and values out of evidence. The tool never returns those fields.
4. `legacy-unattributed`, `missing`, `invalid`, `unknown-version`, incomplete scope or `explicit-review-required` needs explicit treatment before recovery. `partial-not-resumable` is not a graph checkpoint; approval records are `not-applicable`. `format-compatible-only` verifies only the pending-writes shape, not graph validity, current authority or side-effect safety.
5. `authorizesResume=false` always. Do not resume, migrate, rewrite, delete or approve anything under this review. Route an implementation defect to `lpm-deliver-activity`; release gates remain with `lpm-release-product` (LPM maintainers only).

Coverage is project runs and checkpoints linked to those runs, not orphan checkpoints. Pagination is not an atomic snapshot; concurrent changes require a fresh review or a separately authorized quiescence window. If a page is skipped, a read budget is exhausted, or scope validation fails, report **incomplete**, not "safe to deploy". Exhausting cursors only proves that bounded traversal completed at the observed times; it does not accept parity or archive AISH.
