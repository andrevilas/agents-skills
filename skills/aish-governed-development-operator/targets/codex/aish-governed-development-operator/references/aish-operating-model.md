# AISH Operating Model

Use this reference when development work should be standardized through AISH.

## Product Boundary

- LPM owns governance: workspace access, project context, issues, requirements, approvals, comments, evidence trail, and cost guardrails.
- AISH owns execution control: Autopilot planning, AISH jobs, runner leases, execution gates, sanitized output, pipeline evidence, and release-readiness evidence.
- The local runner owns local execution: repository checkout, user-held credentials, VPN/private network access, local tokens, dependency cache, and toolchain.
- A remote runner host owns remote execution only after onboarding: managed checkout, declared capabilities, scoped credential profile, queue polling, cleanup, and heartbeat/monitoring.

## MVP Posture

- Control plane runs inside the existing LPM service.
- Runner mode stays `local` by default.
- Remote runner hosts are supported for governed queue work, but must be onboarded, scoped, monitored, and selected by capability or target host.
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

## Remote Host Pattern

Use this pattern when a host without an existing workspace should join the AISH queue:

1. Create a short-lived enrollment token from a trusted operator machine:

```bash
npm run cli -- aish hosts create-token \
  --project "$AISH_PROJECT_ID" \
  --display-name "<host label>" \
  --expires-minutes 60 \
  --json
```

2. Bootstrap the host with declared repos and capabilities:

```bash
npm run cli -- aish host bootstrap \
  --token "$AISH_HOST_ENROLLMENT_TOKEN" \
  --profile "$HOME/.config/aish/host-profile.json" \
  --managed-dir "$HOME/aish-managed" \
  --repo "git@github.com:org/repo.git#main" \
  --display-name "$(hostname)" \
  --capabilities "build; test; deploy" \
  --json
```

3. Verify before execution:

```bash
npm run cli -- aish host doctor --profile "$HOME/.config/aish/host-profile.json" --json
npm run cli -- aish host sync-repos --profile "$HOME/.config/aish/host-profile.json" --dry-run --json
```

4. Start the worker with an operator-controlled executor:

```bash
npm run cli -- aish host start \
  --profile "$HOME/.config/aish/host-profile.json" \
  --runner-id "$(hostname):aish-remote" \
  --executor-command 'bash -lc "npm run lint && npm test"' \
  --poll-interval-ms 15000 \
  --targeted-only \
  --json
```

Remote output must include host id, runner id, repo path, HEAD, and validation result, but never tokens, profile contents, auth headers, cookies, or `.env` values.

## Continuous Autopilot Pattern

Use continuous Autopilot only when the user explicitly authorizes a bounded run. Record the authorization in the job approval reason or issue/comment context:

- objective and project
- max jobs or stop condition
- timeout/polling window
- target host or capability constraints
- whether deploy is included
- required validation and smoke evidence

If deploy is in scope, production closure still requires Cloud Run/build evidence plus authenticated smoke evidence. If deploy is out of scope, stop after validation and leave release gated.

## Project Cockpit Pattern

Use the AISH project cockpit as the first operational read model for:

- project-scoped queue state
- decision queues and execution checkpoints
- remote host readiness
- timeline of jobs and evidence
- production/deploy status and smoke evidence

Prefer cockpit-derived state before reconstructing the same answer from many individual job and issue calls.

## Recoverable Evidence Pattern

AISH evidence is necessary for runner and pipeline audit, but it is not always sufficient for issue-level recovery. Any artifact that can help a future operator or the LPM UI recreate, inspect, or analyze a scenario must also be attached to the relevant LPM activity.

Attach, when applicable:

- report or manifest
- sanitized JSON/log output
- Playwright/browser screenshots and traces
- runner or reproduction script
- commit/revision, environment, image/tag, URL, and acceptance result

For visual validation, browser smoke, UI QA, or Playwright, screenshots are mandatory. Before closing a linked issue, re-read LPM activity attachments and confirm the artifact list is recoverable.

## Completion Criteria

A governed AISH cycle is complete only when:

- no unexpected local changes remain
- all intended jobs are `completed` or intentionally blocked
- linked issues are moved to the correct status
- evidence IDs exist for runner, validation, and deployment when applicable
- recoverable LPM activity attachments exist for reports, logs, screenshots, traces, JSON, manifests, or runner scripts needed for future recreation/analysis
- no approved queued jobs are left behind
- remote hosts used in the cycle are healthy, stopped when appropriate, or explicitly left as queue workers
- release work remains gated unless the user explicitly requested release or included it in bounded continuous Autopilot

## Common Operating Modes

### New Feature

Plan with Autopilot, materialize issues and jobs, approve implementation jobs one at a time, run tests and build, record evidence, then prepare release gate.

### Dry-Run Implementation

Use when validating AISH behavior or cleaning stale queues. Record current commit, current deployed revision, and validation evidence. Do not mutate code or deploy.

### Production Release

Only after explicit release approval. Use the repository deploy runbook. Enable AISH pipeline evidence and run an authenticated smoke after deploy.

### Remote Queue Work

Use when a trusted host should consume project work without a pre-existing local workspace. Bootstrap repos from Git, run `host doctor`, approve jobs with target host or capability constraints, start the host worker, and monitor until the queue is empty or the stop condition is reached.

### Continuous Autopilot

Use when the human explicitly authorizes a bounded end-to-end run. Execute within the recorded max jobs, timeout, host policy, validation gates, and release boundary. Stop on failures or missing decisions instead of inventing new authority.
