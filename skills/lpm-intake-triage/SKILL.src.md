# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: "status do protocolo <código>?", "roteie esta demanda do WhatsApp", "faça a triagem das entradas", "merge duplicate bug reports"
Do not use:
| If the request is about | Use |
|---|---|
| AISH job files / AISH delivery | {{skill:lpm-aish-jobs}} / {{skill:lpm-aish-delivery}} |
| activity evidence / owner, cycle, dates | {{skill:lpm-deliver-activity}} / {{skill:lpm-plan-work}} |
| other project settings / routing policy | {{skill:lpm-workspace-admin}} / {{skill:lpm-executive-context}} |
| another workspace / project health | {{skill:lpm-unblock-work}} / {{skill:lpm-review-health}} |
| roadmap / change set / code | {{skill:lpm-roadmap}} / {{skill:lpm-requirements-scope}} / {{skill:lpm-ask-advisor}} |

## 2. Preconditions
1. CLI and the WhatsApp channel: {{ref:limits}}.
2. Row 3: {{tool:list_workspaces}} (no `compact`) → row `id == workspaceId` → `access.canManage == true`, else say "Routing needs the workspace owner or an admin: ask them to choose." and STOP. Call fails, no row, or no `access` → give the error text, say "I could not confirm you can review routing in <workspaceId>." and STOP; "I am the owner" is not proof. Row 13: {{tool:get_project}} → same field. No other role check.
3. Other workspace: {{skill:lpm-unblock-work}} ({{tool:create_portfolio_work_item_link}} [C]).
4. Read-only request → no write. AI calls: {{ref:ai-cost-and-budgets}}.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{skill:lpm-start}} §3, or {{tool:get_protocol}}(protocolCode) → `workspaceId` | ask |
| protocolCode | user (`NAMESPACE-YYYYMMDD-NNNN`) | ask |
| intakeEntryId | user, or {{tool:get_protocol}} → `intakeEntryId` | STOP "No tool lists intake entries: send the protocol code or entry id." |
| projectId | the project the user names → {{skill:lpm-start}} §3; routing: {{ref:flow-routing}} step 3 | ask |
| entryId | {{tool:list_operational_entries}}(projectId) → `items[].id` | ask |
| issueId | user, or {{tool:list_issues}}(projectId) → `id` (same project) | ask |
| assigneeId | {{tool:list_project_assignable_members}}(projectId) → `uid` | omit |
| decision, reason, type, file metadata | user | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | status or trail of a protocol | {{tool:get_protocol}} → {{tool:get_protocol_lineage}}; files: {{tool:list_protocol_evidence}} | A | not found → ask |
| 2 | which project gets an intake entry or text | P1 | A | no intakeEntryId, title, description |
| 3 | routing decision on an intake entry or protocol (intakeEntryId/protocolCode) | §2 item 2 ({{tool:list_workspaces}} → `access.canManage`) → P1 → {{ref:flow-routing}} steps 0–8 ({{tool:review_workspace_routing}}) | C | P1 not run; approve-primary/split without explicit `selectedProjectId(s)` |
| 4 | register a report in a project the user names | {{ref:flow-routing}} steps 9–13 ({{tool:create_operational_entry}}) | C | project not resolved |
| 5 | register a report, project unknown | P1, then {{ref:flow-routing}} steps 9–13 | C | the user names no project |
| 6 | curation decision on an operational entry (entryId or a listed entry) | {{ref:flow-curation}} steps 1–6 | C | decision not in the user's words |
| 7 | find or merge duplicates | {{ref:flow-curation}} steps 7–11 | C | entry that stays not named |
| 8 | AI triage proposal for one entry | {{ref:flow-curation}} step 12 ({{tool:suggest_operational_entry}}) | A | never in a loop |
| 9 | turn an entry into an activity | {{ref:flow-curation}} steps 13–15 ({{tool:convert_operational_entry_to_issue}}) | C | `relatedTaskId` set → report it |
| 10 | attach a stored file to a protocol | {{tool:list_protocol_evidence}} → no same `sha256` → {{tool:create_protocol_evidence_attachment}}(workspaceId, intakeEntryId, kind, file metadata) | A | not stored → "Store and sanitize the file first." |
| 11 | log a reply as sent, failed or pending | {{tool:get_protocol}} → {{tool:record_workspace_delivery_receipt}}(workspaceId, intakeEntryId, status) | C | no real send attempt |
| 12 | queue health, SLA | {{tool:get_operational_analytics}}(projectId) → `metrics.healthStatus`, `breachedCurationSlaCount`; {{tool:list_unowned_domains_or_capabilities}}(workspaceId) | A | context edits → {{skill:lpm-executive-context}} |
| 13 | empty profiles (completeness < 0.5) | {{tool:get_project}} → owner-approved `routingProfile` → {{tool:update_project}}(projectId, routingProfile) | C | `access.canManage` not true |

approve/reject/defer + intake/protocol → row 3; + operational entry/bug/incident → row 6; unclear → ask which one.

## 5. Procedures
### P1 Preview routing — rows 2, 5
1. {{tool:preview_workspace_routing}}(workspaceId, intakeEntryId, limitCount=5), or (workspaceId, title, description) → keep `outcome`, `candidates[]`.
2. Show each candidate's `projectName`, `score`, `signals`, `matchedTerms`, `routingProfileCompleteness` ({{ref:routing-ranker}}).
3. `single-project` → recommend `candidates[0]` with its `matchedTerms`; a keyword match is not proven ownership.
4. `ambiguous`, `multi-project`, `no-match` → STOP: show the candidates; the user chooses (§6). Never pick. Completeness < 0.5 → offer row 13.

## 6. Stop and ask
Ask in the user's language: translate the template, keep ids, enum values and the quoted reason verbatim; yes/no → sim/não in PT-BR.

| Situation | Do / ask exactly |
|---|---|
| preview not `single-project` | "Routing for '<title>' is <outcome>: <name — score — matchedTerms>. Which project, split, reject or defer?" |
| WhatsApp group (`@g.us`) | "This came from a group chat. Who reviews it before routing?" |
| receipt / profile | "Record reply <status> for <protocolCode>? It sends nothing." / "Replace <project> routing profile with <object>?" (yes/no) |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| rows 3–9 | the flow's § Verify | all pass |
| {{tool:create_protocol_evidence_attachment}} | {{tool:list_protocol_evidence}} | new `id` listed |
| {{tool:record_workspace_delivery_receipt}} | {{tool:get_protocol}} | `lastPublicStatus` matches |
| {{tool:update_project}} | {{tool:get_project}} | `routingProfile` as sent |

## 8. Report (copy and fill)
Report only results you read back in this conversation; never write the report before the calls ran. Evidence lists each verify as pass or mismatch.
Stopped at a [C] question → Scope, Evidence (preview outcome, candidates[0] name/score/matchedTerms, `operationalEntryIds` empty), Pending: <the exact question> — user acts.
```text
Scope: <workspace>/<protocolCode or intakeEntryId>/<project(s)>
Done: <decision id + action>, <entry ids + curationState>, <issueId>, <receipt id>
Evidence: <preview outcome + signals>, <read-back fields>
Pending: <who acts next and on what; 'none' only if nothing is left>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| timeout or "Invalid workspace intake status transition" from {{tool:review_workspace_routing}} | never re-call; {{ref:flow-routing}} step 5 |
| any other error | {{ref:tools}} |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
