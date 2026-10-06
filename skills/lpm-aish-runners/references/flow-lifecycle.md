# Playbook: lifecycle
Use when: drain, suspend, reactivate or remove a runner host of an account
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| accountId | the user, or `lpm aish accounts list --json` → `id` | STOP. Say: "Which AISH runner account? Run `lpm aish accounts list --json` and send me its id." |
| host | the user (host name or id) | STOP. Say: "Which runner host? (name or id)" |
| action | "drain", "suspend", "reactivate" or "remove" (drenar, suspender, reativar, remover) | STOP. Say: "Drain, suspend, reactivate or remove <input:host>?" |
| reason | 8–1000 characters from the user's words ("Manutenção do disco do gpu-box-02") | the user's request |
| stamp | UTC now as yyyymmddHHMMss, kept for a retry | — |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing was changed."
1. CALL {{tool:get_aish_runner_management_overview}} {"accountId":"<input:accountId>","search":"<input:host>"} [A]
   SAVE: runners = items of result.runners whose id, displayName or hostname is <input:host> (none → all); canManage = result.canManage
   IF <saved:canManage> != true → STOP. Say: "Only an owner or admin of account <input:accountId> can do this."
   IF <saved:runners> is empty and <input:action> == "reactivate" → go to step 2.
   IF <saved:runners> does not have exactly 1 item → STOP. Say: "<input:host> matches <id and displayName of each item, or no> runner. Which one?"
   IF <saved:runners> has 1 item → go to step 3.
2. CALL {{tool:get_aish_runner_management_overview}} {"accountId":"<input:accountId>","search":"<input:host>","includeRemoved":true} [A]
   SAVE: runners = items of result.runners whose id, displayName or hostname is <input:host> (none → all)
   IF <saved:runners> does not have exactly 1 item → STOP. Say: "No single runner matches <input:host>."
3. SAVE: hostId, displayName, legacy, updatedAt, administrativeStatus, health, workState = those fields of the one item of <saved:runners>; lastTask = its lastTask.id, else "none"; lastProject = its lastTask.projectId, else "none"; key = "runner-<input:action>-<saved:hostId>-<input:stamp>"
   IF <saved:legacy> == true → STOP. Say: "<saved:hostId> is a legacy project host: migrate it first (playbook legacy-migration), or revoke it (playbook fleet-cli)?"
   IF <saved:administrativeStatus> is the target of <input:action> (drain → draining, suspend → suspended, reactivate → online, remove → revoked) → STOP. Say: "<saved:hostId> is already <saved:administrativeStatus>."
4. CALL {{tool:preview_aish_runner_management_action}} {"accountId":"<input:accountId>","hostId":"<saved:hostId>","action":"<input:action>","expectedUpdatedAt":"<saved:updatedAt>"} [A]
   SAVE: allowed, blockingReasons, currentStatus, targetStatus, expectedUpdatedAt = those fields of result; leases = result.impact.activeLeaseCount; creds = result.impact.activeCredentialCount; grants = result.impact.activeGrantCount
   VERIFY: CALL {{tool:get_aish_runner_management_overview}} {"accountId":"<input:accountId>","search":"<saved:hostId>","includeRemoved":true} [A]
   IF the call returns an error or item <saved:hostId> has updatedAt != <saved:updatedAt> → STOP. Say: "<saved:hostId> changed meanwhile. Run this playbook again."
   IF <saved:allowed> != true and <saved:blockingReasons> contains "active-capacity-leases" → STOP. Say: "<input:action> is blocked for <saved:displayName> (<saved:hostId>): allowed false, blockingReasons <saved:blockingReasons>. It is <saved:health>, <saved:workState>, <saved:leases> active lease(s) (last task <saved:lastTask>); it has <saved:creds> credential(s) and <saved:grants> grant(s) (remove revokes them; reactivate never restores them). Drain it first (<saved:currentStatus> → draining: no new jobs; the current job may finish), then <input:action> at 0 leases? If yes, give me a reason."
   IF <saved:allowed> != true → STOP. Say: "<input:action> <saved:hostId> is not allowed: <saved:blockingReasons>."
5. ASK: "<input:action> <saved:displayName> (<saved:hostId>): <saved:currentStatus> → <saved:targetStatus>. Now <saved:health>, <saved:workState>; impact <saved:leases> lease(s) (last task <saved:lastTask>), <saved:creds> credential(s), <saved:grants> grant(s)<remove: all revoked; reactivate never restores them>. Reason: "<input:reason>". Call: apply_aish_runner_management_action(accountId=<input:accountId>, hostId=<saved:hostId>, action=<input:action>, expectedUpdatedAt=<saved:expectedUpdatedAt>, reason=<input:reason>, idempotencyKey=<saved:key>, confirmed=true). Confirm? (yes/no)" — continue only if the user says yes; otherwise STOP. Say: "Nothing was changed."
   Never send a reason the user has not seen here.
6. CALL {{tool:apply_aish_runner_management_action}} {"accountId":"<input:accountId>","hostId":"<saved:hostId>","action":"<input:action>","expectedUpdatedAt":"<saved:expectedUpdatedAt>","reason":"<input:reason>","idempotencyKey":"<saved:key>","confirmed":true} [C]
   IF the call returns an error → STOP. Say: "apply failed: <error text>. Do not re-send; run this playbook again (it re-reads first)."
   VERIFY: CALL {{tool:get_aish_runner_management_overview}} {"accountId":"<input:accountId>","search":"<saved:hostId>","includeRemoved":true} [A]
   IF the call returns an error or item <saved:hostId> is missing or its administrativeStatus != <saved:targetStatus> → STOP. Say: "<saved:hostId> is not <saved:targetStatus> (missing = failed). Do not re-send."
   SAVE: after = that item's administrativeStatus; workAfter = its workState; leasesAfter = its capacity.activeLeases
   IF <input:action> == "drain" and <saved:workAfter> == "busy" → SAVE: pending = "<saved:leasesAfter> active lease(s) (last task <saved:lastTask>) still running; watch `lpm aish host monitor --project <saved:lastProject> --host <saved:hostId> --json` until jobs.running is 0"; go to Answer.

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:accountId> / host <saved:hostId> (<saved:displayName>) / last task <saved:lastTask>
Done: <<input:action> <saved:hostId>: <saved:currentStatus> → <saved:after>; key <saved:key> | nothing changed (preview only)>
Evidence: <re-read administrativeStatus <saved:after> | preview allowed <saved:allowed>, blockingReasons <saved:blockingReasons>>; impact <saved:leases> lease(s), <saved:creds> credential(s), <saved:grants> grant(s); health <saved:health>, workState <saved:workState>
Pending: <none | <saved:pending> | your decision: drain first, then <input:action> when its leases are 0>
Next: <the ASK or STOP text that ended the run | after the maintenance, ask me to reactivate <saved:hostId> | none — host <saved:after>>
```
administrativeStatus: pending | online | draining | offline | suspended | revoked; health: online | stale | offline | unknown; workState: busy | idle. A yes to drain first = run this playbook again with action "drain". Never re-call the overview to wait for a lease to end. Never claim a status that the VERIFY re-read did not show.
