# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- <3–6 bullets: literal request phrasings, EN and PT-BR>
Do not use:
| If the request is about | Use |
|---|---|
| <notFor.when> | {{skill:<sibling-id>}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. <one rule that holds for every playbook: access, role or repository; the playbooks repeat it as steps>
3. A question ("<PT-BR question>") → reads only until the playbook asks.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user, or {{skill:lpm-start}} | ask "Which LPM project? (id or name)" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | <a question that one read answers> | CALL {{tool:<read_tool>}} {"projectId":"<input:projectId>"} | A | <empty result → what to say> |
| 2 | <job in the user's words> | playbook {{ref:flow-TEMPLATE}} | <strictest tag in that playbook: A·C·O> | <one cue; the playbook holds every stop> |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| TEMPLATE | <the playbook's "Use when:" text, word for word> | {{ref:flow-TEMPLATE}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| <a stop that applies before any playbook starts> | "<exact question>" |
| <[O] tool needed without an owner instruction in this conversation> | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| <write done by a playbook> | {{tool:<read_tool>}} | <field condition> |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace / project / ids>
Done: <state changes with ids>
Evidence: <attachment ids / citations / receipts> | none
Pending: none | <exact item> — <who must act>
Next: <the ASK or STOP text that ended the run> | <one action>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| <an error that no playbook handles> | <one action> |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
