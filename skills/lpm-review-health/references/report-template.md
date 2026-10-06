# Template: health review report
Use in: SKILL.md §8 (full report: same Scope/Done/Evidence/Pending/Next lines as the §8 block) and §7 row "the report" (P1–P4 results go here)
```text
Scope: <workspace (id)> / <project (id) | all non-archived projects | top <n> by attention> / <cycle (id) | no cycle filter>
Done: read-only review; status <healthy|watch|critical> (source: <tool>)[; LPM may have re-attached <n> orphan requirements (server side effect)]

Health summary
- Status: <healthy | watch | critical> (source: <tool>); threshold fired: <rule | none>
- Integrity: <metrics.integrity.status> — signals <id = count, ... | none | integrity breakdown not available on a connector>
- Delivery: blockedIssuesOpen <n>; avgLeadTimeDays <n>; avgCycleTimeDays <n>; throughput30d <n>; completionRate <n> % (source: <tool>)
- Scope: currentBaseline <id | none>; working-scope delta <n>; awaiting baseline <n>
- Decisions: pending <n> (source: <tool>)

Main risks (facts)
- <riskId> <severity> entityCount <n> — evidence: <entity ids | jobId + category | issueId + blockedSince> (<tool>)
- none firing (list_project_resolution_risks returned 0)

Interpretation
- <one line per finding, marked as interpretation; no new numbers, causes, people or entity details that are not in a result of this run>

Recommended actions
| Finding | Owner skill | Smallest action | Who decides |
|---|---|---|---|
| <riskId or signal> | <skill id> | <one reversible step> | <the owner | delivery lead or project owner> |

Evidence: <metric = value (tool)>; risks <riskId severity>; <portfolio counts = ownerView.portfolio (tool)>; bundle version <version | not read>
Pending: <finding → owner skill — who decides> | none
Next: <owner skill + its first step>
```

## Signal id → count field (`get_project_analytics` → `metrics.integrity.`)
| Signal id | Count field |
|---|---|
| `invalid-issue-statuses` | `invalidIssueStatuses` |
| `stale-active-cycles` | `staleActiveCycles` |
| `orphan-aish-jobs` | `orphanAishJobs` |
| `orphan-autopilot-issues` | `orphanAutopilotIssues` |
| `terminal-issue-job-mismatches` | `terminalIssueJobMismatches` |
| `requirements-updated-after-current-baseline` | `requirementsUpdatedAfterCurrentBaseline` |

## Fill rules
1. Every number comes from a tool result of this run and names its tool. No result → write "not read", never a guess.
2. Never write "healthy" while any server integrity signal fires; a stricter `integrity.status` wins and the gap is named as an LPM defect. Connector signals derived by the agent go under Interpretation as "derived by agent" and never change the status.
3. Portfolio statuses from `ownerView.projects[].healthStatus` are labelled "source: workspace read model".
4. Facts (Health summary, Main risks) and interpretation stay in separate blocks. Never promote an interpretation to a fact.
5. Every risk id is copied exactly from `risks[].id` of this run; every finding has exactly one owner skill ({{ref:integrity-signals}}).
6. `requiresHumanReview == true` → "Who decides: the owner"; the action is a recommendation, never approved; send no decision request.
7. No burndown, velocity, status distribution or trend lines: write "not returned over MCP".
8. Leave `ownerView.finance` out unless the user asked for finance; then label it "owner-level reporting rollups", never a budget authorization.
9. The `[; LPM may have re-attached …]` part is REQUIRED when P1 step 1 `requirementsAwaitingBaseline.count` n > 0 (API key) and any owner surface, read model or risk read ran later in this run. One `Next:` line only.
10. Write every label and sentence in the user's language (PT-BR request → PT-BR report: "Escopo", "Feito", "sem filtro de ciclo"). Keep ids, tool names and riskIds verbatim.
