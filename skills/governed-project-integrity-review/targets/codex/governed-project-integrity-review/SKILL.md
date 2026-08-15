---
name: governed-project-integrity-review
description: Review and reconcile governance and execution integrity across LPM and AISH. Use when a project appears healthy despite scope drift, invalid lifecycle states, stale cycles, orphan Autopilot issues or jobs, terminal issue-job mismatches, missing evidence, or repeated materialization.
---

# Governed Project Integrity Review

Use this skill to determine whether scope, execution, evidence, and reported health agree. A high completion rate or a published baseline is not sufficient proof of integrity.

Read [references/integrity-contract.md](./references/integrity-contract.md) before mutating project state. Read [references/e2e-examples.md](./references/e2e-examples.md) for full review and reconciliation examples.

## Operating Contract

1. Resolve the exact project and workspace.
2. Pull `get_project_analytics`, `get_project_read_model`, and `get_project_scope_resolution_context` before interpreting health.
3. Inspect issues, cycles, milestones, baselines, requirements, dependencies, and repository links only as needed to explain integrity signals.
4. For AISH, query jobs through the isolated CLI profile, for example `lpm-codex aish jobs list --project <id> --json`.
5. Separate findings into lifecycle, scope, execution, evidence, and reporting.
6. Preview the smallest reversible reconciliation before applying it.
7. Execute only within the user's authorization. Record rationale and evidence before terminal transitions.
8. Re-query analytics and read models after mutation; do not claim health from intended state.

## Integrity Invariants

- Issue statuses are `backlog`, `todo`, `in-progress`, `done`, or `canceled`.
- Cycle statuses are `upcoming`, `active`, or `completed`; an active cycle past its end date is a health signal.
- Repeating one Autopilot materialization with the same key must not create more work items.
- A completed AISH job linked to an issue requires evidence, a traceable comment, and issue status `done`.
- Failed reconciliation remains visible and retryable; it is not silently ignored.
- A current baseline does not erase unpublished changes or requirements updated after publication.
- `healthy` is valid only when delivery metrics and integrity metrics agree.

## Reconciliation Order

1. Preserve the live snapshot and IDs.
2. Classify historical records separately from active work.
3. Normalize invalid states through supported transitions.
4. Reconcile terminal jobs with linked issues using `lpm-codex aish jobs reconcile --job <id> --json`.
5. Resolve orphan Autopilot items only after proving there is no linked or recoverable job.
6. Close stale cycles or replace them with a bounded active cycle.
7. Review and publish scope through a change set; never use code completion as baseline approval.
8. Attach sanitized test, build, deploy, and smoke evidence.
9. Re-run the integrity review and report residual risks explicitly.

## Guardrails

- Use the isolated Codex LPM profile; never read or overwrite another agent's credentials.
- Never cancel, delete, or normalize records solely from their title.
- Do not call an orphan without checking both issue and job lineage.
- Do not mark requirements met before implementation and validation evidence exist.
- Do not treat a successful build as deploy or smoke evidence.
- Human-approval waivers do not waive technical checks, auditability, rollback, or external legal/security gates.

## Output

Report: scope, live integrity status, signals with IDs, actions applied, validation evidence, residual risks, and the next governed gate.
