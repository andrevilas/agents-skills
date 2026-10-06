# Flow: session control (pause, resume, retry, cancel, checkpoint)
Load when: decision row 8 of SKILL.md

## Preconditions
1. LPM API key (`full` or `custom`); the caller manages the workspace. Load {{ref:cockpit-state-actions}}.
2. fence = sessionId, coordinatorId, the LATEST `leaseNonce` and `fencingToken` from {{ref:flow-cockpit}} step 3. Lost or expired → step 3 there first.
3. `<s8>` = the first 8 characters of sessionId; `<n>` = 1 + earlier commands of that type in this session. Retry a timed-out call with the SAME commandId.

## Steps
1. {{tool:get_aish_execution_session}}(sessionId) → keep `session.status`, `pauseReason`, `activeCheckpointId` (= checkpointId), `currentPlanHash`, and `checkpoint.status`, `checkpoint.decision.action`.
2. Pause: [C] then {{tool:pause_aish_execution_session}}(fence, commandId="pause-<s8>-<n>") [C]; omit `reason`. Jobs already running keep running.
3. Resume: `activeCheckpointId` set and `checkpoint.status != "resolved"` → step 7 first. `checkpoint.status == "resolved"`: `decision.action == "resume"` → resume here; `"cancel"` → the session is canceled, report. [C] then {{tool:resume_aish_execution_session}}(fence, commandId="resume-<s8>-<n>") [C]; it creates no jobs → {{ref:flow-cockpit}} step 13.
4. Retry, only after the cause is fixed and the user said yes: {{tool:retry_aish_execution_plan}}(fence, planHash=`currentPlanHash`, commandId="retry-<s8>-<n>") [C]. Each retry spends new reservations.
5. Cancel (final): `activeCheckpointId` set and `checkpoint.status == "pending"` → never append `canceled`; only the owner decides (step 7, action `cancel`) → decision request, STOP. Else [C] "Cancel session <id> for good? It cannot be undone." → {{tool:append_aish_execution_session_command}}(sessionId, commandId="cancel-<s8>", type="session-canceled", nextStatus="canceled") [C].
6. Checkpoint, only when `approvedPlanHash == currentPlanHash`, `status` `approved`/`executing`/`paused` (not `budget`/`timeout`) and `activeCheckpointId` empty: {{tool:request_aish_execution_checkpoint}}(fence, planHash=`currentPlanHash`, commandId="ckpt-<s8>-<n>", kind=`checkpoint`/`conflict`, title ≤160, summary ≤3000 with options and a recommendation) [A]. Effect: the session pauses now; only the owner's resolve + resume restarts it. Tell the owner a decision waits.
7. Resolve: the owner's quoted `resume`/`cancel` + reason (≥8 chars), human user key only: {{tool:resolve_aish_execution_checkpoint}}(fence, planHash=`currentPlanHash`, checkpointId=`activeCheckpointId`, action, reason) [O]; `resume` → step 3.
8. Verify: {{tool:get_aish_execution_session}}(sessionId) → `status` `paused`, `executing` or `canceled` as requested; after step 7 `checkpoint.status == "resolved"`.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| `pauseReason` `budget` (plan `maxJobs` reached, retries count; not money, not {{skill:lpm-ai-cost}}) or `timeout` | "The session hit its <limit>. Resume is refused; a new reviewed session is needed. Create it?" |
| a pending checkpoint and the user says "cancel" | decision request: only the owner cancels at a checkpoint (step 7, action `cancel`). STOP |
| step 7 without the owner's quoted order, or with an agent credential | decision request ({{ref:authority-and-owner-decisions#decision-request}}); the owner decides in the cockpit. STOP |
| "fencing token is stale", "lease is not active", "identity mismatch" | {{ref:flow-cockpit}} step 3 (same coordinatorId, NEW key); retry with the new pair |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| pause, resume, retry, cancel | {{tool:get_aish_execution_session}} | `session.status` as requested |
| checkpoint request / resolve | {{tool:get_aish_execution_session}} | `activeCheckpointId` set / `checkpoint.status == "resolved"` |

## Report fields
- sessionId, `status`, `pauseReason`, checkpointId
- owner order (verbatim quote) for step 7
- pending: owner decision, new session, runner — who must act
