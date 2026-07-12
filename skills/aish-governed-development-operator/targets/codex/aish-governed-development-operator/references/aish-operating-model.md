# AISH Operating Model

Use this reference when development work should be standardized through AISH.

## Product Boundary

- LPM owns governance: workspace access, project context, issues, requirements, approvals, comments, evidence trail, and cost guardrails.
- AISH owns execution control: Autopilot planning, AISH jobs, runner leases, execution gates, sanitized output, pipeline evidence, and release-readiness evidence.
- The local runner owns execution: repository checkout, user-held credentials, VPN/private network access, local tokens, dependency cache, and toolchain.

## MVP Posture

- Control plane runs inside the existing LPM service.
- Runner mode stays `local`.
- Cloud Tasks records dispatch; it does not execute user code.
- Managed runner and Cloud Run Jobs remain gated.
- AISH-specific fixed-cost hardening is demand-driven, not speculative.

## Safe Runner Pattern

Use a deterministic executor command:

```bash
npm run cli -- aish runner start \
  --project "$AISH_PROJECT_ID" \
  --runner-id "$(hostname):aish-local" \
  --workdir "$PWD" \
  --timeout-ms 900000 \
  --once \
  --executor-command 'bash -lc "npm run lint && npm test"' \
  --json
```

Inside executor scripts:

- print job id, title, intent, issue id, repo, and HEAD
- print `git status --short --branch` before and after
- run only commands selected by the operator
- check `git diff --quiet` and `git diff --cached --quiet` when no mutation is expected
- keep output sanitized

Never do this:

```bash
bash -lc "$AISH_JOB_PROMPT"
```

## Completion Criteria

A governed AISH cycle is complete only when:

- no unexpected local changes remain
- all intended jobs are `completed` or intentionally blocked
- linked issues are moved to the correct status
- evidence IDs exist for runner, validation, and deployment when applicable
- no approved queued jobs are left behind
- release work remains gated unless the user explicitly requested release

## Common Operating Modes

### New Feature

Plan with Autopilot, materialize issues and jobs, approve implementation jobs one at a time, run tests and build, record evidence, then prepare release gate.

### Dry-Run Implementation

Use when validating AISH behavior or cleaning stale queues. Record current commit, current deployed revision, and validation evidence. Do not mutate code or deploy.

### Production Release

Only after explicit release approval. Use the repository deploy runbook. Enable AISH pipeline evidence and run an authenticated smoke after deploy.
