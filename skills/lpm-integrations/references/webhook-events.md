# Webhook events, delivery and failures
Load when: webhook work
Applies to: lpm-integrations    Source: lpm `server.ts` webhook commands (:4813-5090), delivery worker (:32027-32193), `src/lib/webhookDelivery.ts`, `src/lib/secretCrypto.ts:87-94`, `src/SettingsPage.tsx:329-339`; cards {{tool:create_webhook_subscription}}, {{tool:update_webhook_subscription}}, {{tool:test_webhook_subscription}}, {{tool:list_webhook_deliveries}}, {{tool:delete_webhook_subscription}}
## Summary
LPM POSTs signed JSON to an `active` subscription's URL for the events it lists; the server does not validate event names.
A workspace subscription (no projectId) receives every project's events; a project subscription only that project's.
A failed delivery retries up to 5 attempts (30 s doubling, max 30 min), then becomes `dead-lettered`. No redeliver tool exists.
Pausing drops new events and dead-letters queued ones; deleting is permanent and loses the secret.
{{tool:test_webhook_subscription}} only queues one `system.test`; poll {{tool:list_webhook_deliveries}}. A delivered test proves reachability and a 2xx reply, not the event filter or signature checks.
Writes have no idempotency key and no concurrency token: list before every create or retry.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `issue_created` | an activity is created (also by batch, roadmap materialization, AISH autopilot) | payload: issueId, title, status, priority, requirementId, baselineId, dueDate |
| `issue_started`, `issue_completed`, `issue_canceled`, `issue_reopened` | status moves to in-progress, done, canceled, backlog/todo | payload: issueId, previousStatus, status, title |
| `issue_priority_changed` | priority changes | payload: issueId, previousPriority, priority, title |
| `issue_updated` | an update with NO status and NO priority change; blocker context set/resolved | subscribing to it alone misses status and priority changes |
| `comment_added` | a comment is created; blocker context set/resolved | payload: commentId, issueId, commentPreview (first 120 chars) |
| `requirement_created`, `requirement_updated` | a requirement is created or updated | payload: requirementId, title, baselineId, changedFields |
| `export.completed` | a data export finishes | payload: exportRequestId, scope, recordCounts, storagePath, checksum |
| `system.test` | only {{tool:test_webhook_subscription}} | sent even when not in `events`; payload `source: "lpm-test"` |
| `*` | every event above | widest data egress: use only on an explicit request |
| not emitted | roadmap, cycles, milestones, baselines, change sets, governance threads, AISH, deletes | tell the user these cannot be sent by webhook |
| web UI event list | `issue_created`, `issue_updated`, `issue_completed`, `issue_priority_changed`, `requirement_created`, `requirement_updated`, `comment_added`, `export.completed`, `*` | the MCP list above is wider |
| request | `POST <url>`, `Content-Type: application/json` | no request timeout; one delivery per worker cycle (~10 s) |
| headers | `X-LPM-Event`, `X-LPM-Delivery-Id`, `X-LPM-Signature` = hex HMAC-SHA256 of the raw body with the secret | no `sha256=` prefix, no signed timestamp |
| body | `{id, eventType, workspaceId, projectId, timestamp, payload}` | `id` stays across retries; `timestamp` and signature change per attempt |
| subscription `projectId` | `null` = workspace-wide: receives every project's events | {{tool:list_webhook_subscriptions}} with `projectId` matches exactly and hides these rows: list by workspaceId, then keep `projectId == <projectId>` or `null` |
| list by workspaceId fails ("You do not have access to this project" / "Project <id> not found") | one project subscription of an unreadable or deleted project fails the whole call | call with workspaceId + projectId; report "workspace-wide subscriptions not checked" as Pending; no create on that partial list without the owner |
| subscription `status` | `active`, `paused` (`revoked` exists server-side, not settable by MCP) | only `active` receives events |
| `secret: null`, `secretPreview` | the secret is encrypted and never returned; preview = first 4 + last 4 chars (`••••••••` when ≤ 8 chars) | identify a secret by `secretPreview` only |
| `url` | returned in clear text to every reader of the workspace | never put credentials in the URL |
| `events` on update | replaces the whole list; normalized (trimmed, deduplicated, sorted); cannot be empty | resend the full list; to stop everything use `paused` |
| empty `name` / `url` on update | ignored | fields cannot be cleared |
| new `secret` on update | used at once, also for queued retries | the receiver must accept old and new first |
| delivery `status` | `queued` → `running` → `delivered`; on failure back to `queued` with `attemptCount + 1`, `nextAttemptAt`, `lastError`; then `dead-lettered` | `failed` is never set on a delivery |
| retry schedule | attempts wait ~30 s, 60 s, 120 s, 240 s; the 5th failure dead-letters (~8 min) | any non-2xx reply is a failure; no auto-pause |
| delivery list | newest first, default 20, max 100; no payload, no response body, no HTTP status per attempt | filter by subscriptionId; read `lastError` text |

Failure table (`lastError` / state → side):
| Signal | Meaning | Side |
|---|---|---|
| "Webhook endpoint responded with 401" / "403" | receiver rejects the request: secret mismatch or wrong signature check | receiver / secret |
| "responded with 404" / "405" / "410" | wrong URL or path | subscription `url` |
| "responded with 5xx" | receiver error | receiver |
| network text (`fetch failed`, DNS, TLS, connection refused) | URL unreachable | URL / network |
| "Subscription is not active." | paused while queued | LPM config (expected) |
| "Subscription removed before delivery." | deleted while queued | LPM config |
| `queued`, `attemptCount == 0`, `nextAttemptAt` minutes in the past | worker backlog or workers off | LPM platform, not the receiver |
| `running` for minutes | stuck attempt: the worker only picks `queued` rows, so this delivery is lost (no MCP recovery) | LPM platform: report it. Only if every new delivery also sticks, re-saving the secret ({{tool:update_webhook_subscription}}) is an owner decision |

## Rules
1. Use only event names from the Facts table; a typo is stored and never fires.
2. Pick status events explicitly: `issue_updated` does not cover status or priority changes.
3. Require `https://` and a random secret of at least 32 characters, read only from the env var `LPM_WEBHOOK_SECRET`; never ask for it in chat, never echo it.
4. Give the secret to the receiver's owner outside LPM; never write it in comments, evidence or reports.
5. Rotate in this order: receiver accepts both secrets → update the secret → test → receiver drops the old one.
6. Never call the test or the create twice in a row; read {{tool:list_webhook_deliveries}} or {{tool:list_webhook_subscriptions}} first.
7. Judge "in use" from recent `delivered` rows before a pause or delete.
8. A receiver must verify the signature over the raw body, deduplicate by `X-LPM-Delivery-Id` and reply 2xx fast.

## Examples
```text
example: list_webhook_deliveries(subscriptionId="<subscriptionId>", limitCount=5)
→ [{eventType: "system.test", status: "queued", attemptCount: 2, lastError: "Webhook endpoint responded with 401"}]
Cause: receiver rejects the signature. Side: receiver/secret. Next: owner fixes the receiver secret, then test again.
```
