# Batch and bulk changes
Load when: more than one item changes
Applies to: lpm-plan-work    Source: cards {{tool:batch_issue_operations}}, {{tool:bulk_assign_project_issue_owners}}, {{tool:bulk_set_project_issue_estimates}}, {{tool:bulk_set_project_issue_due_dates}}, {{tool:list_issues}}, {{tool:list_overdue_project_issues}}, {{tool:list_unassigned_project_issues}}, {{tool:list_unestimated_project_issues}}, {{tool:update_issue}}, {{tool:create_comment}}

## Summary
{{tool:batch_issue_operations}} runs 1–25 {{tool:create_issue}} / {{tool:update_issue}} / {{tool:create_comment}} operations in order, with one required `idempotencyKey`.
It is not atomic: succeeded items stay applied when a later item fails. `stopOnError` defaults to true.
Retry the identical batch with the SAME key; resend only failed or skipped items with a NEW key.
The bulk owner / estimate / due-date tools take one project and a non-empty `updates` array, and report each item.
Use only the canonical due-date names: {{tool:set_project_issue_due_date}}, {{tool:bulk_set_project_issue_due_dates}}.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `operations[]` | 1–25 items, each exactly `{tool, arguments}`; `arguments` = that tool's own arguments, no other keys | more than 25 → several batches, each with its own key |
| `tool` | {{tool:create_issue}}, {{tool:update_issue}} or {{tool:create_comment}} only | links, attachments, labels and roadmap changes are not accepted |
| placeholders | none: an item cannot use an id created earlier in the same batch | create first, read the ids, then run a second batch |
| `idempotencyKey` | required, 8–200 chars of `[A-Za-z0-9._:-]` | recipe `plan-<projectId>-<yyyymmdd>-<n>` |
| same key + same operations | returns the recorded summary with `replayed: true` and executes nothing, failed items included | a retry of failed items needs a NEW key |
| same key + different operations | `IDEMPOTENCY_CONFLICT` | use a new key |
| `BATCH_IN_PROGRESS` | the first call is still running | wait, then resend the SAME key and SAME operations |
| `BATCH_INTERRUPTED` | no progress for 10 minutes | re-list, then resend only the missing operations with a NEW key |
| result | `{total, succeeded, failed, skipped, items:[{index, tool, status, result or error}]}` | `isError` is true only when no item succeeded: always read `failed` and `skipped` |
| {{tool:create_issue}} item result | text "Issue created with ID: <id>" | parse the id after "ID: " |
| stored runs | kept 30 days; item results over 8000 chars are truncated on replay | re-read state with {{tool:list_issues}} instead of trusting a replay |
| bulk `updates[]` | `[{issueId, assigneeId}]`, `[{issueId, estimate}]` or `[{issueId, dueDate}]`; `null` clears; NO `idempotencyKey` (naturally idempotent) | one call per project and per kind; never invent a key |
| bulk result | `{requestedCount, updatedCount, failedCount, results:[{issueId, status, error?}]}` | not atomic and sequential: keep arrays modest; resend only `failed` items |
| {{tool:list_issues}} with `limitCount` (1–100) | returns `{items, nextCursor, hasMore}` | loop while `hasMore`; reuse `nextCursor` only with the SAME projectId and filters |
| {{tool:list_issues}} without `limitCount` or `cursor` | returns the whole project in one array | always pass `limitCount=100` and loop `nextCursor` while `hasMore` |
| {{tool:list_overdue_project_issues}} | offset cursor, default 25, max 100; items are summaries | loop `nextCursor` until null; {{tool:get_issue}} for full fields |
| {{tool:list_unassigned_project_issues}} / {{tool:list_unestimated_project_issues}} | `limitCount` truncates `items`; no cursor; `count` is the full total | an `estimate` of 0 counts as estimated |
| {{tool:update_issue}} `labelIds` | replaces the whole label list | send old ids plus new ones |
| `null` under OAuth | silently ignored by {{tool:update_issue}} | clearing assignee, cycle, milestone or due date needs an API key |
| {{tool:create_comment}} same key, new text | returns the ORIGINAL comment, no error | new text → new key |
| due-date alias names | the same handler under a second name (see `tools.md`) | never call an alias |

## Rules
1. Build every item from §3 Inputs; never put an invented id in `arguments`.
2. Send a new key for every new batch; keep a list of the keys you sent in this run.
3. After a timeout, resend the identical batch with the SAME key before anything else.
4. [C] Show the plan table before any owner, estimate or due-date change, whatever the tool (bulk tools, {{tool:update_issue}} or batch items).
5. Never put status `done` in a batch item; closure belongs to {{skill:lpm-deliver-activity}}.
6. After the last batch, re-list once ({{tool:list_issues}}(projectId, limitCount=100), loop `nextCursor` while `hasMore`) and compare counts with the plan.

## Examples
```text
example: batch_issue_operations {
  "idempotencyKey": "plan-<projectId>-20261012-1",
  "stopOnError": true,
  "operations": [
    {"tool": "create_issue", "arguments": {"projectId": "<projectId>", "title": "Implementar pagamento com cartão no checkout", "description": "O que: aceitar cartão de crédito no checkout.\nCritérios de aceite:\n- o cliente paga com cartão e o pedido fica pago\n- cartão recusado mostra o motivo e não cria o pedido", "priority": "high"}},
    {"tool": "update_issue", "arguments": {"projectId": "<projectId>", "issueId": "<issueId>", "cycleId": "<cycleId>"}},
    {"tool": "create_comment", "arguments": {"projectId": "<projectId>", "issueId": "<issueId>", "content": "Moved to cycle 2026-10-12 to 2026-10-23."}}
  ]
}
example: bulk_set_project_issue_due_dates {"projectId": "<projectId>", "updates": [{"issueId": "<issueId>", "dueDate": "2026-10-31"}]}
(bulk tools: no idempotencyKey)
```
