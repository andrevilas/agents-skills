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
2. Finding resolution normally requires a different authenticated author/reviewer. The explicit owner-authorized SOLO exception needs the existing owner's credential and bound decision/report/validation; follow {{ref:owner-solo-finding}}. It is not independent review.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{tool:get_aish_job}}(jobId) → same fields; else {{skill:lpm-start}} §3 | ask |
| jobId | the user, or {{tool:list_aish_jobs}}(projectId) → `id` with this `issueId` | 0 or 2+ → ask |
| issueId, sessionId | {{tool:get_aish_job}}(jobId) → `issueId`, `workflowBinding.sessionId` | null → rows 3–5b go to row 2; 6–8, 12 go on |
| activityId | {{tool:list_workspace_activities}} → the issue feed entry id, never issueId | none → {{skill:lpm-deliver-activity}} |
| outcome, reason, target | the user (approval reason: the owner) | ask; never invent |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | status or explanation only (closure question → 5a) | §3 reads | A | never write |
| 2 | rows 3–5b: `workflowBinding` null or "Factory delivery governance is missing" | {{skill:lpm-deliver-activity}} | — | always |
| 3 | add a screenshot, video, test report, runner file | {{ref:flow-evidence}} | A | visual, job not `completed` |
| 3b | owner explicitly requests the SOLO exception for their own fixed finding | {{ref:owner-solo-finding}} | O | missing concrete owner decision or native evidence |
| 4 | block closure on a verified defect; clear a fixed one | {{ref:flow-finding}} | C | finding you did not open → ask first |
| 5a | "can I close it?", "posso fechar?" with no 5b word | {{ref:flow-close}} with order="question"; evidence gaps → Pending | A | gap → "not yet" + Pending |
| 5b | "close it", "feche", "conclua", "marque como concluída" (even with a question) | {{ref:flow-close}} with order="close"; the user's words are the order | A | `blocked` or active job |
| 6 | preserve or attach the execution report | {{ref:flow-pack}} | A | `canCollect == false` |
| 7 | refresh the release-readiness brief | {{ref:flow-automation}} | A | — |
| 8 | automation delivery `dead-lettered` | {{ref:flow-automation}} | C | `pack-integrity`, `source-scope`, `source-limit` |
| 9 | create a release package | {{ref:flow-release-create}} | C | not funded → {{skill:lpm-ai-cost}} |
| 10 | approve the release package | {{ref:flow-release-approve}} | O | no owner order → §6 |
| 11 | claim, deploy, receipt of an approved release | {{ref:flow-release-deploy}} | C | "Release executor identity mismatch." |
| 12 | repair a job; leftover jobs; job ≠ activity | {{ref:flow-repair}} | C | job or outcome not named |
| 13 | replace a failed delivery session by an equivalent completed successor | {{ref:session-replacement}} | O | no explicit owner order or resolved decision naming both sessions |

## 5. Procedures
### P1 DoD audit and close — rows 5a, 5b
1. Open {{ref:flow-close}}. A readiness question uses order="question"; an explicit closure instruction uses order="close".
2. Follow its evidence, active-job, audit and read-back checks. When it switches to pack, complete {{ref:flow-pack}} and return to close.
3. Verify: report closure only after the final read shows status done. A completed job alone is not a completed activity.

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
| a flow step | the selected flow’s VERIFY or Verify section | as listed there |

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
