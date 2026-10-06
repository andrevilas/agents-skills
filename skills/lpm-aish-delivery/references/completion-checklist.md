# AISH completion checklist
Load when: before closing AISH work
Applies to: lpm-aish-delivery    Source: legacy digest `aish-governed-development-operator` §1.4, §1.6 (verified rules); cards {{tool:audit_aish_issue_delivery}}, {{tool:update_issue}}, {{tool:export_aish_execution_pack}}, {{tool:list_workspace_activities}}; lpm `server.ts` `updateIssueCommand` (status feed entry), `src/lib/activityContract.ts:94-106`

## Summary
AISH work is complete only when the factory audit passed right before closure, every job of the activity is terminal and consistent with it, and the evidence humans need is attached to the activity.
An AISH `evidenceId`, a comment, a chat message or a local file is not recoverable evidence: export the pack and attach it.
A release counts only with a `succeeded` receipt, pipeline evidence and an authenticated smoke against the deployed target.
Anything missing → keep the activity open and report one specific pending item with who must act.

## Facts
| Criterion | How to check | Consequence for the agent |
|---|---|---|
| DoD audit | {{tool:audit_aish_issue_delivery}} → `status == "passed"`, run right before {{tool:update_issue}} | `blocked` → fix `failures[]`; never close |
| jobs of the activity | {{tool:list_aish_jobs}}(projectId) filtered by `issueId` | any `queued`, `leased` or `running` → not complete; no approved job may stay queued |
| job statuses | `queued`, `leased`, `running`, `completed`, `failed`, `canceled` (no `blocked`) | terminal = `completed`, `failed`, `canceled` |
| job ↔ activity consistency | a completed job with an open activity, or a done activity with a non-terminal job, is not healthy | repair it ({{ref:integrity-repair}}); never report it as done |
| recoverable evidence | execution pack exported and attached; screenshots, logs, test reports, manifests attached to the activity | confirm each with {{tool:list_activity_attachments}} |
| visual work | screenshot + video artifacts (DoD) and screenshots on the activity at 390x844 and 1280x800 | PNG or JPEG on the activity |
| release | {{tool:get_aish_release}} → `succeeded` with `completion`; smoke output attached; pipeline evidence recorded | build ≠ deploy ≠ smoke: three separate facts |
| close result | {{tool:update_issue}} returns "Issue <issueId> updated successfully." | verify with the feed, not with the text |
| close verify | {{tool:list_workspace_activities}} → newest entry with `targetType == "issue"`, `targetId == issueId`, `type == "issue_completed"`, `metadata.status == "done"` | written only when the status really changed |
| edit of a done factory activity | title/description edits are refused: "Reopen and audit the changed delivery scope before closing." | set `in-progress`, audit again, then `done` |
| remote hosts used | healthy, stopped, or left as declared queue workers | host state → {{skill:lpm-aish-runners}} |
| local workspace | no unexpected local changes remain | report them as pending |

## Rules
1. Close in this order: audit `passed` → jobs terminal and consistent → evidence attached and listed → audit again → `done` → Verify.
2. Never close a visually validated activity while screenshots live only in local files, comments, chat or AISH metadata.
3. Never claim a deploy without pipeline evidence and an authenticated smoke against the deployed target.
4. Never mark a job complete by editing storage, and never bypass the activity status with local tracking.
5. A failed reconciliation stays visible: report it and retry explicitly ({{ref:integrity-repair}}).

## Examples
```text
example: Done: audit <auditId> passed; jobs <jobA> completed, <jobB> completed; issue <issueId> done
Evidence: aish-pack-<jobA>.md (private-…), smoke-<releaseId>.txt (private-…), receipt providerRevision <revision>
Pending: none
```
