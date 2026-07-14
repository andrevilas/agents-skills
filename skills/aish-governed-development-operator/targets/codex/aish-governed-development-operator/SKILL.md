---
name: aish-governed-development-operator
description: Standardize software development through LPM-governed AISH Autopilot, local or remote runner execution, approvals, job evidence, validation gates, and release readiness. Use when the user wants new feature work, software changes, autonomous or semi-autonomous development, AISH Autopilot operation, AISH runner host operation, or project delivery work to follow the LPM/AISH governed workflow.
---

# AISH Governed Development Operator

Use this skill when development work should be run through AISH as the execution control plane and LPM as the system of record.

This skill is for the software-delivery loop itself: intake, planning, backlog materialization, job approval, local or remote runner execution, evidence, validation, and release gating. Use `software-project-orchestrator` for broader project operations, `requirements-lifecycle-manager` for formal baselines, `governance-decision-operator` for LPM governance threads, and `access-and-credentials-admin` for keys, AI credentials, or privileged access changes.

Read [references/aish-operating-model.md](./references/aish-operating-model.md) before changing code through AISH.
Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact LPM/AISH tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants the end-to-end flow.

## Current AISH Baseline

- Product URL: `https://aish.lpm.rocks/aish`
- Cloud Run canonical URL: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/aish`
- AISH project: `XUxBwrJy0Ath2oW0yuvl`
- Default runner mode: `local`
- Remote runner hosts: supported when onboarded, scoped, monitored, and explicitly selected or targeted
- Governed Autopilot: ready for MVP operation
- Continuous Autopilot: allowed only when the user explicitly authorizes the bounded run
- Managed runner / Cloud Run Jobs: gated, not default
- Monthly MVP guardrail: `US$ 7`

## Operating Principles

1. LPM first.
   Resolve workspace, project, issue, requirements, and decision context before execution.

2. AISH decomposes; humans govern.
   Use Autopilot for intake and backlog. Keep execution gated unless the user explicitly authorizes a bounded continuous Autopilot run.

3. Runner command is operator-controlled.
   Treat `AISH_JOB_PROMPT` as data. Never execute it directly as shell.

4. Evidence closes work.
   Do not mark issues complete until the runner, validation, or pipeline evidence exists.

5. No unmanaged release.
   Do not deploy or publish unless release approval is explicit or included in the authorized bounded Autopilot scope, and evidence recording is configured.

6. Project cockpit is the operational read model.
   Prefer the AISH project view for project-scoped jobs, decisions, hosts, evidence, and timeline before reconstructing state manually from many calls.

## Standard Workflow

1. Inspect LPM context.
   Identify the target project, existing issues, relevant requirements, current branch, deployment target, and repo cleanliness.

2. Plan with AISH Autopilot.
   Use the `/aish` intake or `lpm aish autopilot plan` to turn the objective into issue drafts, checkpoints, guardrails, and risk notes.

3. Materialize only after scope review.
   Create LPM issues and queued AISH jobs with `runnerMayExecute=false`.

4. Approve the intended execution scope.
   Use UI approval or `lpm aish autopilot approve --job <jobId> --reason <reason>`. Approve one job at a time by default; if the user explicitly authorizes continuous Autopilot, record the max job count, timeout, target host policy, and release boundary before proceeding.

5. Run the selected runner.
   Execute from the real repo checkout or from an onboarded remote host with a deterministic command. Use `--once` for controlled execution unless running an explicitly authorized queue worker.

6. Validate and record evidence.
   Run relevant tests, lint, build, smoke, or dry-run gates. Ensure the AISH job has evidence IDs.

7. Close or advance LPM work.
   Move linked issues only after reading status, evidence, and blockers. Leave downstream release work gated until evidence review.

8. Release only when requested.
   Use the project runbook and `AISH_PIPELINE_EVIDENCE=true` for deploys that should publish AISH evidence.

## Remote Runner Operation

Use remote hosts when the work benefits from an isolated machine, a persistent build environment, private network reachability, or mobile-initiated execution. Remote hosts remain part of the same governed AISH cycle; they are not a separate execution authority.

1. Register the host deliberately.
   Create a short-lived enrollment token with `aish hosts create-token`, enroll or bootstrap the host with declared capabilities, and store only the generated host profile on the runner host.

2. Scope the host.
   Associate the host with the project, capabilities, and repos it is allowed to work on. Use `--target-host` on approval when a job must run on a specific host.

3. Verify readiness.
   Run `aish host doctor`, `aish host sync-repos --dry-run`, and `aish host monitor` before assigning real work to a new or stale host.

4. Start the remote worker safely.
   Use `aish host start --profile <path> --executor-command '<operator-controlled command>'`. Set `--targeted-only` for dedicated hosts, `--poll-interval-ms` for queue polling cadence, and `--once` for a single validation job.

5. Close the loop.
   Evidence should identify the host id, runner id, capability profile, repo HEAD, and sanitized command output. Revoke stale hosts with `aish hosts revoke`.

## Continuous Autopilot Mode

Continuous Autopilot is valid only when the user explicitly authorizes it in the current task or an existing governed decision. Before running it, state and enforce:

- objective and project scope
- max jobs or clear stop condition
- timeout or polling window
- allowed runner hosts and required capabilities
- whether deploy is included or remains gated
- required validation and smoke evidence

If any limit is missing, fall back to job-by-job approval. Stop when validation fails, a governance decision is required, a secret would be exposed, a remote host is unhealthy, or a release boundary is reached.

## Decision Boundaries

- AISH decision queues and execution checkpoints belong to this skill. They cover job approval, runner targeting, failure review, evidence review, and continuous Autopilot authorization.
- LPM governance threads belong to `governance-decision-operator`. They cover scope, requirement, change-set, and business/governance outcomes.
- Credential creation, API key rotation, and host access policy belong to `access-and-credentials-admin`; this skill may consume those decisions but should not bypass them.

## Guardrails

- Do not run a queued AISH job unless `runnerMayExecute=true`.
- Do not approve sibling jobs automatically unless the user explicitly authorized bounded continuous Autopilot and the bounds are recorded.
- Do not use AISH as an ungoverned remote shell.
- Do not expose tokens, refresh tokens, API keys, `.env` values, or auth state contents in evidence or chat.
- Do not execute on a remote host that is not onboarded, monitored, and scoped to the project.
- Do not assume local credentials, git remotes, VPN access, or browser auth exist on a remote runner.
- Do not reuse a remote workdir for unrelated work without an explicit cleanup or repo sync step.
- Do not enable Cloud Run Jobs or managed runners without the managed-runner gate.
- Do not leave approved queued jobs behind at the end of a cycle; consume, cancel, or explicitly block them.
- Do not claim deploy completion without AISH pipeline evidence and authenticated smoke evidence against the deployed target.
- Do not record smoke, runner, or pipeline output that includes auth headers, cookies, tokens, `.env` content, or raw credential files.
