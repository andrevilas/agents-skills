# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "status do protocolo <código>?", "roteie esta demanda do WhatsApp"
- "registre este bug no projeto <P>", "faça a triagem das entradas"
- "merge duplicates", "convert entry <id>"
Do not use:
| If the request is about | Use |
|---|---|
| AISH jobs / delivery | {{skill:lpm-aish-jobs}} / {{skill:lpm-aish-delivery}} |
| activity evidence / planning | {{skill:lpm-deliver-activity}} / {{skill:lpm-plan-work}} |
| project settings / routing profile | {{skill:lpm-workspace-admin}} / {{skill:lpm-executive-context}} |
| other workspace / health | {{skill:lpm-unblock-work}} / {{skill:lpm-review-health}} |
| roadmap / change set / code | {{skill:lpm-roadmap}} / {{skill:lpm-requirements-scope}} / {{skill:lpm-ask-advisor}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Rows 6-14 need an LPM API key. A question → reads only.
3. Route only to ids the owner named (`selectedProjectId`), never the ranker's pick.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or {{tool:get_protocol}} | ask |
| protocolCode | the user (`NAMESPACE-YYYYMMDD-NNNN`) | ask |
| intakeEntryId | the user, or {{tool:get_protocol}} | ask |
| projectId | the user, or {{skill:lpm-start}} | ask |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | protocol status | CALL {{tool:get_protocol_lineage}} {"protocolCode":"<input:protocolCode>"} | A | not found |
| 2 | protocol files | CALL {{tool:list_protocol_evidence}} {"protocolCode":"<input:protocolCode>"} | A | — |
| 3 | which project | CALL {{tool:preview_workspace_routing}} {"workspaceId":"<input:workspaceId>","intakeEntryId":"<input:intakeEntryId>"} | A | owner picks |
| 4 | triage queue | CALL {{tool:list_operational_entries}} {"projectId":"<input:projectId>","curationState":"new"} | A | — |
| 5 | queue health, SLA | CALL {{tool:get_operational_analytics}} {"projectId":"<input:projectId>"} | A | — |
| 6 | route an intake | playbook {{ref:flow-route-intake}} | C | no project |
| 7 | split an intake | playbook {{ref:flow-route-split}} | C | not two |
| 8 | reject/defer an intake | playbook {{ref:flow-route-reject-or-defer}} | C | routed |
| 9 | register a report | playbook {{ref:flow-register-report}} | C | no project |
| 10 | classify, AI proposal | playbook {{ref:flow-classify-entry}} | C | merged |
| 11 | approve/reject/defer an entry | playbook {{ref:flow-decide-entry}} | C | no reason |
| 12 | duplicates | playbook {{ref:flow-merge-duplicates}} | C | — |
| 13 | entry → activity | playbook {{ref:flow-entry-to-activity}} | C | linked |
| 14 | protocol file or reply | playbook {{ref:flow-protocol-record}} | C | not sent |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| route-intake | route an intake to one project the owner chose | {{ref:flow-route-intake}} |
| route-split | split an intake across two projects the owner chose | {{ref:flow-route-split}} |
| route-reject-or-defer | reject or defer an intake | {{ref:flow-route-reject-or-defer}} |
| register-report | register a report without an intake entry | {{ref:flow-register-report}} |
| classify-entry | classify an entry, or get an AI proposal | {{ref:flow-classify-entry}} |
| decide-entry | approve, reject or defer an entry | {{ref:flow-decide-entry}} |
| merge-duplicates | find or merge duplicate entries | {{ref:flow-merge-duplicates}} |
| entry-to-activity | turn an entry into an activity, or link one | {{ref:flow-entry-to-activity}} |
| protocol-record | attach a stored file to a protocol, or log a reply | {{ref:flow-protocol-record}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| intake or entry? | "The intake (protocol) or the project's entry?" |
| `@g.us` group, asker not admin | "Who reviews this group message?" |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| routing | {{tool:get_protocol_lineage}} | lists the entries |
| entry write / receipt | {{tool:get_operational_entry}} / {{tool:get_protocol}} | as sent |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace>/<intake or project>/<entry>
Done: <ids changed> | nothing changed
Evidence: <read-back fields> | none
Pending: none | <who acts next>
Next: <the ASK or STOP text that ended the run> | <one action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| timeout from {{tool:review_workspace_routing}} | never re-call; read the lineage |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
