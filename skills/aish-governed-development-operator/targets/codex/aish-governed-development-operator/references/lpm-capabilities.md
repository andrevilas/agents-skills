# LPM And AISH Capability Map

Use this file when mapping a governed development task to LPM/AISH tools or CLI commands.

## LPM Context

- Projects: `list_projects`, `get_project`, `create_project`, `update_project`
- Issues: `list_issues`, `get_issue`, `create_issue`, `update_issue`
- Links and blockers: `list_issue_links`, `create_issue_link`
- Comments and follow-up: `list_comments`, `create_comment`
- Evidence: activity evidence tools for recoverable file attachments; AISH evidence for runner and pipeline output
- Analytics: `get_project_analytics` when making delivery-health claims
- Decisions: use LPM governance tools for governance threads; use AISH job gates and queues for execution checkpoints

## AISH Commands

Plan:

```bash
npm run cli -- aish autopilot plan \
  --project "<project-id>" \
  --objective "<objective>" \
  --requirements "<req one; req two>" \
  --constraints "<guardrails>" \
  --repository "$PWD" \
  --json
```

Materialize:

```bash
npm run cli -- aish autopilot materialize \
  --project "<project-id>" \
  --objective "<objective>" \
  --requirements "<req one; req two>" \
  --constraints "<guardrails>" \
  --repository "$PWD" \
  --create-jobs \
  --approve \
  --json
```

Approve one job:

```bash
npm run cli -- aish autopilot approve \
  --job "<job-id>" \
  --reason "<approval reason>" \
  --target-host "<host-id>" \
  --json
```

Omit `--target-host` when any eligible runner may execute the approved job.

Run one job:

```bash
npm run cli -- aish runner start \
  --project "<project-id>" \
  --runner-id "$(hostname):aish-local" \
  --workdir "$PWD" \
  --timeout-ms 900000 \
  --once \
  --executor-command '<operator-controlled command>' \
  --json
```

List or inspect jobs:

```bash
npm run cli -- aish jobs list --project "<project-id>" --json
npm run cli -- aish jobs get --job "<job-id>" --json
```

Remote host enrollment:

```bash
npm run cli -- aish hosts create-token \
  --project "<project-id>" \
  --display-name "<host label>" \
  --expires-minutes 60 \
  --json

npm run cli -- aish hosts enroll \
  --token "<enrollment-token>" \
  --display-name "<host label>" \
  --hostname "<hostname>" \
  --capabilities "build; test; deploy" \
  --json
```

Remote host bootstrap for a new machine:

```bash
npm run cli -- aish host bootstrap \
  --token "<enrollment-token>" \
  --profile "$HOME/.config/aish/host-profile.json" \
  --managed-dir "$HOME/aish-managed" \
  --repo "git@github.com:org/repo.git#main" \
  --display-name "<host label>" \
  --hostname "<hostname>" \
  --capabilities "build; test; deploy" \
  --json
```

Remote host verification and monitoring:

```bash
npm run cli -- aish hosts list --project "<project-id>" --json
npm run cli -- aish host doctor --profile "$HOME/.config/aish/host-profile.json" --json
npm run cli -- aish host sync-repos --profile "$HOME/.config/aish/host-profile.json" --dry-run --json
npm run cli -- aish host monitor --project "<project-id>" --stale-after-ms 120000 --offline-after-ms 300000 --json
```

Remote host worker:

```bash
npm run cli -- aish host start \
  --profile "$HOME/.config/aish/host-profile.json" \
  --runner-id "$(hostname):aish-remote" \
  --executor-command '<operator-controlled command>' \
  --poll-interval-ms 15000 \
  --targeted-only \
  --json
```

Revoke a stale or compromised host:

```bash
npm run cli -- aish hosts revoke \
  --project "<project-id>" \
  --host "<host-id>" \
  --json
```

Record pipeline evidence:

```bash
npm run cli -- aish pipeline record \
  --project "<project-id>" \
  --provider "<provider>" \
  --status completed \
  --title "<title>" \
  --summary "<summary>" \
  --output "<sanitized output>" \
  --build-id "<id>" \
  --revision "<revision>" \
  --repository "$PWD" \
  --json
```

Record authenticated smoke evidence with the pipeline recorder:

```bash
npm run cli -- aish pipeline record \
  --project "<project-id>" \
  --provider "playwright-smoke" \
  --status completed \
  --title "<smoke title>" \
  --summary "<what was verified>" \
  --output "<sanitized status, revision, URL, and assertions>" \
  --revision "<deployed revision>" \
  --url "<tested URL>" \
  --repository "$PWD" \
  --json
```

Record recoverable LPM activity evidence for artifacts that future operators must inspect:

1. Identify the activity tied to the issue/job result with `list_workspace_activities`.
2. Check existing files with `list_activity_attachments`.
3. Use `upload_activity_attachment` for new files, or `create_activity_attachment` only for immutable trusted URLs.
4. Attach every artifact needed to recreate or analyze the scenario: report/manifest, sanitized JSON or logs, screenshots, traces, runner script, commit/revision, environment, and acceptance result.
5. For Playwright, browser smoke, or UI QA, attach screenshots as `image/png` or `image/jpeg`.
6. Re-read `list_activity_attachments`; only report closure when the evidence is recoverable.

## Tooling Guardrails

- Prefer CLI/API paths that preserve AISH evidence over ad hoc local notes.
- Prefer recoverable LPM activity attachments over comments, local paths, chat snippets, or opaque external evidence IDs when artifacts matter for later analysis.
- Do not upload secrets into evidence.
- Do not paste enrollment tokens, host credentials, cookies, auth headers, browser storage, or `.env` contents into evidence.
- Do not mark a job complete by editing storage directly.
- Do not bypass LPM issue status with local-only tracking.
- Do not close visual validation work without Playwright/browser screenshots attached to the relevant LPM activity.
- Do not treat `hosts enroll` or `host bootstrap` as approval to execute arbitrary work; jobs still need execution gates or bounded Autopilot authorization.
- Do not declare deploy complete until pipeline evidence and authenticated smoke evidence exist.
