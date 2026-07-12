# LPM And AISH Capability Map

Use this file when mapping a governed development task to LPM/AISH tools or CLI commands.

## LPM Context

- Projects: `list_projects`, `get_project`, `create_project`, `update_project`
- Issues: `list_issues`, `get_issue`, `create_issue`, `update_issue`
- Links and blockers: `list_issue_links`, `create_issue_link`
- Comments and follow-up: `list_comments`, `create_comment`
- Evidence: activity evidence tools for file attachments; AISH evidence for runner and pipeline output
- Analytics: `get_project_analytics` when making delivery-health claims

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
  --json
```

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

## Tooling Guardrails

- Prefer CLI/API paths that preserve AISH evidence over ad hoc local notes.
- Do not upload secrets into evidence.
- Do not mark a job complete by editing storage directly.
- Do not bypass LPM issue status with local-only tracking.
