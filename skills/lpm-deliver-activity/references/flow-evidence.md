# Flow: attach evidence
Load when: decision row 5 of SKILL.md (attach proof), or {{ref:flow-close}} step 6

## Preconditions
1. LPM API key (attachment and feed tools are not offered to connectors). `credential == "oauth"` or -32003 → SKILL.md row 3.
2. projectId, workspaceId and issueId come from SKILL.md §3. The file comes from the user or your test run; over 10 MiB → a URL without tokens through {{tool:create_activity_attachment}} [A] (not idempotent: list before any retry).
3. Secret, token or personal data in the file → do not upload; redact first.

## Steps
Call order (all four calls, every time): {{tool:list_workspace_activities}} → {{tool:list_activity_attachments}} → {{tool:upload_activity_attachment}} once → {{tool:list_activity_attachments}}.
1. {{tool:list_workspace_activities}}(workspaceId, projectId, limit=50) → activityId = newest `id` with `targetType == "issue"` and `targetId == issueId` (a feed entry, never the issueId).
2. None → {{tool:create_comment}}(projectId, issueId, content="Evidence follows.", idempotencyKey="ev-anchor-<issueId>-<yyyymmddHHMM>") [A], then step 1 again. Still none → STOP and report "no feed entry for <issueId>".
3. ALWAYS, before any upload (also for a brand-new file; it also checks that activityId is valid): {{tool:list_activity_attachments}}(projectId, activityId). `fileName` already listed → do not upload; report that item's `id` and stop here. Not listed → step 4. Why: the key does not stop duplicates; a different description gives an error and a newer activityId gives a second copy.
4. Only after step 3 returned: {{tool:upload_activity_attachment}}(projectId, activityId, fileName, fileType, contentBase64 without `data:`, description=<what it proves>, capturedAt, idempotencyKey) [A].
   - capturedAt = the time the user gave, else the current UTC time; write it down and reuse it on a retry.
   - idempotencyKey = `ev-<issueId>-<fileName with every character outside [A-Za-z0-9_-] replaced by _>-<capturedAt as yyyymmddHHMM>`, e.g. `ev-iss_102-e2e-report_txt-202610061000`. It must be 16–128 characters: cut the fileName part when longer. Never invent hash characters.
   - UI prints: `image/png`/`image/jpeg`, one per changed view (1280x800; add 390x844 when the mobile layout changes). Test output: `text/plain`.
5. Failure → keep activityId, fileName, fileType, description, capturedAt and the key from the first try. Re-run step 3: the file is listed → done. Else retry once with the identical call (same key, same fields).
6. Verify: {{tool:list_activity_attachments}}(projectId, activityId) → the returned id exists.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no feed entry after step 2 | STOP; report "no feed entry for <issueId>" |
| the retry in step 5 fails | STOP; report the error; never switch to a new key or a newer activityId for the same file |
| secret in the file | do not upload; redact first |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| before the upload | {{tool:list_activity_attachments}} | `fileName` is not listed yet |
| upload or URL registration | {{tool:list_activity_attachments}} | the returned id is listed |

## Report fields
Use SKILL.md §8. Evidence: `<fileName> (id <attachment id>) on <activityId> proves <what>`, one line per file (the activityId is the feed entry, e.g. `act_…`, never the issueId). Done keeps the issue's real status (e.g. `status in-progress`): attaching evidence does not close the activity. Next: e.g. "close with the closure check" or "attach the UI print".
