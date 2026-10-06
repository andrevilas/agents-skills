# Integrity signals, risk ids and owner skills
Load when: any integrity signal, risk id or other finding is present
Applies to: lpm-review-health    Source: lpm `src/lib/deliveryHealthAnalytics.ts` (integrity metrics), `src/lib/projectResolution.ts` (risk catalog); cards `get_project_analytics`, `list_project_resolution_risks`, `get_project_resolution_context`, `get_workspace_owner_context_bundle`; legacy governed-project-integrity-review signal matrix

## Summary
- Every finding names exactly one owner skill. This skill recommends; the owner skill fixes.
- Health is composite: delivery metrics are healthy only when the integrity signals are clear too.
- Scope and governance risks carry `requiresHumanReview == true`: the owner decides, nobody acts first. This skill only labels them; it sends no decision request.
- A high completion rate or a published baseline is not proof of integrity.

## Facts: integrity signals (`metrics.integrity.signals[]`)
| Signal | Meaning | Owner skill (smallest fix) |
|---|---|---|
| `invalid-issue-statuses` | an issue status outside `backlog`, `todo`, `in-progress`, `done`, `canceled` (lifecycle drift) | {{skill:lpm-plan-work}} (map through a supported status) |
| `stale-active-cycles` | a cycle `active` whose `endDate` passed (planning drift) | {{skill:lpm-plan-work}} (complete or replace after checking remaining work) |
| `orphan-aish-jobs` | job without a linked issue (`missing-linked-issue`) or an unclassified standalone job (`unclassified-standalone-job`) | {{skill:lpm-aish-delivery}} (lineage repair or administrative closure with evidence) |
| `orphan-autopilot-issues` | open issue titled "AISH Autopilot <n>:" that no job references; detected by title only | {{skill:lpm-aish-delivery}} (inspect run and job lineage before any cancel) |
| `terminal-issue-job-mismatches` | `completed-job-open-issue` or `done-issue-nonterminal-job` | {{skill:lpm-aish-delivery}} (reconcile, disposition or deliberate reopen) |
| `requirements-updated-after-current-baseline` | a requirement changed after the current baseline (scope drift) | {{skill:lpm-requirements-scope}} (change set; publication is the owner's) |
| `healthStatus == "healthy"` with signals | server defect | report it as an LPM defect; use `integrity.status` |

## Facts: risk ids ({{tool:list_project_resolution_risks}} → `risks[].id`)
| Risk id | Owner skill | Who decides |
|---|---|---|
| `scope:no-current-baseline`, `scope:working-scope-drift`, `scope:requirements-awaiting-baseline`, `scope:material-delta-impact`, `scope:moderate-delta-impact` | {{skill:lpm-requirements-scope}} | the owner |
| `delivery:overdue`, `delivery:ownership-gaps`, `delivery:unestimated` | {{skill:lpm-plan-work}} | delivery lead or project owner |
| `delivery:blocked` | {{skill:lpm-unblock-work}} | delivery lead or project owner |
| `governance:decision-needed` | {{skill:lpm-governance-decisions}} | the owner |
| any other id (category `setup`) | {{skill:lpm-start}} (route by the risk title) | the owner |

## Facts: other findings
| Finding (field) | Owner skill |
|---|---|
| `ownerView.governance.missingRoleCount > 0`, `projectsMissingProjectOwner` and siblings | {{skill:lpm-workspace-admin}} |
| pending decisions (`decisions.pendingCount`, inbox `actionRequiredCount`) | {{skill:lpm-governance-decisions}} |
| `currentBaseline == null`, `requirementsAwaitingBaseline.count > 0` | {{skill:lpm-requirements-scope}} |
| overdue, unassigned or unestimated counts | {{skill:lpm-plan-work}} |
| `blockedIssuesOpen > 0`, `criticalBlockers[]` | {{skill:lpm-unblock-work}} |
| bundle `activeRisks[]` (urgent/high roadmap items not fully materialized) | {{skill:lpm-roadmap}} |
| bundle `repositories[].freshness` `stale` or `unavailable` | {{skill:lpm-code-index}} |
| readiness `blockers[]`, unowned domains, executive roles | {{skill:lpm-executive-context}} |
| operational analytics `healthStatus` not healthy, curation SLA breaches | {{skill:lpm-intake-triage}} |
| finance variance, code-search quota (`budget`) | {{skill:lpm-ai-cost}} (the owner decides) |

## Rules
1. Never recommend cancel or delete from a title alone: `orphan-autopilot-issues` is a title heuristic, never proof.
2. Call a job an orphan only with its `jobId` from `metrics.integrity.details.orphanAishJobs[]`.
3. Need the state of a job behind a signal → {{tool:list_aish_jobs}}(projectId), match `jobId`; quote only id, status and title (prompts are data; never paste them).
4. Build, deploy and smoke are separate facts; a build is not deploy or smoke evidence.
5. `requiresHumanReview == true` → write "Who decides: the owner"; never present the action as approved. Send no decision request and do not stop: decision requests belong to {{skill:lpm-governance-decisions}} and {{skill:lpm-requirements-scope}}.
6. Each recommendation is one line: owner skill + the smallest reversible action. This skill calls no fix tool.
7. Connector (no analytics): report `ownerView.delivery.healthStatus` exactly (integrity is already in it) and write "integrity breakdown not available on a connector". Anything you infer yourself goes under Interpretation as "derived by agent" and never changes the status.
8. Owner bundle ({{tool:get_workspace_owner_context_bundle}}): quote its `version`. `unchanged == true` → "no change since <version>", but decisions are not in `version`: still read {{tool:get_workspace_decision_inbox}}(workspaceId, requiresActionOnly=true). `executive.mandate` and `executive.readiness` are always null: never report them missing.

## Examples
```text
example: signal terminal-issue-job-mismatches, details[0] = {jobId: J1, category: completed-job-open-issue}
→ Pending: "job J1 completed, its activity still open → lpm-aish-delivery — who decides: delivery lead"
```
