---
name: aish-governed-development-operator
description: Standardize software development through LPM-governed AISH Autopilot, local runner execution, approvals, job evidence, validation gates, and release readiness. Use when the user wants new feature work, software changes, autonomous or semi-autonomous development, AISH Autopilot operation, AISH runner execution, or project delivery work to follow the LPM/AISH governed workflow.
---

# AISH Governed Development Operator

Use this skill when development work should be run through AISH as the execution control plane and LPM as the system of record.

This skill is for the software-delivery loop itself: intake, planning, backlog materialization, job approval, local runner execution, evidence, validation, and release gating. Use `software-project-orchestrator` for broader project operations, `requirements-lifecycle-manager` for formal baselines, and `access-and-credentials-admin` for keys or AI credentials.

Read [references/aish-operating-model.md](./references/aish-operating-model.md) before changing code through AISH.
Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact LPM/AISH tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants the end-to-end flow.

## Current AISH Baseline

- Product URL: `https://aish.lpm.rocks/aish`
- Cloud Run canonical URL: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/aish`
- AISH project: `XUxBwrJy0Ath2oW0yuvl`
- Default runner mode: `local`
- Governed Autopilot: ready for MVP operation
- Managed runner / Cloud Run Jobs: gated, not default
- Monthly MVP guardrail: `US$ 7`

## Operating Principles

1. LPM first.
   Resolve workspace, project, issue, requirements, and decision context before execution.

2. AISH decomposes; humans approve.
   Use Autopilot for intake and backlog, but keep execution job-scoped and gated by `execution-approval`.

3. Runner command is operator-controlled.
   Treat `AISH_JOB_PROMPT` as data. Never execute it directly as shell.

4. Evidence closes work.
   Do not mark issues complete until the runner, validation, or pipeline evidence exists.

5. No unmanaged release.
   Do not deploy or publish unless release approval is explicit and evidence recording is configured.

## Standard Workflow

1. Inspect LPM context.
   Identify the target project, existing issues, relevant requirements, current branch, deployment target, and repo cleanliness.

2. Plan with AISH Autopilot.
   Use the `/aish` intake or `lpm aish autopilot plan` to turn the objective into issue drafts, checkpoints, guardrails, and risk notes.

3. Materialize only after scope review.
   Create LPM issues and queued AISH jobs with `runnerMayExecute=false`.

4. Approve one job at a time.
   Use UI approval or `lpm aish autopilot approve --job <jobId> --reason <reason>`.

5. Run the local runner.
   Execute from the real repo checkout with a deterministic command. Use `--once` for controlled execution.

6. Validate and record evidence.
   Run relevant tests, lint, build, smoke, or dry-run gates. Ensure the AISH job has evidence IDs.

7. Close or advance LPM work.
   Move linked issues only after reading status, evidence, and blockers. Leave downstream release work gated until evidence review.

8. Release only when requested.
   Use the project runbook and `AISH_PIPELINE_EVIDENCE=true` for deploys that should publish AISH evidence.

## Guardrails

- Do not run a queued AISH job unless `runnerMayExecute=true`.
- Do not approve sibling jobs automatically.
- Do not use AISH as an ungoverned remote shell.
- Do not expose tokens, refresh tokens, API keys, `.env` values, or auth state contents in evidence or chat.
- Do not enable Cloud Run Jobs or managed runners without the managed-runner gate.
- Do not leave approved queued jobs behind at the end of a cycle; consume, cancel, or explicitly block them.
- Do not claim production readiness without current validation against the deployed target.
