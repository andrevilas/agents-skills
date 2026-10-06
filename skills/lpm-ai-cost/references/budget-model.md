# AISH budget model
Load when: an AISH money question or an AISH financial write
Applies to: lpm-ai-cost    Source: lpm `src/server/aishBudgetStore.ts`, `src/server/aishFinancialPoolStore.ts`, `src/server/aishFinancialReportStore.ts`, `src/lib/aishFinancialPolicy.ts`; cards `get_aish_budget`, `configure_aish_budget`, `fund_aish_job`, `settle_aish_budget`, `get_aish_financial_pool`, `configure_aish_financial_pool`, `record_aish_financial_pool_cost`, `get_aish_financial_report`, `set_aish_financial_visibility`

## Summary
Every AISH spend needs a project budget (`issueId` null); activity budgets and pools add stricter caps on the same spend.
Funding reserves a cap for one standalone job; settlement releases what is left; both are [O].
Amounts are decimal strings; currencies never change; nothing is deleted.
`reconciliationRequired == true` on a budget or pool makes amounts unknown and blocks every decision; no MCP tool clears it.
Every write below is the owner's decision; agent credentials (`lpm_mcp_`) are refused.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `aish-budget/1` | budget contract version runners and release executors declare | their CLIs need `--budget-contract aish-budget/1` ({{skill:lpm-aish-runners}}) |
| no project budget | `budgets[]` empty | all AISH spending in the project is blocked |
| project vs activity budget | `issueId` null = project; an activity budget needs the project budget in the same currency | nested limits on the same spend: never add them |
| amounts | decimal strings, up to 12 decimals | compare as decimals, never as floats |
| `currency` | ISO 4217, fixed at creation | no implicit FX; never convert yourself |
| `limit` | must stay ≥ `consumed` + `reserved` (pool: + `external`) | a lower value is refused; ask the owner for a valid one |
| `health` levels | `healthy`, `warning-80`, `critical-90`, `blocked-100` on committed = consumed + reserved | the decision maker is alerted at 80/90/100 % |
| `paused` | `true` blocks new reservations and execution | `paused=false` is the only resume after a circuit breaker |
| `reconciliationRequired` on `budgets[]` or `pool` | the projection must be reconciled first | amounts are null = unknown, never zero; STOP (an import result's flag means SKILL.md row 6) |
| funding | a reservation for one standalone `queued`, unleased job | plan jobs (`workflowBinding`) are funded by their approved plan; funding is not execution approval |
| settlement | a terminal job's leftover reservation goes back to budgets and pool | irreversible; the job never runs again; uncertain provider exposure is written off |
| settlement and pools | a paused pool under its cap after the release un-pauses | execution re-opens for every member project: tell the owner |
| pool | shared cap over member project budgets, possibly across workspaces | a reservation must fit the project/activity budget AND the pool |
| pool members | added only, never removed; counters start when a project is linked | send every current member in `projectIds` |
| pool `window` | `null` or `{startsAt, endsAt}` in UTC ending in `Z` | gates new reservations only |
| pool external cost | `infrastructure` or `ai-external`; a real bill with UTC date (not future) and evidence SHA-256 | permanent; reaching the cap pauses the pool for all members |
| work outside AISH runners | billed by the provider (Claude Code, Codex, editors) | LPM records the bill (pool cost `ai-external`) |
| visibility `summary` / `ledger` | what non-managing readers get from the financial reads; one setting per project | managers always see the ledger; under `summary` readers cannot list consumption |
| summary-exposure reader | {{tool:get_aish_budget}} returns no `version` and no `reservation` | a manager's key is needed for guards |
| pool read | {{tool:get_aish_financial_pool}} needs a manager of a member project | otherwise use the `pool` summary of {{tool:get_aish_budget}} |

### Reads
| Question | Call → keep | Rule |
|---|---|---|
| budget left, reservation | {{tool:get_aish_budget}}(projectId, jobId when one job is asked) → `budgets[]`, `pool`, `reservation` | empty `budgets` → "all AISH spending in this project is blocked"; never add nested budgets |
| one activity's cost | {{tool:get_aish_financial_report}}(projectId, issueId) → `complete`, `buckets`, `budgets[].committedPercent` | a missing bucket is unknown, not zero |
| shared cap | {{tool:get_aish_financial_pool}}(poolId) → `pool` | denied → the `pool` summary of {{tool:get_aish_budget}} |
| receipts | {{tool:list_aish_consumption}}(jobId, limit=100), repeat with `cursor` = `nextCursor` until null | pages are not totals |
| hours, tokens, cost evidence | {{tool:get_aish_accounting}}(projectId, issueId) → `projection.complete`, `projection.gaps`, `stale` | `stale == true` → offer reconcile (SKILL.md row 6) |
| runner hours | {{tool:get_aish_usage_report}}(accountId, from, to, groupBy="project") → `totals.durationMs` / 3,600,000 | accountId, from, to: the user (ISO, ≤ 366 days); CLI `lpm aish usage report --account <accountId> --json` |

### Writes
| Tool [O] | Guard: read first → check | Id field (once, reuse on retry) | Verify passes when |
|---|---|---|---|
| {{tool:configure_aish_budget}} | {{tool:get_aish_budget}}(projectId) → entry with the same `issueId` → `version` (0 when none) | `commandId`, `expectedVersion` | `version` +1, ordered `limit`/`paused` |
| {{tool:configure_aish_financial_pool}} | {{tool:get_aish_financial_pool}}(poolId) → `pool.version`, `pool.projectIds`; new pool → flow step 3 | `commandId`, `expectedVersion` | `version` +1, ordered values |
| {{tool:record_aish_financial_pool_cost}} | {{tool:get_aish_financial_pool}}(poolId) → `pool.currency` = bill currency; no cost with the same `evidenceSha256` | `costId` = sanitized invoice number | `costs[]` has `costId` (version unchanged) |
| {{tool:fund_aish_job}} | {{tool:get_aish_job}}(jobId) → `status == "queued"`, no `lease`, no `workflowBinding`; {{tool:get_aish_budget}}(projectId) → not paused, `health.available` ≥ `maxAmount` | none (same envelope returns the same reservation) | `reservation.status` `reserved` or `claimed` |
| {{tool:settle_aish_budget}} | {{tool:get_aish_job}}(jobId) → `completed`, `failed` or `canceled`; {{tool:get_aish_budget}}(projectId, jobId) → `reservation.entriesHash`, `pool.paused` (flow step 6) | `expectedEntriesHash` | `settled`, `remaining == "0"` |
| {{tool:set_aish_financial_visibility}} | {{tool:get_aish_financial_report}}(projectId, issueId = any issue of the project) → `visibility.version` | `commandId`, `expectedVersion` | `readerExposure` ordered, `version` +1 |
| {{tool:adjust_aish_consumption}} | {{tool:list_aish_consumption}}(jobId) → the `observation` entry `id`; no adjustment with the same `originalEntryId` and `evidenceSha256` | `adjustmentId` (flow step 4), `entryId` | the returned `entry.id` is listed |
| {{tool:import_aish_accounting}} | same tool, `mode="preview"` → `expectedFingerprint` | `import.importId` (the owner's) | {{tool:get_aish_accounting}} → row 6 |
Re-reads and exact pass rules: the Verify table of {{ref:flow-aish-write}}.

## Rules
1. Take every value from the owner's instruction; take every guard from a read made right before the write.
2. A "version changed" or "changed before" error means someone else acted: re-read and confirm with the owner again.
3. Never invent a second decision id to get past a "replay conflicts" error. Cost and adjustment ids come from the evidence (invoice number, entry and evidence hashes), never from the date: a retry on another day must reuse them.
4. Never fund a plan job, settle a running job, or remove a pool member.
5. Report decimals exactly as returned, with their currency.

## Examples
```text
example: "quanto resta do orçamento AISH do projeto?"
get_aish_budget(projectId) -> budgets[issueId=null]: limit "100.00", consumed "40.00", reserved "10.00",
  health.available "50.00", committedLevel "healthy"
answer: 50.00 left of 100.00 (40.00 spent, 10.00 reserved); activity budgets are inside it, not extra
```
