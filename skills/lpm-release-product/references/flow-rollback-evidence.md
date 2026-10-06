# Flow: rollback, evidence, report and pilot notice
Load when: decision rows 7 and 8 of SKILL.md

## Preconditions
1. workspaceId, projectId, issueId, revision, `<svc>`, `<live>`: SKILL.md §3. Rollback target: P4 step 1 output of this run, captured BEFORE promotion; new session → `release-inputs.md` (from {{tool:list_comments}}(projectId, issueId)); none → STOP: SKILL.md §6 row "rollback target not found".
2. Guard (also when the user named the target): rollback target == current `<live>` output → STOP: "The rollback target <X> already serves 100 %. Which revision should take the traffic?"
3. activityId is the feed entry, NOT issueId: {{tool:list_workspace_activities}}(workspaceId, projectId, limit=50) → newest `id` with `targetType == "issue"`, `targetId == issueId`.

## Steps
0. Re-run `<live>` and the precondition 2 guard right before step 1.
1. Rollback: `gcloud run services update-traffic <svc> --to-revisions=<rollback target>=100`.
2. Re-run the SKILL.md P4 step 6 smoke; keep both smoke outputs (failing smoke line = the `MCP smoke` line of P4 step 6; second smoke line = the `MCP smoke` line of this step).
3. {{tool:create_comment}}(projectId, issueId, content="rolled back to <rollback target>\nsmoke before: <failing smoke line>\nsmoke after: <second smoke line>", idempotencyKey="rel-<revision>-rollback") [A].
4. Run steps 6–9 and 11 for the smoke and rollback outputs.
5. Verify: `<live>` prints exactly the rollback target; second smoke passed (else Stop table). STOP after that: no second promotion, no pilot notice (step 10).
6. Resolve activityId. None → {{tool:create_comment}}(projectId, issueId, content="Release evidence follows.", idempotencyKey="rel-<revision>-anchor") [A]; resolve again.
7. Resolve existing attachments: part of step 8 (its first call); never skip it.
8. First {{tool:list_activity_attachments}}(projectId, activityId); then for each kind (tests, golden, smoke, rollback) whose fileName is not listed: {{tool:upload_activity_attachment}}(projectId, activityId, fileName="rel-<revision>-<kind>.txt", fileType="text/plain", contentBase64, description, idempotencyKey="rel-<revision>-<kind>") [A]. For these 4 kinds fileName always ends in .txt and fileType is always text/plain. contentBase64 = base64 of this text per kind:
   - tests = the 3 summary lines of SKILL.md P1 step 5;
   - golden = subset ids, pass rate prev -> now, regressions, reportFile path (never the report JSON itself);
   - smoke = each `MCP smoke` line;
   - rollback = the step 3 comment text (no rollback → skip this kind).
   - only UI screenshots ({{ref:ui-e2e-emulator}} rule 3): kind `ui-<width>x<height>`, fileName="rel-<revision>-ui-<width>x<height>.png", fileType="image/png", contentBase64 = base64 of that PNG.
   No secrets, no answer text, no raw report or log file.
9. {{tool:create_comment}}(projectId, issueId, content=<report of {{ref:release-report-template}}>, idempotencyKey="rel-<revision>-report") [A].
10. P4 step 7 passed, no rollback → pilot notice of the same template → give it to the user; never message pilots yourself. Else no notice.
11. Verify: {{tool:list_activity_attachments}}(projectId, activityId) lists every returned id; SKILL.md §7 comment check passes for each commentId ("Comment created with ID: <id>").

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| smoke fails after rollback too | "Production fails on <rollback target> too. Owner action needed." |
| a call fails | read its card in {{ref:tools}}; still failing → STOP |

## Verify
Steps 5 and 11; SKILL.md §7.

## Report fields
Rollback target, both smoke lines, attachment ids, pilot notice or "not sent: <reason>".
