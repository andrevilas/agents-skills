# Flow: AISH job integrity repair
Load when: decision row 12 of SKILL.md

## Preconditions
1. The user named the job and the outcome; the reason is the user's words. Never change a job the user did not name.
2. Which repair, outcomes and field rules: {{ref:integrity-repair}}. Every repair is permanent and audited.

## Steps
1. {{tool:get_aish_job}}(jobId) → keep `status`, `issueId`, `workflowBinding`, `completionDisposition`, `lineageRepair`, `issueReconciliation`; pick the action in {{ref:integrity-repair}} § Which repair. Already set → report it, no call.
2. Lineage: {{tool:repair_aish_completed_job_lineage}}(jobId, outcome, reason, targetIssueId only for `reconciled-with-issue`, idempotencyKey="lineage-<jobId>-1", dryRun=true) [C] → show `actions[]`; on "apply" the same call with dryRun=false [C].
3. Disposition: `workflowBinding` set and the user has not said the activity is `done` or the job was replaced by a newer plan → STOP: "A disposition permanently blocks the DoD audit of <issueId>. Use it only for a job replaced by a newer plan." Else {{tool:set_aish_completed_job_disposition}}(jobId, outcome=`partial`/`superseded`/`invalidated`, reason ≥ 8 chars) [C]; say "permanent; the activity status does not change".
4. Failed, leftover or mismatched: [C] run the {{ref:integrity-repair}} command (`lpm aish jobs resolve`, `close` or `reconcile`, with `--json`).
5. Verify: {{tool:get_aish_job}}(jobId) → the field just set; {{tool:get_project_analytics}}(projectId) → jobId absent from both `metrics.integrity.details.orphanAishJobs[]` and `.terminalIssueJobMismatches[]` (each `{jobId, category, reason}`); re-read once after ~10 s.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| job or outcome not named | "Which job, and which outcome: <allowed values>?" |
| before a disposition, a lineage apply, a CLI close/resolve | "Apply <exact call>? Effect: <effect>. It is permanent." |
| "Lineage repair evidence already exists without a matching job repair" | STOP and tell the user; no retry |
| disposition on a job with `workflowBinding`, activity not `done`, job not replaced by a newer plan | "A disposition permanently blocks the DoD audit of <issueId>. Use it only for a job replaced by a newer plan." STOP |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| disposition, lineage, CLI close/resolve/reconcile | {{tool:get_aish_job}} | `completionDisposition`, `lineageRepair`, `status` or `issueReconciliation.status` as sent |

## Report fields
Job id, action and outcome, `lineageRepair.originalIssueId` when set, integrity signal cleared (yes/no), Pending, Next.
