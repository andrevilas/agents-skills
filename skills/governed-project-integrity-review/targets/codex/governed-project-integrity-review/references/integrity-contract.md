# Integrity Contract

## Required Reads

- `get_project`
- `get_project_analytics`
- `get_project_read_model`
- `get_project_scope_resolution_context`
- `list_issues`
- `list_cycles`
- `list_milestones`
- `list_requirement_baselines`
- `list_project_repository_links`

Use `get_issue`, `list_comments`, dependency tools, and the AISH job CLI only for signals that need explanation.

## Signal Matrix

| Signal | Meaning | Default action |
| --- | --- | --- |
| invalid issue status | lifecycle drift | map through an explicit supported transition |
| active cycle past end | planning drift | close or replace after checking remaining work |
| Autopilot issue without job | possible partial materialization | inspect run/job lineage before canceling |
| job without issue | execution orphan | restore link or close administratively with evidence |
| completed job, open issue | terminal mismatch | use idempotent issue reconciliation |
| issue done, nonterminal job | premature closure | inspect evidence and reopen or complete deliberately |
| requirement updated after current baseline | scope drift | review change set and publish a new baseline |
| health says healthy with any signal above | reporting defect | treat integrity as at least watch |

## Evidence Minimum

Keep test, lint/build, commit, deploy, and smoke as separate facts. Evidence must be sanitized, recoverable, and linked to the issue that it supports.

For retryable operations, record the idempotency key or deterministic run identifier without exposing credentials.
