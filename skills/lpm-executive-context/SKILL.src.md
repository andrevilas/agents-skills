# Workspace executive context
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when: readiness ("prontidão"), context gaps, executive roles, the mission, policy drafts, "domínio sem dono", alignment, an approved patch.
Do not use:
| If the request is about | Use |
|---|---|
| project settings, roles, members | {{skill:lpm-workspace-admin}} |
| roadmap capability records | {{skill:lpm-roadmap}} |
| routing one intake entry | {{skill:lpm-intake-triage}} |
| delivery health, risks | {{skill:lpm-review-health}} |
| budgets, AI limits, models | {{skill:lpm-ai-cost}} |
| API keys, agent credentials | {{skill:lpm-access}} |

## 2. Preconditions
1. Review-only → no write; drafts save nothing. Apply: owner or admin runs it, only the owner orders it.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{skill:lpm-start}} §3 | ask |
| userId (role holder) | {{tool:list_workspace_members}}(workspaceId) → `userId` of the named member | 0 or 2+ → ask |
| owner userId | {{tool:get_workspace_executive_context}}(workspaceId) → `workspace.ownerId` (`requestedBy`) | ask |
| patch, reason | P3 step 5 (never the whole `proposedPatch`) | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | readiness, "what is missing" | P1 | A | fix asked → the gap's row ({{ref:gap-ids}}) |
| 2 | connector, or -32003 on an API-key tool | {{tool:generate_workspace_readiness_report}}, {{tool:validate_workspace_context_completeness}}; roles: {{tool:get_workspace_executive_context}} → `executiveContext.governance.missingRoles`; alignment: {{tool:validate_workspace_project_alignment}} | A | draft or apply → "needs an LPM API key" |
| 3 | missing executive roles | P1 → `missing-governance-role:<role>` ids; holders: row 12 | A | — |
| 4 | assign or remove an executive role | P3 with `governance.assignmentsToAdd` / `assignmentsToRemove` | O | no owner order naming role + person → §6 row 1 |
| 5 | unowned domain/capability, project alignment | {{ref:flow-claim-unowned}} | C | roadmap record → {{skill:lpm-roadmap}} |
| 6 | set or change the mission | P3 with patch `{"mandate":{"mission":"<owner text>"}}` | O | no owner text → ask; description only → row 13 |
| 7 | operating model, decision/escalation/release policy | {{tool:draft_workspace_operating_model}}(workspaceId) → P2 | A | — |
| 8 | routing or priority policy, curation SLA | {{tool:draft_workspace_routing_policy}}(workspaceId) → P2 | A | one intake entry → {{skill:lpm-intake-triage}} |
| 9 | any `financial.*` (`currency`, `hourlyRateDefault`, `budgetPolicy`) | P3 | O | not the owner's own words (an admin's "yes" is not enough) → §6 row 1 |
| 10 | apply a shown patch | P3 | O | not approved → draft/reads first, then decision request (P3 step 1); `financial.*`/roles → owner's own words only |
| 11 | remove a domain/capability from the context | P3, full list minus the item | O | never just to silence a gap |
| 12 | current values, role holders | {{tool:get_workspace_executive_context}}(workspaceId) | A | — |
| 13 | `missing-mandate:mission` listed + owner wants a workspace description | {{tool:update_workspace}}(workspaceId, description=<owner text>) [C] | C | the mission itself → row 6 |

