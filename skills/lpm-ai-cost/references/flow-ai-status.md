# Playbook: ai-status
Use when: read the workspace AI policy, models, limits or spend, explain an Advisor fallbackReason, or read today's code-search quota
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user (an id) | "none" (step 2 finds it by name) |
| workspaceName | the user (a name, e.g. "Demo Plataforma") | "none" |
| fallbackReason | the user, or `advisor.fallbackReason` of an Advisor answer already in this conversation | "none" |
| fallbackDetail | `advisor.fallbackDetail` of that answer, or the error text the user pasted | "none" |
| models | "yes" when the user asks which models are available or allowed, else "no" | "no" |
| operation | "embedding" or "operationalEntrySuggestion" when the user names that use, else "requirementsDocumentAnalysis" (document analysis and the Advisor) | "requirementsDocumentAnalysis" |
| quota | "yes" when the user asks about code search (busca de código) today, else "no" | "no" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was read further and nothing was changed."
1. IF <input:workspaceId> is not "none" → SAVE: workspaceId = <input:workspaceId>; workspaceName = <input:workspaceName>; go to step 3.
2. CALL {{tool:list_workspaces}} {"compact":true} [A]
   SAVE: workspaceId, workspaceName = id and name of the one item whose name equals <input:workspaceName> (ignore case and accents)
   IF no item or 2+ items match → STOP. Say: "Which LPM workspace? (id or name)"
3. CALL {{tool:get_workspace_ai_config}} {"workspaceId":"<saved:workspaceId>"} [A]
   Never call `answer_*`, `search_*` or `analyze_*` in this playbook, not even to test a limit.
   SAVE: enabled, defaultProvider, allowedProviders, models, featureFlags, source = those fields of result
   SAVE: dailyTokens = result.usageLimits.dailyTokenBudget; monthlyTokens = result.usageLimits.monthlyTokenBudget; dailyRequests = result.usageLimits.dailyRequestLimit (each null → "no limit"; 0 → "0, blocks every AI call")
   SAVE: advisorModel = result.models.requirementsDocumentAnalysis (also the Advisor answer model); advisorFlag = result.featureFlags.requirementsDocumentAnalysis (false also turns the Advisor off: `ai_disabled`)
4. IF <input:models> == "no" → SAVE: catalog = "not read"; go to step 6.
5. CALL {{tool:list_workspace_ai_provider_models}} {"workspaceId":"<saved:workspaceId>","provider":"<saved:defaultProvider>","operation":"<input:operation>"} [A]
   SAVE: catalog = id of each item of result.models with supportsOperation true, marked "(preview)" when isPreview is true and "(deprecated)" when isDeprecated is true
   IF result.source == "unavailable" → SAVE: catalog = "unavailable: <result.unavailableReason>"; go to step 6.
6. SAVE: cause = the first line below that matches <input:fallbackReason> and <input:fallbackDetail> (else "none"):
     detail contains "daily request limit" → "usageLimits.dailyRequestLimit = <saved:dailyRequests> reached; resets at 00:00 UTC (21:00 Brasília)"
     detail contains "daily token budget" → "usageLimits.dailyTokenBudget = <saved:dailyTokens> reached; resets at 00:00 UTC"
     detail contains "monthly token budget" → "usageLimits.monthlyTokenBudget = <saved:monthlyTokens> reached; resets at the next UTC month start"
     reason "ai_disabled" and <saved:enabled> == false → "enabled is false: all workspace AI is off"
     reason "ai_disabled" and <saved:advisorFlag> == false → "featureFlags.requirementsDocumentAnalysis is false: it also turns the Advisor off"
     reason "ai_disabled" and <saved:defaultProvider> != "gemini" → "defaultProvider <saved:defaultProvider>: only gemini runs in this runtime"
     detail contains "global runtime policy" → "a deployment-wide switch: an LPM maintainer changes it, not MCP"
     reason "ai_provider_unavailable" or detail contains "not configured" → "no usable AI provider key: keys belong to skill lpm-access"
   A limit reached means the workspace used it up; it is not a bug. Never repeat the AI call.
7. IF <input:quota> == "no" → SAVE: searchLimit = "not asked"; leased = "not asked"; left = "not asked"; dateKey = "not asked"; go to Answer.
8. CALL {{tool:get_owner_agent_usage}} {"workspaceId":"<saved:workspaceId>"} [A]
   SAVE: dateKey = result.dateKey; searchLimit = result.workspace.codeSearchLimit; leased = result.workspace.codeSearchLeased; left = <saved:searchLimit> minus <saved:leased> (0 when negative)
   Answer from result.workspace only. Never add up, quote or compare the credentials[] rows, and never ask which credential is the user's: the workspace total is the answer.
   leased = code searches claimed today by every caller, the Advisor and failed searches included; it counts blocks of capacity and can exceed real use; it counts searches, not tokens or money; it resets at 00:00 UTC.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <saved:workspaceId> (<saved:workspaceName>)
Done: reads only; owner order: none; cause: <saved:cause>
Evidence: <each number you state with its source, e.g. "<saved:dailyRequests>: get_workspace_ai_config.usageLimits.dailyRequestLimit"; "<saved:leased> of <saved:searchLimit> leased, about <saved:left> left (UTC <saved:dateKey>): get_owner_agent_usage.workspace"; models: <saved:advisorModel> (Advisor), catalog <saved:catalog>>
Pending: not over MCP: requests/tokens consumed today (web UI, AI cost governance)
Next: <the ASK or STOP text that ended the run | wait for the 00:00 UTC reset, or the owner decides on a decision request to change <the named limit> (playbook change-ai-config) | none>
```
A new limit or model is "proposed", never a fact. Never claim a number that a step above did not read; never state how many requests or tokens were used (no MCP read exists).
