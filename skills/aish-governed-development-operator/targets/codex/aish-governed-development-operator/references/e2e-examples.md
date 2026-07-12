# End-to-End Examples

Replace placeholder IDs with real IDs from LPM/AISH.

## Example 1: New Feature Through AISH

Goal: implement a feature with governed execution.

1. Confirm repo state:
   - `git status --short --branch`
   - identify branch and deployment target
2. Resolve LPM project and existing issues.
3. Generate an Autopilot plan:
   - objective
   - requirements
   - constraints such as `runner local`, `no deploy without approval`, `record evidence`
4. Review scope.
5. Materialize issues and jobs with execution gates closed.
6. Approve only the first job.
7. Run local runner with a deterministic executor.
8. Inspect evidence and linked issue.
9. Repeat job-by-job.
10. Run validation and record pipeline evidence.
11. Close issues only after evidence exists.

Expected outcome:

- issues and jobs are linked
- each executed job has evidence
- no sibling job was approved implicitly
- no release happened without release approval

## Example 2: Controlled Dry-Run

Goal: validate AISH flow without code changes.

1. Materialize a sandbox or low-risk project.
2. Approve a single job.
3. Run executor that prints repo state, checks expected files, and verifies clean diff.
4. Record evidence.
5. Post-check that no queued approved job remains unless intentionally blocked.

Expected outcome:

- AISH can lease and complete the approved job
- evidence is linked
- working tree remains clean

## Example 3: Stale Queue Cleanup

Goal: clean approved AISH jobs that were superseded by a later validated release.

1. List AISH jobs for the project.
2. Identify active jobs with `queued`, `leased`, or `running`.
3. For already-approved stale jobs, execute a no-op or dry-run cleanup executor that references the superseding evidence.
4. Run validation for stale validation jobs when useful.
5. Close linked issues as `done` only if the replacement evidence proves completion.
6. Record one consolidated cleanup evidence item.
7. Confirm active queue count is zero.

Expected outcome:

- no approved queued jobs remain
- stale issues are closed with evidence trail
- no deploy or code mutation occurs during cleanup

## Example 4: Production Release

Goal: deploy a validated change.

1. Confirm explicit release approval.
2. Run repo deploy runbook with AISH evidence enabled.
3. Wait for Cloud Build and Cloud Run revision readiness.
4. Run authenticated smoke against the deployed URL.
5. Record AISH smoke evidence.
6. Report revision, build id, evidence IDs, and residual risks.

Expected outcome:

- deploy evidence exists
- production smoke evidence exists
- release state is traceable in LPM/AISH
