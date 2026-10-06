# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "o código já faz <X>?", "is <feature> implemented?"
- "onde está <identifier>?", "show the exact lines of <path>"
- "impacto técnico do item <ABC-12>", "analise o roadmap"
Do not use:
| If the request is about | Use |
|---|---|
| building, refreshing or activating an index; rescanning | {{skill:lpm-code-index}} |
| roadmap records or a change request | {{skill:lpm-roadmap}} |
| project health from records only | {{skill:lpm-review-health}} |
| the AI budget, model or policy | {{skill:lpm-ai-cost}} |
| saving an analysis as a knowledge note | {{skill:lpm-knowledge}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Read-only. Cheapest first: analysis (no AI) → code search (daily quota) → one Advisor answer (AI budget). A scheduled monitor searches or asks the Advisor only on an owner order.
3. Every playbook works on a connector (scope mcp:advisor); none needs a KEY tool.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project?" |
| workspaceId | the user, or {{skill:lpm-start}} | ask "Which LPM workspace?" |
| itemRef | item id, code (ABC-12) or title words | ask "Which roadmap item?" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | does one project's code do X; where is Y | playbook {{ref:flow-code-question}} | A | no projectId |
| 2 | where is Y in any project of a workspace | playbook {{ref:flow-workspace-code-question}} | A | no workspaceId |
| 3 | exact lines of a file | playbook {{ref:flow-exact-lines}} | A | path not in a search hit |
| 4 | analyze a roadmap; items without code | playbook {{ref:flow-roadmap-analysis}} | A | no impact call per item |
| 5 | one roadmap item: analysis or technical impact | playbook {{ref:flow-item-impact}} | A | 2+ matches; no allocation |
| 6 | an Advisor answer, or a playbook's Next offers it | playbook {{ref:flow-advisor}} | A | already asked in this chat |
| 7 | a project's repositories and scans | CALL {{tool:get_project_repository_context}} {"projectId":"<input:projectId>"} | A | scan > 24 h → "stale" |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| code-question | does one project's code do X, or where is Y in it | {{ref:flow-code-question}} |
| workspace-code-question | where is Y in the code of any project of a workspace | {{ref:flow-workspace-code-question}} |
| exact-lines | show the exact lines of a file at the indexed commit | {{ref:flow-exact-lines}} |
| roadmap-analysis | analyze a whole roadmap, or which roadmap items have no code yet | {{ref:flow-roadmap-analysis}} |
| item-impact | analysis or technical impact of one roadmap item | {{ref:flow-item-impact}} |
| advisor | one LPM Advisor answer about a project, a roadmap item or a roadmap | {{ref:flow-advisor}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| allocate or change roadmap records ("já aloca") | changes nothing here: STOP → {{skill:lpm-roadmap}} (change request; a reviewer decides) |
| create a roadmap item | STOP → {{skill:lpm-roadmap}}: no change-request path in enforce mode; only an explicit owner order allows the direct create (draft) |
| AI budget, AI on/off, model | owner decision → {{skill:lpm-ai-cost}}, STOP |
| "is it in production?" | "Repository code is not proof of production." |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| any answer (no writes) | saved hits, excerpts, citations | each Fact is `path:x-y@sha7` of this run; `codeEvidence.status` stated |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspaceId>/<project | item | roadmap> — "<question>"
Done: Answer: <1-3 sentences>; calls: <tools>; Advisor calls: <0 | 1>
Evidence: Facts: <F1 claim — path:x-y@sha7 (documentKind)> | none. Inferences: <I1 claim — certainty — from …> | none
Pending: Limitations: <…>; code is not proof of production. Risks: <…> | none. codeEvidence.status=<value | no Advisor call>; aiMode=<…>; correlationId=<…>
Next: <the ASK or STOP text that ended the run> | <one action> | none
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| REPOSITORY_LINK_NOT_FOUND, PATH_NOT_INDEXED | take repositoryLinkId and path from a search hit of this run; rerun |
| "quota exhausted", OPERATION_FAILED | no more searches today → {{skill:lpm-ai-cost}} |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
