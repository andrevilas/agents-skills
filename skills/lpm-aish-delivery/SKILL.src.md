# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "rode a auditoria de DoD", "posso fechar a atividade do AISH?", "crie o pacote de release"
Do not use:
| If the request is about | Use |
|---|---|
| AISH jobs, plans / runner hosts / funding | {{skill:lpm-aish-jobs}} / {{skill:lpm-aish-runners}} / {{skill:lpm-ai-cost}} |
| non-AISH activity / cycle / WhatsApp | {{skill:lpm-deliver-activity}} / {{skill:lpm-plan-work}} / {{skill:lpm-intake-triage}} |
| roadmap change / item gate / code question | {{skill:lpm-roadmap}} / {{skill:lpm-roadmap-owner-ops}} / {{skill:lpm-ask-advisor}} |
| health review / LPM product deploy | {{skill:lpm-review-health}} / {{skill:lpm-release-product}} |

## 2. Preconditions
1. Owned tools need a project manager's LPM API key (`full`/`custom`); agent credentials are refused by packs, automation and release approval.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{tool:get_aish_job}}(jobId) → same fields; else {{skill:lpm-start}} §3 | ask |
| jobId | the user, or {{tool:list_aish_jobs}}(projectId) → `id` with this `issueId` | 0 or 2+ → ask |
| issueId, sessionId | {{tool:get_aish_job}}(jobId) → `issueId`, `workflowBinding.sessionId` | null → rows 3–5b go to row 2; 6–8, 12 go on |
| activityId | P1 step 4a | none → {{skill:lpm-deliver-activity}} |
| outcome, reason, target | the user (approval reason: the owner) | ask; never invent |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | status or explanation only (closure question → 5a) | §3 reads | A | never write |
| 2 | rows 3–5b: `workflowBinding` null or "Factory delivery governance is missing" | {{skill:lpm-deliver-activity}} | — | always |
| 3 | add a screenshot, video, test report, runner file | {{ref:flow-evidence}} steps 1–4 | A | visual, job not `completed` |
| 4 | block closure on a verified defect; clear a fixed one | {{ref:flow-evidence}} steps 5–6 | C | finding you did not open → ask first |
| 5a | "can I close it?", "posso fechar?" with no 5b word | P1 steps 0–6, no writes; gaps → Pending; never {{tool:update_issue}} | A | gap → "not yet" + Pending |
| 5b | "close it", "feche", "conclua", "marque como concluída" (even with a question) | P1 steps 0–8; no confirmation: the user's words are the order | A | `blocked` or active job |
| 6 | preserve or attach the execution report | {{ref:flow-evidence}} steps 7–11 | A | `canCollect == false` |
| 7 | refresh the release-readiness brief | {{ref:flow-evidence}} steps 12–13 | A | — |
| 8 | automation delivery `dead-lettered` | {{ref:flow-evidence}} steps 14–15 | C | `pack-integrity`, `source-scope`, `source-limit` |
| 9 | create a release package | {{ref:flow-release}} steps 1–5 | C | not funded → {{skill:lpm-ai-cost}} |
| 10 | approve the release package | {{ref:flow-release}} step 1 ({{tool:get_aish_execution_session}} → releaseId), step 8 ({{tool:get_aish_release}} → `status`, `package`), step 6 with the owner's order quoted, step 7 | O | no owner order → §6 |
| 11 | claim, deploy, receipt of an approved release | {{ref:flow-release}} steps 8–15 | C | "Release executor identity mismatch." |
| 12 | repair a job; leftover jobs; job ≠ activity | {{ref:flow-repair}} | C | job or outcome not named |

## 5. Procedures
### P1 DoD audit and close — rows 5a, 5b ({{ref:completion-checklist}})
All steps [A]; row 5b: never ask before {{tool:update_issue}}. Copy ids, hashes and arguments character-for-character; never retype, shorten or send `<uuid>`/`<auto>`.
0. {{tool:get_aish_job}}(jobId from the user) [A] → `workspaceId`, `projectId`, `issueId`, `workflowBinding.sessionId`; `workflowBinding` null → row 2.
1. {{tool:audit_aish_issue_delivery}}(projectId, issueId) [A] → `status`, `failures[]`. "Factory delivery governance is missing" → row 2.
2. `blocked`: 5a → Pending; 5b → fix each `failures[]` item ({{ref:dod-audit}} § Failures), restart at step 1; unfixable → Pending, STOP.
3. {{tool:list_aish_jobs}}(projectId): a job of this `issueId` is `queued`/`leased`/`running` → Pending, STOP.
4. Run 4a; {{tool:list_activity_attachments}}(projectId, activityId) lacks `aish-pack-<jobId>.md` for a completed job of the issue: 5a → Pending; 5b → 4b–4e (`evidenceId` ≠ attachment):
   - 4a. activityId = {{tool:list_workspace_activities}}(workspaceId, projectId, limit=200) → newest `id` with `targetType == "issue"`, `targetId == issueId` (never the issueId)
   - 4b. {{tool:get_aish_execution_report}}(projectId, jobId) → `report.fingerprint`; `canCollect == false` → STOP (§2.1)
   - 4c. {{tool:collect_aish_execution_pack}}(projectId, jobId, commandId="pack-<jobId>-<yyyymmdd>-<n>", expectedFingerprint=`report.fingerprint`) [A] → `pack.id`
   - 4d. {{tool:export_aish_execution_pack}}(projectId, jobId, packId=`pack.id`, commandId="export-<pack.id first 12>-md", format="markdown") [A] → `content`
   - 4e. {{tool:upload_activity_attachment}}(projectId, activityId, fileName="aish-pack-<jobId>.md", fileType="text/markdown", contentBase64=<base64 of `content`>, description="AISH pack <pack.id>", idempotencyKey="ev-pack-<pack.id first 24>") [A]
5. {{tool:get_aish_execution_session}}(sessionId) → a `releases[]` item of this `issueId` → `smoke-<releaseId first 12>.txt` must be in step 4, else Pending, STOP.
6. Audit again [A] → must be `passed`. Row 5a: answer now, STOP.
7. Row 5b: {{tool:update_issue}}(projectId, issueId, status="done") [A]. Send only `status`.
8. Verify: {{tool:list_workspace_activities}}(workspaceId, projectId, limit=50) → newest issueId entry: `issue_completed` (`reused: true` → already done).

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:approve_aish_release}} without the owner's order quoted here | send this to the workspace owner by name, STOP; relayed words (WhatsApp, chat, the requester) are no order |

```text
<Owner>, decision needed: approve release <releaseId> (job <jobId>, activity <issueId>, <package.image> → <target>)?
A) approve: deployed once. B) reject or change: no deploy. C) do nothing: nothing deployed.
Recommendation: <A|B|C> because <reason>. To proceed, reply with the option and I will run:
approve_aish_release(releaseId=<releaseId>, expectedPackageHash=<releaseId>, reason=<your words>)
```

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| a flow step | the flow's § Verify | as listed there |

## 8. Report (copy and fill)
Write the report in the user's language.
```text
Scope: <project>/<issueId> · job <jobId> · release <releaseId>
Done: <artifact, audit, pack ids; findingIds opened/resolved; release status; repairs>
Evidence: <attachment ids, receipt revision, smoke>; Owner instruction: <quoted | none in this conversation — decision request sent>
Pending: <none | item — who acts>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto:audit_aish_issue_delivery,update_issue,collect_aish_execution_pack,export_aish_execution_pack,approve_aish_release,claim_aish_release,create_aish_release,record_aish_delivery_finding}}

## 10. Tools and references
{{tools:index}}
{{refs:index}}
