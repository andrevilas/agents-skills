# Flow: Copilot proposal and owner decision
Load when: decision row 10 of SKILL.md

## Preconditions
1. Every Copilot call, reads included, needs the managing human's own `full` user API key. `custom` profiles, agent credentials and OAuth connectors are refused ("Copilot requires a managing user and an unrestricted user credential.") → use {{tool:list_aish_jobs}} or {{tool:get_aish_budget}} directly; STOP the Copilot flow.
2. Copilot proposes only 3 tools: `list_aish_jobs`, `get_aish_budget`, `create_aish_execution_session`. Anything else → native tools.
3. A proposal runs nothing; approving `create_aish_execution_session` creates only a `draft` session.

## Steps
1. {{tool:list_copilot_conversations}}(projectId) → reuse a `conversations[].id` the user names; else {{tool:create_copilot_conversation}}(projectId, commandId="copilot-<projectId>-<n>", title ≤160) [A] → keep `conversation.id` (= conversationId).
2. {{tool:propose_copilot_action}}(projectId, conversationId, commandId="propose-<conversationId first 8>-<n>", prompt ≤4000 (no secrets), tool) [A] → keep `action.id` (= actionId), `action.proposalHash`.
3. Show the tool, the prompt and `action.arguments`; send a decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP.
4. Only on the owner's quoted order (approve or reject) for this actionId, given after step 3: {{tool:decide_copilot_action}}(projectId, conversationId, actionId, expectedHash=`proposalHash`, decision, reason = the owner's own words, 8–1000 chars) [O].
5. Verify: {{tool:get_copilot_conversation}}(projectId, conversationId) → the `actions[]` item with `id == actionId` has `status` `completed` or `rejected`. `approved` without `completed` → repeat step 4 with the same decision and reason.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no owner order for step 4 | decision request; the owner decides here or in the web Copilot. STOP |
| "Copilot decision is immutable." | report the recorded decision; a change needs a new proposal (step 2) |
| "Start a new Copilot conversation; action limit reached." | step 1 with a new conversation |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| propose (step 2) | {{tool:get_copilot_conversation}} | `actions[]` holds `actionId` with `status == "pending"` |
| decide (step 4) | {{tool:get_copilot_conversation}} | that action's `status` is `completed` or `rejected` |

## Report fields
- conversationId, actionId, tool, `proposalHash`, action `status`
- owner order (verbatim quote) for step 4; `result.summary` and `result.href`
- pending: owner decision — who must act
