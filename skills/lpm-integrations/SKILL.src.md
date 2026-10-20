# Webhooks, exports and analytics bridge
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}
Rule 6 also covers webhook secrets and pasted ones, even in part or in a suggested command.

## 1. Use when / Do not use
Use when:
- "create / test / delete a webhook", "endpoint stopped receiving events", "backup do workspace", "run the BigQuery bridge"
Do not use:
| If the request is about | Use |
|---|---|
| incoming GitHub commit tracking (`LPM-Activity:` trailer) | {{skill:lpm-deliver-activity}} |
| incoming WhatsApp messages or the intake channel | {{skill:lpm-intake-triage}} |
| an API key or profile for these tools | {{skill:lpm-access}} |
| delivery health or dashboards inside LPM | {{skill:lpm-review-health}} |
| an AISH execution pack or release package | {{skill:lpm-aish-delivery}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Flow row: open its file, do its steps in order, reply with its Answer block only.
2. `full`/`custom` key: every webhook tool and create/process call. `read-only` also runs rows 10, 13; a connector, row 11.
3. Webhook writes and test: {{tool:list_workspaces}}() without `compact` → `access.canManage == true` for workspaceId, else §6. Error, or no row for workspaceId → no webhook write or test; report the error, STOP. Export: any row for workspaceId is enough (`canManage` does not matter); never ask about membership.
4. Data leaves LPM only for a named recipient. A webhook secret comes only from env `LPM_WEBHOOK_SECRET`; never ask for it in chat, print or store it. A pasted secret is burned: never use or repeat it (§6).
5. Read-only request ("status", "why", "is it working?") → no write tool; test, export and bridge runs are writes.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId | {{skill:lpm-start}} §3, or {{tool:list_workspaces}}() → `id` (match `name`) | 0 or 2+ → ask |
| projectId (optional) | {{tool:list_workspace_projects}}(workspaceId) → `id` (match `name`) | omit = whole workspace |
| subscriptionId | {{tool:list_webhook_subscriptions}}(workspaceId), never projectId (hides workspace-wide rows) → rows with `projectId` <projectId> or `null` → `id` (match `url`/`name`) | 0 → "None matches <url/name>" + list; 2+ → ask |
| url, events, recipient; secret | user; secret: env `LPM_WEBHOOK_SECRET` only | ask; secret pasted in chat → never use it, §6 |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | list subscriptions, deliveries | {{tool:list_webhook_subscriptions}}(workspaceId) → {{tool:list_webhook_deliveries}}(subscriptionId, limitCount=20) | A | — |
| 2 | create a webhook | {{ref:flow-webhook-create}} | O | same `url` subscribed → flow step 1; secret typed in chat → §6 |
| 3 | send a test to a webhook | webhook test (§5) | C | `paused` → row 4 first |
| 4 | change URL, name, events; pause or resume | {{ref:flow-webhook-update}} | O | other scope → rows 7, 2 |
| 5 | rotate the secret | {{ref:flow-webhook-update}} | O | receiver cannot hold both secrets → ask |
| 6 | "is it working?", deliveries fail, events not received | diagnose deliveries (§5) | A | read-only |
| 7 | delete a subscription | {{tool:list_webhook_deliveries}}(subscriptionId, limitCount=20) → {{tool:delete_webhook_subscription}}(subscriptionId) | O | pause only → row 4 |
| 8 | replay events; webhooks for roadmap, cycle, baseline, AISH | STOP: "LPM has no redeliver and no webhook for those events." | A | — |
| 9 | full data export or backup | data export (§5) | C | export `queued`/`running` → report it |
| 10 | export status or download | {{tool:list_export_requests}}(workspaceId, projectId) → `status`, `recordCounts` | A | download: web app only |
| 11 | bridge health, recent runs | {{tool:get_analytics_bridge_observability}}(workspaceId or projectId) → {{tool:list_analytics_bridge_runs}}(same scope) | A | empty = no runs by this caller |
| 12 | run, refresh or backfill the bridge | {{ref:flow-bridge-run}} | C | wide run → owner decision |
| 13 | LPM dashboards/metrics wrong | {{tool:get_project_analytics}}(projectId) → {{skill:lpm-review-health}} | A | bridge does not feed them |

## 5. Procedures
### Webhook test — row 3
1. {{tool:list_webhook_subscriptions}}(workspaceId) → subscriptionId `paused` → STOP: "Paused: resume first (row 4)."
2. [C] "Send one `system.test` POST to <url host>? (yes/no)"
3. {{tool:test_webhook_subscription}}(subscriptionId) [C], once (it only queues).
4. Wait 15 s; {{tool:list_webhook_deliveries}}(subscriptionId, limitCount=5) → newest `system.test` row.
5. `lastError` set → diagnose deliveries (below). Else repeat step 4 every 30 s (max 5); then `queued`, `attemptCount == 0` → Pending "LPM worker backlog"; `running` → Pending "LPM: stuck attempt".
6. Verify: §7 test row.
### Diagnose deliveries — row 6
1. {{tool:list_webhook_subscriptions}}(workspaceId), rows as in §3 → `id`, `projectId`, `status`, `events`.
2. Per `id`: {{tool:list_webhook_deliveries}}(subscriptionId, limitCount=50) → count by `status`; newest `lastError`, `deliveredAt`. `delivered` in 24 h → "working"; no row in 24 h → offer row 3.
3. Event without a row → compare `events` with {{ref:webhook-events}} (typos stored silently).
4. Map `lastError` with its failure table → receiver, URL or LPM side. Offer row 3 or 4.
### Data export — row 9 ({{ref:exports}})
0. A project named → {{tool:list_workspace_projects}}(workspaceId) → projectId (match `name`; 0 or 2+ → ask).
1. {{tool:list_export_requests}}(workspaceId, projectId) → same scope `queued`/`running` → STOP: report its `id`.
2. [C] Ask exactly: "Queue a full <scope> export of <name> for <recipient>? It holds ALL records of the <scope>. Call: `create_export_request(scope="project", projectId="<id>")` (yes/no)" (workspace: `scope="workspace", workspaceId="<id>"`). Nothing else about contents.
3. {{tool:create_export_request}}(the step 2 call) [C], no `idempotencyKey` → keep `id`. Timeout → step 1.
4. Verify: {{tool:list_export_requests}}(workspaceId, projectId) → row `id` every 30 s (max 10): `failed` → `errorMessage`; still `queued`/`running` → Pending "export still packing" (row 10 later).
5. `completed` → §8 in the user's language; `checksum` as given (not "verified"); Pending: none; Next: download in the LPM web app → Settings → Integrações.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| an [O] write (create, update, {{tool:delete_webhook_subscription}}) without an owner order here | send the decision request ({{ref:authority-and-owner-decisions#decision-request}}) and STOP |
| `access.canManage` not true | {{tool:list_workspace_members}}(workspaceId) → owner/admin `userEmail`; STOP: "Only <them> can manage webhooks." |
| no recipient named | "Who receives this data (system and responsible person)?" |
| delete with recent `delivered` rows | "<name> is in use (last delivery <deliveredAt>). Deleting is permanent; no replay. Proceed?" |
| secret text in the user's message (even "fake" or "test") | never use or repeat it, even in part, in any reply, command or argument. After the flow reads (steps 0-2), reply exactly: "That secret is now in the chat log, so I will not use it. Generate a fresh one (`openssl rand -hex 32`), put it in the receiver and in the env var `LPM_WEBHOOK_SECRET`, then tell me. Do not paste it here." STOP. Commands: only `$(openssl rand -hex 32)` |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| create, update | flow-webhook-create or -update § Verify | every row passes |
| test | webhook test step 4 (§5) | newest `system.test` `delivered`, `lastError == null` |
| delete | {{tool:list_webhook_subscriptions}}(workspaceId) | `id` absent |
| export | data export step 4 (§5) | row `id` `completed` (or `failed` reported) |
| bridge run | flow-bridge-run § Verify | every row passes |

## 8. Report (copy and fill)
```text
Scope: <workspace> / <project | whole workspace> · subscription | export | run <id>
Done: <change + ids>; owner instruction (quoted, for [O]): "<text>"
Evidence: <delivery status + deliveredAt | export recordCounts, checksum, completedAt | run loadJobs, watermarks>
Pending: <none | item — who must act>
Next: <one action>
```
Stop-and-ask replies too: Done: none or the reads run ("no duplicate for <url>"); Pending: <question> — <who acts>; Next: <step after the answer>.

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|

## 10. Tools and references
{{tools:index}}
{{refs:index}}
