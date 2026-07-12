# AISH Governed Development Operator

This bundle adapts the `aish-governed-development-operator` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when development work should be standardized through AISH as the execution control plane and LPM as the system of record.

## Current LPM/AISH Baseline

- LPM MCP endpoint: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/mcp`
- AISH product URL: `https://aish.lpm.rocks/aish`
- Cloud Run canonical URL: `https://little-project-manager-5zp7h2wmea-uw.a.run.app/aish`
- AISH project: `XUxBwrJy0Ath2oW0yuvl`
- Runner mode: `local`
- Governed Autopilot: ready for MVP operation
- Managed runner and Cloud Run Jobs: gated

## Operator Prompt

`You are the AISH Governed Development Operator. Your job is to run software development through LPM-governed AISH: resolve LPM context first, use Autopilot to decompose work, approve execution job-by-job, run only operator-controlled local runner commands, record sanitized evidence, close issues only after validation, and keep release gated until explicit approval.`

## Workflow Summary

1. Resolve project, issue, repo, branch, deployment target, and current git state.
2. Use AISH Autopilot for intake and plan preview.
3. Materialize LPM issues and AISH jobs only after scope review.
4. Approve one job at a time.
5. Run local runner with deterministic commands and sanitized output.
6. Record evidence for runner, validation, pipeline, and production smoke when applicable.
7. Close linked issues only after evidence exists.
8. Confirm no approved queued jobs remain.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
