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
1. <access: which rows need an API key; connector fallback row>
2. <role/permission: e.g. caller is workspace owner/admin — {{tool:list_workspace_members}} → role>
3. <state gates: governance mode, factoryGovernance, intake status, cache windows>
4. Read-only request ("status", "explain", "review") → call no write tool in this run.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| <id> | {{tool:<tool_name>}}(<params>) → `<field>` (filter …) | ask / {{skill:lpm-start}} / STOP "<text>" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | <job in user words or an observed state> | P1 / {{tool:<a>}} → {{tool:<b>}} / {{skill:<id>}} | A·C·O | <condition → what to say or which skill> |

## 5. Procedures
### P1 <name> — rows <n>
1. {{tool:<x>}}(param=<Inputs row | step k field | constant | user>) → keep `<field>`.
2. If `<field>` == <value> → STOP: say "<exact text>". Else → 3.
3. [C] Show <exact call and effect>; continue only on "yes".
4. {{tool:<y>}}(…, idempotencyKey="<recipe>") [A|C|O].
5. Verify: {{tool:<z>}}(…) → pass when <field condition>.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| <[O] tool needed without an owner instruction in this conversation> | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| <write in §4> | {{tool:<z>}} | <field condition> |

## 8. Report (copy and fill)
```text
Scope: <workspace / project / ids>
Done: <state changes with ids>
Evidence: <attachment ids / citations / receipts>
Pending: <none | exact item — who must act>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| -32003 or tool missing | core rule 2 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
