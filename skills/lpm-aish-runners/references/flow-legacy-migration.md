# Flow: legacy runner migration and rollback
Load when: decision row 5 of SKILL.md

## Preconditions
1. LPM API key (`full`/`custom`); {{tool:get_aish_runner_management_overview}} → `canManage == true` (account owner/admin).
2. A legacy host listed by the overview is in a workspace already bound to the account (the overview lists legacy hosts only from bound workspaces). A "not bound" error later means the binding was revoked meanwhile → Stop and ask row 1.
3. idempotencyKey = `migrate-<hostId>-<yyyymmddHHMMss>`: a new key per migration attempt (the same key only to retry that attempt after a timeout); write it in the report. migrationId = step 4 `migrationId`; save it.
4. Rollback only: start at step 6.

## Steps
1. {{tool:get_aish_runner_management_overview}}(accountId) → the host with `legacy == true` → keep `id`, `updatedAt`.
2. {{tool:preview_aish_legacy_runner_migration}}(accountId, hostId, expectedUpdatedAt=`updatedAt`) [A] → keep `allowed`, `expectedUpdatedAt`, `source`, `target`. `allowed == false` → report `blockingReasons`, STOP.
3. [C] "Move <host> into account <accountId>, limited to its workspace and project? Reason?"
4. {{tool:apply_aish_legacy_runner_migration}}(accountId, hostId, expectedUpdatedAt, reason, idempotencyKey, confirmed=true) [C] → keep `migrationId`, `reused`; report both and the key.
5. Verify: {{tool:get_aish_runner_management_overview}}(accountId) → host `legacy == false`. Done. `reused == true` and `legacy == true` → Stop and ask row 3.
6. Rollback: {{tool:get_aish_runner_management_overview}}(accountId) → the host: `updatedAt`; `legacy == true` → STOP: "already rolled back". migrationId: from step 4 of this conversation; else the host's `recentAudit[]` newest entry with `type == "legacy-host-migrated"` → `metadata.migrationId`; else, only when the original key is known, SHA-256 hex of `<accountId>:<hostId>:<idempotencyKey>`; none → ask the user.
7. Ask "Undo migration <migrationId>? Reason?"; on "yes": {{tool:rollback_aish_legacy_runner_migration}}(accountId, migrationId, expectedUpdatedAt, reason, confirmed=true) [C], once (no key); after a timeout re-read (step 8) before any retry.
8. Verify: {{tool:get_aish_runner_management_overview}}(accountId) → host `legacy == true`.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| "not bound to the legacy host workspace" | the binding was revoked: "The account owner must re-bind: `lpm aish accounts bind-workspace --account <accountId> --workspace <workspaceId>`." workspaceId: ask the user, or the host's `lastTask.projectId` → get the project's `workspaceId` ({{skill:lpm-start}}) |
| "AISH host changed" | overview: target reached → done; else preview again with a new key |
| apply returned `reused: true` but the overview still shows `legacy == true` | a previous migration with this key was rolled back: generate a new key (`migrate-<hostId>-<yyyymmddHHMMss>`), preview again (step 2) |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| migration (step 4) | {{tool:get_aish_runner_management_overview}} | host `legacy == false` |
| rollback (step 7) | {{tool:get_aish_runner_management_overview}} | host `legacy == true` |

## Report fields
- accountId, hostId, idempotencyKey, migrationId
- `legacy` before → after; reason given
- pending: workspace binding — the account owner
