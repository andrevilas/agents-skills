# Evidence and closure
Load when: before attaching evidence or closing an activity
Applies to: lpm-deliver-activity, lpm-aish-delivery, lpm-release-product, lpm-pilot-feedback    Source: cards `upload_activity_attachment`, `create_activity_attachment`, `list_activity_attachments`, `list_workspace_activities`, `create_comment`, `update_issue`; process rules (Evidence, pilot pattern)
Owner skill: lpm-deliver-activity

## Summary
- Evidence (screenshots, logs, test reports) goes on the activity's feed entry: resolve `activityId` with `list_workspace_activities`, upload with `upload_activity_attachment`, confirm with `list_activity_attachments`.
- `activityId` is a feed entry id (`targetType == "issue"`, `targetId == issueId`), never the issueId.
- Never claim evidence is attached until a list call shows the returned id.
- Close only when every acceptance criterion has a test result or an attachment; otherwise report one named pending item.
- Build ≠ deploy ≠ smoke: each is separate evidence.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `contentBase64` | standard base64; a `data:<mime>;base64,` prefix is stripped | non-empty, at most 10 MiB decoded |
| `fileName` | ≤180 characters, no `/`, `\` or control characters | name it after what it proves |
| `fileType` | MIME `type/subtype` | UI evidence: `image/png` or `image/jpeg`, one per changed view (1280x800; add 390x844 when the mobile layout changes) |
| `idempotencyKey` (upload) | 16–128 characters `[A-Za-z0-9_-]`, no dots or colons | recipe `ev-<issueId>-<fileName, chars outside [A-Za-z0-9_-] → _>-<capturedAt yyyymmddHHMM>` (never invent hash characters); same key on retry, new key for new content |
| `create_activity_attachment` | registers a URL, not idempotent, every call adds one | list before any retry; never a URL with a token |
| `description` | ≤20,000 characters | say what the file proves |
| comments | ≤20,000 characters (`create_comment`) | long logs go in an attachment |
| upload result | "Activity attachment uploaded with ID: <id>" (id starts with `private-`) | Verify: the id appears in `list_activity_attachments` |
| no feed entry for the issue | nothing to attach to | `create_comment` first; its new feed entry (type comment_added) becomes the activityId |
| OAuth connector | attachment tools are absent | comment with links; report "evidence pending (API key or web UI)" |
| factory-governed issue (`factoryGovernance`) | `done` needs a current passed `audit_aish_issue_delivery` | AISH closure → `lpm-aish-delivery` |
| `status: done` without evidence | the server accepts it (outside factory issues) | the closure check is yours; never skip it |

| Evidence store | Holds | Tool family |
|---|---|---|
| activity attachment | human-recoverable proof for an activity | `upload_activity_attachment`, `list_activity_attachments` |
| protocol evidence | media of an intake protocol (WhatsApp) | `create_protocol_evidence_attachment` |
| AISH delivery artifact | factory outputs of a job | `register_aish_delivery_artifact`, `list_aish_delivery_artifacts` |
| knowledge item | a URL to a reusable document, never evidence | `create_knowledge_item` |

## Rules
1. Resolve the activityId; skip files already attached (same `fileName`).
2. Attach only what proves the result; never secrets; redact screenshots first.
3. Retry a failed upload once with the SAME key; "File operation could not be completed." → check base64, size, fileName, fileType, key format.
4. Closure order: correction → reproducible test → registered evidence → approved result or one specific pending item → next step.
5. A commit, a build log or a chat message alone never closes an activity.
6. A deploy claim needs the deployed revision and a smoke result after the deploy.

## Examples
```text
example: upload_activity_attachment(projectId, activityId, fileName="login-mobile-390x844.png",
  fileType="image/png", contentBase64=<base64>, description="Login works on mobile after fix",
  capturedAt="2026-10-06T10:00:00Z", idempotencyKey="ev-uRubTAhmX6veNW7NVTRP-login-mobile-390x844_png-202610061000")
-> "Activity attachment uploaded with ID: private-..." -> list_activity_attachments -> id present
```
