# End-to-End Examples

## Health Contradiction

1. Pull analytics, read model, and scope context.
2. If analytics says `healthy`, inspect `metrics.integrity` before agreeing.
3. Identify invalid statuses, stale cycles, orphan items, terminal mismatches, and baseline drift.
4. Return facts first and propose the smallest reconciliation.

Expected result: a project with integrity signals is reported as `watch` or `critical`, even when completion is high.

## Autopilot Retry

1. Preview materialization.
2. Execute with a stable `--idempotency-key`.
3. Repeat with the same key.
4. Verify the same run, issues, and jobs are returned.

Expected result: no duplicate issue, job, comment, webhook intent, or terminal transition.

## Terminal Reconciliation

1. Confirm job status and sanitized evidence.
2. Confirm the linked issue exists.
3. Run `lpm-codex aish jobs reconcile --job <id> --json`.
4. Verify the comment, issue status, and `issueReconciliation.status`.
5. Retry once and verify the operation is reused.

Expected result: completed job and issue converge to `completed`/`done`; failure remains visible and retryable.
