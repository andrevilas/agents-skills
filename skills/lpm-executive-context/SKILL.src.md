# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "o workspace está pronto?", "o que falta no contexto executivo?", missing executive roles
- "coloca a Carla como finance-owner", "define a missão", "gera a política de roteamento"
- "o domínio <nome> está sem dono", project alignment
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
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Every save of the context is [O]: only the workspace owner orders it, in this chat; a relayed "OK" (WhatsApp) is not an order.
3. Changes asked together → ONE patch, one apply.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or {{skill:lpm-start}} | ask "Which LPM workspace? (id or name)" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | the owner orders a patch already shown | playbook {{ref:flow-apply}} | O | no owner order → decision request |
| 2 | save anything: a draft, the mission, a role, `financial.*`, removing a domain or capability | playbook {{ref:flow-prepare-change}} | A | no owner order → decision request |
| 3 | a project claims an unowned domain or capability; misaligned routing profile | playbook {{ref:flow-claim-unowned}} | C | roadmap record → {{skill:lpm-roadmap}} |
| 4 | the owner wants the workspace description (no mission stored) | playbook {{ref:flow-set-description}} | C | a mission is stored |
| 5 | show an operating-model or routing-policy draft | playbook {{ref:flow-draft}} | A | one intake entry → {{skill:lpm-intake-triage}} |
| 6 | current values, who holds a role | CALL {{tool:get_workspace_executive_context}} {"workspaceId":"<input:workspaceId>"} | A | — |
| 7 | only the project alignment check | CALL {{tool:validate_workspace_project_alignment}} {"workspaceId":"<input:workspaceId>"} | A | — |
| 8 | readiness, "what is missing", gap ids, missing roles | playbook {{ref:flow-readiness}} | A | — |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| readiness | readiness review, "what is missing", gap ids or missing executive roles, with no change | {{ref:flow-readiness}} |
| draft | show a routing-policy or operating-model draft, nothing saved | {{ref:flow-draft}} |
| prepare-change | save a change to the executive context: a draft, the mission, an executive role, a financial field, or removing a domain or capability | {{ref:flow-prepare-change}} |
| apply | the workspace owner ordered a prepared executive-context patch saved | {{ref:flow-apply}} |
| claim-unowned | a project claims an unowned domain or capability, or a project routing profile is misaligned | {{ref:flow-claim-unowned}} |
| set-description | missing-mandate:mission is open and the owner wants the workspace description set, not the mission | {{ref:flow-set-description}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no workspaceId | "Which LPM workspace? (id or name)" |
| "fix routing" through a policy | "Routing follows project routing profiles. Change those instead?" |

## 7. Verify
| After | Re-read with (wait 6 s) | Pass when |
|---|---|---|
| apply | {{tool:get_workspace_executive_context}}, {{tool:generate_workspace_readiness_report}} | `lastReviewedAt` changed, fields match, gap ids gone |
| routing profile | {{tool:get_project}}, {{tool:generate_workspace_readiness_report}} | string listed, gap id gone |
| description | {{tool:get_workspace_executive_context}} | `mandate.mission` = the new text |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: workspace <name> (<workspaceId>)
Done: <review only, nothing changed | audit <auditEventId>; owner order: "<quote>" | <projectId> owns <string>>
Evidence: readiness <status> (score <report.score>) | readiness <before → after>, score <before → after>; closed <gap ids | none>
Pending: none | <gap id or "<field>: <message>"> → <fix> — <who decides>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "patch is invalid" | the whole `proposedPatch` was sent, or an empty role/userId → rerun prepare-change |
| "require human confirmation" | rerun playbook apply (it sends `confirmSensitiveChanges: true`) |
| "You do not have permission" | hand the patch to the owner; never look for another credential |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
