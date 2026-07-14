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

## Example 5: Remote Runner Host

Goal: add a trusted host to execute governed project queue work.

1. Create a short-lived host enrollment token.
2. Bootstrap the host with:
   - profile path
   - managed directory
   - allowed Git repos and branches
   - declared capabilities
3. Run host doctor and repo sync dry-run.
4. List hosts and confirm the host is active for the project.
5. Approve a test job with `--target-host` or required capabilities.
6. Start the host worker with an operator-controlled executor.
7. Monitor the host and inspect the completed job evidence.
8. Stop the worker or leave it polling only if that was the intended operating mode.

Expected outcome:

- host is enrolled with a scoped profile
- repos are synced without exposing deploy keys or tokens
- evidence identifies host, runner, repo HEAD, and sanitized validation output
- no untargeted or unauthorized jobs run on the host

## Example 6: Continuous Autopilot With Explicit Bounds

Goal: execute a pre-approved AISH delivery cycle without pausing after every job.

1. Capture the user's authorization text and confirm it includes:
   - target project and objective
   - max jobs or stop condition
   - timeout or polling window
   - allowed runner hosts
   - deploy boundary
   - validation and smoke evidence requirements
2. Materialize or inspect the backlog.
3. Approve jobs only within the authorized scope.
4. Run the local or remote runner until the stop condition, failure, or release boundary.
5. Record runner, validation, pipeline, and smoke evidence as applicable.
6. Move linked issues only after evidence exists.
7. List remaining jobs and explicitly consume, cancel, or block approved queued work.

Expected outcome:

- the autonomous run stays inside the recorded human authorization
- failures or missing decisions stop the run instead of expanding authority
- no approved queued jobs remain forgotten
- deploy is traceable through build/revision evidence and authenticated smoke
