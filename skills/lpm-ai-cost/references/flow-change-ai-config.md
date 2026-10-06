# Playbook: change-ai-config
Use when: change the workspace AI model, a usage limit, a feature flag, enabled or the providers, on the owner's order (no order: send the decision request)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user (an id) | "none" (step 2 finds it by name) |
| workspaceName | the user (a name) | "none" |
| field | the one setting the request changes: `enabled`, `defaultProvider`, `allowedProviders`, `models.requirementsDocumentAnalysis`, `models.embedding`, `models.operationalEntrySuggestion`, `featureFlags.requirementsDocumentAnalysis`, `featureFlags.embeddings`, `featureFlags.operationalEntrySuggestion`, `usageLimits.dailyTokenBudget`, `usageLimits.monthlyTokenBudget`, `usageLimits.dailyRequestLimit` | STOP. Say: "Which AI setting: a model, a limit, a feature, or AI on/off? One change per run." |
| value | the new value in the request: true/false, a number ≥ 0, a model id or nickname ("Pro"), a provider | "none" |
| ownerOrder | the owner's own words in this conversation ordering this exact change, quoted | "none" |
| advisorOk | "yes" when the user already said yes to the step 7 question in this conversation | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. The AI policy was not changed."
1. IF <input:workspaceId> is not "none" → SAVE: workspaceId = <input:workspaceId>; workspaceName = <input:workspaceName>; go to step 3.
2. CALL {{tool:list_workspaces}} {"compact":true} [A]
   SAVE: workspaceId, workspaceName = id and name of the one item whose name equals <input:workspaceName> (ignore case and accents)
   IF no item or 2+ items match → STOP. Say: "Which LPM workspace? (id or name)"
3. CALL {{tool:get_workspace_ai_config}} {"workspaceId":"<saved:workspaceId>"} [A]
   SAVE: old = the value of <input:field> in result; provider = result.defaultProvider; limits = result.usageLimits
   SAVE: kind = "advisor-off" when <input:value> is false for `enabled` or `featureFlags.requirementsDocumentAnalysis`, or not "gemini" for `defaultProvider`, or 0 for a `usageLimits` field; else "model" when <input:field> starts with "models."; else "change"; operation = <input:field> without "models."
   SAVE: effect = advisor-off → "the Advisor also stops: every answer_* call returns ai_disabled (a limit of 0: ai_usage_limit_reached)"; `models.embedding` → "stored embeddings stay from the old model until backfilled"; other model → "the model id is not validated on write: a typo breaks Advisor answers"; a limit → "AI calls stop at the new limit with ai_usage_limit_reached"; else "only that setting changes"
   IF <input:value> is "no limit" or null → STOP. Say: "A limit cannot be set back to 'no limit' over MCP (null keeps the old value). Nothing was changed."
   IF <input:value> == <saved:old> → STOP. Say: "<input:field> is already <saved:old>. Nothing was changed."
   IF <input:ownerOrder> == "none" → STOP. Say: "Owner decision: <input:field> <saved:old> → <input:value> (proposed), workspace <saved:workspaceId>. A) apply: <saved:effect>; B) owner chooses a different value; C) keep current policy. Recommendation: <A or C and evidence>. Scope: <input:field>; benefit: <user reason>; budget: <saved:limits>; fallback: no AI; owner: workspace owner; review date and rollback trigger: owner to set. Reply with the chosen option and exact value."
   IF <input:value> == "none" → STOP. Say: "Which exact value for <input:field>? I will not choose it."
4. IF <saved:kind> != "model" → SAVE: new = <input:value>; go to step 6.
5. CALL {{tool:list_workspace_ai_provider_models}} {"workspaceId":"<saved:workspaceId>","provider":"<saved:provider>","operation":"<saved:operation>"} [A]
   SAVE: new = the item id equal to <input:value>, else the one item id that contains <input:value> (ignore case) with supportsOperation true, isPreview false and isDeprecated false
   IF result.source == "unavailable" or result.models is empty → ASK: "No model list (<result.unavailableReason>). Ids are not validated on write: a typo breaks the Advisor. Use exactly <input:value>? (yes/no)" — continue only if the user says yes; otherwise STOP.
   IF result.source == "unavailable" or result.models is empty → SAVE: new = <input:value>; go to step 6.
   IF no id or 2+ ids match → STOP. Say: "Which model exactly? Candidates: <the matching ids>."
6. IF <saved:kind> != "advisor-off" or <input:advisorOk> == "yes" → go to step 8.
7. ASK: "This also turns the Advisor off: every answer_* call will return ai_disabled. Set <input:field> to <saved:new> in <saved:workspaceId>? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was changed."
8. CALL {{tool:get_workspace_ai_config}} {"workspaceId":"<saved:workspaceId>"} [A]
   Always make this call right before the write, also after the yes of step 7; never reuse the step 3 read.
   SAVE: before = result; enabled = result.enabled; provider = result.defaultProvider; providers = result.allowedProviders; models = result.models; flags = result.featureFlags; limits = result.usageLimits
   SAVE: old = the value of <input:field> in result; expected = a deep copy of result with only <input:field> replaced by <saved:new>; enabled = expected.enabled; provider = expected.defaultProvider; providers = expected.allowedProviders; models = expected.models; flags = expected.featureFlags; limits = expected.usageLimits
9. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Only the workspace owner can order this change."
10. CALL {{tool:update_workspace_ai_config}} {"workspaceId":"<saved:workspaceId>","enabled":"<saved:enabled>","defaultProvider":"<saved:provider>","allowedProviders":"<saved:providers>","models":"<saved:models>","featureFlags":"<saved:flags>","usageLimits":"<saved:limits>"} [O]
   VERIFY: CALL {{tool:get_workspace_ai_config}} {"workspaceId":"<saved:workspaceId>"} [A]
   IF the call returns an error or any policy field differs from <saved:expected> (ignore source, updatedAt, updatedBy) → STOP. Say: "The AI policy change is not verified; report the actual fields returned."
   SAVE: after = the value of <input:field> in result; updatedAt = result.updatedAt

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId> (<saved:workspaceName>)
Done: <update_workspace_ai_config: <input:field> <saved:old> → <saved:after>; owner order: "<input:ownerOrder>" | nothing changed; owner order: <"<input:ownerOrder>" | none>>
Evidence: <get_workspace_ai_config → <input:field> = <saved:after> (updatedAt <saved:updatedAt>); other policy fields unchanged | get_workspace_ai_config → <input:field> = <saved:old>>
Pending: <none | the Advisor now answers with ai_disabled | stored embeddings stay from the old model until backfilled>; AI spend is visible only in the web UI (not over MCP)
Next: <the ASK or STOP text that ended the run | to undo, the owner orders <input:field> back to <saved:old> (this playbook)>
```
Never claim an unverified change.
