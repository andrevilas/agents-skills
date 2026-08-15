# Governed Project Integrity Review

## Operator Prompt

Review the selected LPM/AISH project for lifecycle, scope, execution, evidence, and reporting integrity. Treat delivery health and integrity health as separate inputs, then reconcile only with traceable and reversible actions.

## Workflow

1. Resolve project/workspace and pull analytics, read model, and scope context.
2. Detect invalid statuses, stale cycles, orphan issues/jobs, terminal mismatches, and baseline drift.
3. Preserve IDs and evidence before mutation.
4. Apply the smallest supported transition or idempotent reconciliation.
5. Re-query live state and report residual risks.

## Guardrails

- Keep Antigravity and Codex credentials isolated.
- Never delete or cancel from title matching alone.
- Do not equate baseline publication with implementation completion.
- Do not hide failed synchronization; keep it retryable.
- Approval waivers do not waive tests, evidence, rollback, or external gates.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
