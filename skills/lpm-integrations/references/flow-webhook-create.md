# Flow: create a webhook
Load when: decision row 2 of SKILL.md (create / criar a webhook subscription)

## Preconditions
1. A `full`/`custom` API key and {{tool:list_workspaces}}() → `access.canManage == true` for workspaceId (SKILL.md §2). {{tool:list_workspaces}} errors, or no row for workspaceId → no webhook write or test; report the error and STOP.
2. Inputs (SKILL.md §3): workspaceId, projectId (optional), name, url, events, recipient; the secret comes from step 3. Event names: {{ref:webhook-events}}.
3. {{tool:create_webhook_subscription}} is [O] and has no idempotency key: a second create doubles every delivery.

## Steps
Always run steps 0-2 (reads and checks) before any stop about the secret or the owner order; then ask everything in ONE reply (duplicate result + secret request + owner order), with the SKILL.md §8 template.
0. {{tool:list_workspaces}}() → workspaceId, `access.canManage == true` (else SKILL.md §6); a project named → {{tool:list_workspace_projects}}(workspaceId) → projectId (match `name`).
1. {{tool:list_webhook_subscriptions}}(workspaceId), never with projectId (that filter hides workspace-wide rows). Duplicate = a row with the same `url` and `projectId == <projectId>` or `projectId == null`; for a workspace-wide create, any row of the workspace with that `url`. Duplicate → STOP: "<url> is already subscribed (<id>, <project or whole workspace>). Change it instead?" (SKILL.md row 4). Then add (row with `projectId` null): "It is workspace-wide, so it already sends events of every project." Valid options, each needs its own owner order: (a) update <id> (name, events = full list, status `active`), which keeps its current scope; (b) delete <id> (SKILL.md row 7), then create a project-scoped subscription. Never offer a second subscription to the same `url` (it doubles deliveries), and never offer an update that changes scope (not supported). Skip steps 2-8 (a pasted secret still gets the § Stop and ask reply in the same message); continue only after a new owner order (row 4, or row 7 + row 2).
2. Check: `url` starts with `https://`; every event is in the event table; `*` only if the user said "all events"; recipient named. Else → § Stop and ask.
3. Secret (only the value of env `LPM_WEBHOOK_SECRET` may fill `secret`):
   - The user's message contains a secret value (even marked fake, test or example) → it is unusable (§ Stop and ask "pastes the secret"; never echo it): do not pass it to any tool, do not copy it into any reply, command or example. Steps 0-2 still run first; then send that reply and STOP.
   - Never write an example command containing a real or user-given secret value; use only `openssl rand -hex 32`, `$(openssl rand -hex 32)` or the placeholder `<fresh-secret>`.
   - Else: the user puts a random secret of ≥ 32 characters (e.g. `openssl rand -hex 32`) in the receiver and in the env var `LPM_WEBHOOK_SECRET` of this agent. With a shell, check the length without printing it: `[ ${#LPM_WEBHOOK_SECRET} -ge 32 ] && echo ok || echo short`. No env var reachable (no shell, connector chat) → STOP: "Create it in the LPM web app (Settings → Integrações → Webhooks) and type the secret there; I will then verify and test it." Never ask for the secret in chat.
4. [O] Owner order naming name, url, events, scope and recipient in this conversation; none → decision request ({{ref:authority-and-owner-decisions#decision-request}}), STOP.
5. {{tool:create_webhook_subscription}}(workspaceId, projectId, name, url, secret = value of `LPM_WEBHOOK_SECRET` (never a value typed in chat), events) [O], once → keep `id`, `secretPreview`. Read the env var only to fill this argument; never show it.
6. Timeout or no `id` → step 1 again before any retry.
7. Verify: § Verify.
8. Test it: SKILL.md P1 (row 3).

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no owner order in this conversation | send the decision request and STOP |
| `url` not `https://` | "LPM must send to an https:// URL. Which one?" |
| `LPM_WEBHOOK_SECRET` unset or < 32 characters | "Set a random secret of ≥ 32 characters (e.g. `openssl rand -hex 32`) in the receiver and in the env var `LPM_WEBHOOK_SECRET`, then tell me. Do not paste it here." |
| the user pastes the secret: secret text appears in the user's message (even if called fake or test) | never repeat it, in full or in part (no prefix, suffix or preview), in any plan, message, command, example, argument or report, and never use it. Reply exactly (same text as SKILL.md §6): "That secret is now in the chat log, so I will not use it. Generate a fresh one (`openssl rand -hex 32`), put it in the receiver and in the env var `LPM_WEBHOOK_SECRET`, then tell me. Do not paste it here." No env var reachable (connector chat) → add: "Or create the webhook in the LPM web app (Settings → Integrações → Webhooks)." STOP |
| `*` not explicitly requested | "Send ALL events (`*`) or only <list>?" |
| no recipient named | "Who receives this data (system and responsible person)?" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| create | {{tool:list_webhook_subscriptions}}(workspaceId) | `id` present; `url` equal; `events` equal the request as a set (LPM trims, deduplicates and sorts); `status == "active"` |
| test | SKILL.md P1 | newest `system.test` `delivered`, `lastError == null` |

## Report fields
Scope, subscription `id`, `url` host, `events`, `secretPreview` copied from the {{tool:create_webhook_subscription}} result (never computed from any secret), owner instruction (quoted), test delivery `status` + `deliveredAt`.