## 5. Procedures
### P1 Readiness review — rows 1, 2
1. {{tool:generate_workspace_readiness_report}}(workspaceId) → keep `report.status`, `report.score`, `report.blockers[].id`, `report.warnings[].id`. `report == null` → STOP: "LPM cannot build this context."
2. {{tool:validate_workspace_context_completeness}}(workspaceId) → keep `validation.status` (§8 completeness), `validation.issues[]`.
3. API key: {{tool:list_workspace_context_gaps}}(workspaceId) → keep `items[]`.
4. Map every gap id and gapless issue to row + decider ({{ref:gap-ids}}): policy gaps (`missing-priority-policy:*`, `missing-routing-policy:*`, `delivery` SLA) → "row 8 → 10, owner approves"; unowned domain → "row 5, owner picks the project"; removal (row 11) only on the owner's order, never offered to clear a gap.
### P2 Show a draft — rows 7, 8
1. `draft == null` → STOP as P1. Show `draft.proposedPatch.patch` verbatim with `draft.review.touchedAreas`, `draft.rationale`, `draft.assumptions`.
2. Say "policies are descriptive and do not change project routing profiles". Owner edits → rebuild ({{ref:patch-semantics}}), show again. Never apply here.
3. Say which gap ids it closes: routing-policy only `missing-priority-policy:*`, `missing-routing-policy:*` (+ `delivery` SLA issue), never `unowned-*` even if in `sourceGapIds`; operating-model none.
### P3 Apply an owner-approved patch — rows 4, 6, 9, 10, 11
1. No owner approval of this exact patch here → still run the [A] steps: P2 if a draft is asked; {{tool:get_workspace_executive_context}} → `workspace.ownerId`, `.access.canManage`, `executiveContext.governance.missingRoles`; {{tool:list_workspace_members}} for a named holder (0 or 2+ → ask). Then send the owner the decision request with the exact step-5 call (all 5 args); STOP.
2. `before`: P1 from here, else {{tool:generate_workspace_readiness_report}}(workspaceId) → keep `report.status`, `report.score`, gap ids.
3. {{tool:get_workspace_executive_context}}(workspaceId) → `workspace.access.canManage` false → §6 row 2. Keep `executiveContext.metadata.lastReviewedAt` (`before`) and `.governance.assignments[]`.
4. Check the patch ({{ref:patch-semantics}}). Sensitive field (any draft) → `confirmSensitiveChanges=true`. Two approved patches → §6 row 5.
5. {{tool:apply_workspace_context_update}}(workspaceId, reason=`draft.proposedPatch.reason` (any draft patch, even owner-edited; owner's words only for an owner-written one), patch=`draft.proposedPatch.patch` or the owner's, confirmSensitiveChanges, requestedBy=`workspace.ownerId`) [O] → keep `auditEventId`, `changedFields`, `validationIssues`, `appliedAt`. No `idempotencyKey`; retry only per step 6.
6. Timeout → wait 6 s, redo step 3: `lastReviewedAt` changed + fields match → applied; else retry once, same patch.
7. Verify: §7 row 1. A second apply only after it passed.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| {{tool:apply_workspace_context_update}} [O] without the owner's order for this exact patch | P3 step 1: reads first, then the decision request ({{ref:authority-and-owner-decisions#decision-request}}); STOP |
| `canManage == false` | "Only the owner or an admin can run this; the owner orders it. Hand them: <patch>." STOP |
| a role, no named member | "Who should hold <role>? Members: <userEmail (userId)>." Non-member → {{skill:lpm-workspace-admin}} |
| "fix routing" via a policy | "Routing follows project routing profiles. Change those instead?" |
| two approved patches | disjoint fields → merge into ONE patch, show it, apply once; else one by one, P3 step 7 between |

## 7. Verify
| After (wait 6 s) | Re-read with | Pass when |
|---|---|---|
| apply (P3) | {{tool:get_workspace_executive_context}}, {{tool:generate_workspace_readiness_report}} | patched fields = patch; `lastReviewedAt` == `appliedAt`; closed gap ids absent |
| role change | {{tool:list_missing_governance_assignments}} | role gap absent (removal: present) |
| description (row 13) | same two | `executiveContext.mandate.mission` = owner's text; `missing-mandate:mission` absent |

## 8. Report (copy and fill)
```text
Scope: workspace <name> (<workspaceId>)
Done: <review only | auditEventId <id>, changedFields <list> | <projectId> routingProfile + "<string>">; owner instruction: "<quote>"
Evidence: <review only: readiness <status> (completeness <status>), score <readiness score> | change: readiness <before → after>, score <before → after>>; closed gap ids <ids|none>
Pending: <none | each gap id, and each gapless issue as "<field>: <message>" → row — who decides>
Next: <one action>
```
Score = `report.score`; the validation score is not the readiness score: never put it after an arrow. PT-BR request → PT-BR questions, decision request, report text; template labels stay.

## 9. Failures → fix
{{errors:auto}}

## 10. Tools and references
{{tools:index}}
{{refs:index}}
