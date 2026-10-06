# Playbook: migration
Use when: apply or roll back a roadmap migration (governance or v2)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or skill lpm-start | STOP. Say: "Which LPM workspace?" |
| order | the owner's message, quoted verbatim: the speaker says they are the workspace owner and orders this migration or rollback for this workspace | STOP. Say: "A migration is the workspace owner's decision. Nothing was changed." |
| action | "apply" (governance migration), "apply-v2" or "rollback" | STOP. Say: "Apply the governance migration, apply the v2 migration, or roll back a run?" |
| migrationId | for rollback: the apply's id (migration_ plus 32 hex) from the user or an earlier Answer | "none"; for rollback STOP. Say: "Which migration run (id migration_…)?" |
| stamp | the current UTC date and time, yyyymmddHHMM | STOP. Say: "What is the current UTC time (yyyymmddHHMM)?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Nothing more was changed."
1. IF <input:action> == "apply-v2" → go to step 6.
   IF <input:action> == "rollback" → go to step 10.
2. CALL {{tool:preview_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: toSnapshot = result.roadmapItemsToSnapshot; toClassify = result.legacyIssuesToClassify
   IF <saved:toSnapshot> == 0 and <saved:toClassify> == 0 → STOP. Say: "Nothing to migrate: 0 items and 0 activities. Nothing was changed."
3. ASK: "Run apply_workspace_roadmap_governance_migration(workspaceId=<input:workspaceId>, idempotencyKey=gov-migration-<input:workspaceId>-<input:stamp>, confirmed=true)? It stamps governanceVersion 1 on <saved:toSnapshot> items and workOrigin legacy-unknown on <saved:toClassify> activities (deleted ones too), in chunks of 400 with no global transaction. A rollback exists. (yes/no)" — continue only if the user says yes; otherwise STOP.
4. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: apply the governance migration on <input:workspaceId>?"
5. CALL {{tool:apply_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>","idempotencyKey":"gov-migration-<input:workspaceId>-<input:stamp>","confirmed":true} [O]
   IF the call returns an error → STOP. Say: "<error text>. After a timeout run this step again with the same stamp (same key); never a new key for this run."
   SAVE: runId = result.id; writes = result.appliedWrites
   VERIFY: CALL {{tool:preview_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or result.roadmapItemsToSnapshot != 0 or result.legacyIssuesToClassify != 0 → STOP. Say: "Run <saved:runId> wrote <saved:writes>, but the preview still shows <items> items and <activities> activities."
   SAVE: readBack = "preview 0 items, 0 activities"
   GO TO Answer
6. CALL {{tool:preview_workspace_roadmap_v2_migration}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: valid = result.valid; v2mode = result.mode; legacyCount = result.legacyItemCount; rows = result.rows
   VERIFY: CALL {{tool:list_workspace_roadmap_items}} {"workspaceId":"<input:workspaceId>","compact":true,"includeArchived":true} [A]
   IF the call returns an error or an itemId of <saved:rows> is not listed with lifecycle "materialized" → STOP. Say: "The v2 preview does not match the roadmap. Nothing was changed."
   IF <saved:legacyCount> == 0 or <saved:v2mode> == "no-op" → STOP. Say: "Nothing to migrate (v2). Nothing was changed."
   IF <saved:valid> != true → STOP. Say: "The v2 migration cannot run: <saved:rows>. It is written for exactly 10 legacy lineages. Nothing was changed."
7. ASK: "Run apply_workspace_roadmap_v2_migration(workspaceId=<input:workspaceId>, idempotencyKey=roadmap-v2-<input:workspaceId>-<input:stamp>, confirmed=true)? It rewrites <saved:legacyCount> legacy items, one transaction each, and has NO rollback: a failure midway leaves the rest unmigratable. (yes/no)" — continue only if the user says yes; otherwise STOP.
8. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: apply the v2 migration on <input:workspaceId>? It cannot be undone."
9. CALL {{tool:apply_workspace_roadmap_v2_migration}} {"workspaceId":"<input:workspaceId>","idempotencyKey":"roadmap-v2-<input:workspaceId>-<input:stamp>","confirmed":true} [O]
   SAVE: runId = "v2"; writes = result.appliedItemIds
   VERIFY: CALL {{tool:list_workspace_roadmap_materializations}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or an entry of an item in <saved:writes> has no lineageState → STOP. Say: "The v2 apply returned <saved:writes>, but the materializations of <item> are not migrated."
   SAVE: readBack = "every materialization of <saved:writes> has a lineageState"
   GO TO Answer
10. CALL {{tool:preview_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>"} [A]
   SAVE: beforeSum = result.roadmapItemsToSnapshot + result.legacyIssuesToClassify
11. ASK: "Roll back migration <input:migrationId> on <input:workspaceId>? It deletes workOrigin and roadmapLineageRefs from every activity that run stamped, also roadmap lineage added after the run. (yes/no)" — continue only if the user says yes; otherwise STOP.
12. ONLY IF the owner ordered it in this conversation (quote the order); otherwise STOP. Say: "Decision needed: roll back migration <input:migrationId>? Lineage added after it is lost."
13. CALL {{tool:rollback_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>","migrationId":"<input:migrationId>","idempotencyKey":"gov-rollback-<input:migrationId>","confirmed":true} [O]
   SAVE: runId = <input:migrationId>; writes = result.rolledBackWrites
   VERIFY: CALL {{tool:preview_workspace_roadmap_governance_migration}} {"workspaceId":"<input:workspaceId>"} [A]
   IF the call returns an error or <saved:writes> == 0 → STOP. Say: "Run <input:migrationId> had nothing to undo, or the id is wrong. A new apply after a rollback needs a new stamp."
   SAVE: readBack = "preview sum <saved:beforeSum> before, <roadmapItemsToSnapshot + legacyIssuesToClassify> after (rises by at most <saved:writes>)"

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:workspaceId> / <input:action>; owner order: "<input:order>"
Done: <governance migration <saved:runId>: <saved:writes> writes | v2 migration: items <saved:writes> | rollback of <saved:runId>: <saved:writes> writes undone | preview only, nothing changed>
Evidence: <<saved:readBack> | none>
Pending: <none | the counts the re-read still shows>
Next: <the ASK or STOP text that ended the run | keep <saved:runId> for a rollback | none>
```
v2 preview mode: no-op | migration-required (after an apply it can stay migration-required; judge by legacyItemCount). Never claim a migration result that a VERIFY above did not show.
