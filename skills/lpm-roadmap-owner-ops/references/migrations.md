# Roadmap governance mode and migrations
Load when: migrating
Applies to: lpm-roadmap-owner-ops    Source: cards {{tool:update_workspace_roadmap_governance_policy}}, {{tool:preview_workspace_roadmap_v2_migration}}, {{tool:apply_workspace_roadmap_v2_migration}}, {{tool:preview_workspace_roadmap_governance_migration}}, {{tool:apply_workspace_roadmap_governance_migration}}, {{tool:rollback_workspace_roadmap_governance_migration}} (`src/lib/roadmapMaterializationV2.ts`, `updateWorkspaceRoadmapGovernancePolicyCommand`)

## Summary
Two unrelated one-off migrations exist. The v2 migration is destructive, not atomic and has no rollback.
The governance migration stamps fields in chunks and can be rolled back, but the rollback can delete real lineage.
Changing the governance mode changes which roadmap tools work. All of these are the owner's decisions ([O]).
Previews are read-only ([A]); run one right before every apply and again to verify.

## Facts
### Governance mode ({{tool:update_workspace_roadmap_governance_policy}})
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `mode` | `off`, `shadow` or `enforce` | anything else → `INVALID_GOVERNANCE_MODE` |
| `enforce` | blocks direct item, bulk, dependency, allocation and lifecycle tools (`GOVERNANCE_REVIEW_REQUIRED`) | does NOT block the owner commit |
| `off` | change-request preview/submit fail with `ROADMAP_GOVERNANCE_DISABLED` | tell the owner the review flow stops working |
| `soloMaterialAlertThreshold` | 1–100, default 5; every Nth solo non-routine approval alerts all members | omitted → reset to 5: always pass the current value |
| `expectedUpdatedAt` | workspace `updatedAt` | `VERSION_CONFLICT` → re-read the workspace, retry |
| `idempotencyKey` | required; a reused key returns the earlier result, even for another mode | new key per change; check `result.mode` |
| returns | `mode`, `previousMode`, `policy{policyVersion, soloMaterialAlertThreshold}` | report `previousMode` → `mode` |

### v2 materialization migration
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| purpose | rewrites legacy materialized items (lifecycle `materialized`, schema not 2) and creates lineage claims | not for routine materialization |
| hard-coded scope | written for exactly 10 legacy lineages | any other count → `valid: false` |
| preview `valid == true` and `mode == "migration-required"` | the only state that allows apply | else STOP and report the rows |
| preview `legacyItemCount == 0` (`rows` empty), or `mode == "no-op"` | nothing to migrate | report; no apply |
| `alreadyMigrated` / `mode` | `no-op` only when EXACTLY 10 items are v2 `complete`; every later materialization adds one | after an apply `mode` can stay `migration-required`: judge by `legacyItemCount` (LPM bug) |
| access | API key profile `full` or `custom` (sensitive) | -32003 → core rule 2; never look for another key |
| apply | one transaction per item, no rollback tool | a failure midway leaves the rest unmigratable; report the preview |
| status | legacy one-off | treat as deprecated: apply only when the owner names the workspace |

### Governance migration
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| preview | `roadmapItemsToSnapshot`, `legacyIssuesToClassify`, `inferredRoadmapOrigins: 0` | show both counts to the owner |
| apply | stamps `governanceVersion` 1 on items and `workOrigin: "legacy-unknown"` on activities without an origin | never infers roadmap origin |
| writes | chunks of 400, no global transaction | after a timeout retry with the SAME key |
| `legacyIssuesToClassify` | excludes deleted activities; apply also stamps them | `appliedWrites` can exceed the preview count |
| apply `id` | `migration_<32 hex>`, needed for rollback | keep it; lost → call apply with the SAME key (replay) |
| rollback | deletes the run's fields, incl. `workOrigin` and `roadmapLineageRefs` on activities | lineage added after the run is lost too: say so before rollback |
| rollback `migrationId` | not validated | wrong id → `rolledBackWrites: 0` and still records a run |
| apply after a rollback | the old key replays the old run and writes nothing | use a NEW key |
| access | not sensitive; `portfolio` API-key profiles can call it | the owner's order is still required |

## Rules
1. Preview → show → owner's order → apply → preview again (Verify).
2. Rollback only for a run the owner names, after stating the lineage-loss risk.
3. Never fix migration data by hand; report the preview rows to the owner.

## Examples
```text
example: governance apply → {id:"migration_<32 hex>", status:"completed", appliedWrites:<n>}
example: verify after apply → preview shows roadmapItemsToSnapshot 0, legacyIssuesToClassify 0
example: idempotencyKey="gov-migration-<workspaceId>-202610061430" (a new apply after a rollback needs a new minute stamp)
```
