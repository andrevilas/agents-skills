# Session conversation content

Use for standalone conversation bodies attached to an execution session. This does not delete or migrate legacy events, plans, checkpoints, evidence, jobs or sessions.

## Read and export [A]

Resolve `sessionId` from the user or `get_aish_execution_session`. Call `get_aish_session_content` with `{sessionId, action:"list", limitCount:20}`. Follow `nextCursor` until the requested records are located or it is null; each page rechecks permissions. A null policy means none exists, not immediate deletion eligibility.

For selected records, call `{sessionId, action:"export", recordIds:[...]}` using IDs returned by list (1..100, no duplicates). The export is redacted, not a raw backup and not authorization to delete. Read-only keys can read; OAuth connectors do not expose these tools.

## Write [C]

Use `manage_aish_session_content` with `{sessionId, action:"write", commandId, text}` after the requested write is authorized. Reuse the same commandId (8..160 alphanumeric, underscore or hyphen) on retry. Text is 1..1000 characters without secrets. A scoped, unexpired policy must already exist and the session must accept new content. Verify the returned content ID with a selected export; never re-create a tombstoned record.

## Retention policy [O]

Requires the actual workspace owner's personal credential and exact order. Do not infer a retention duration from a general request to finish work. Read the current policy, then send only `{sessionId, action:"set-policy", commandId, expectedVersion, retainUntil, hold, reason, confirmed:true}`. Use current policy.version (0 when absent); retainUntil is the owner's ISO date or null to retain indefinitely; hold is explicit; reason is 16..1000 characters. Verify by reading list again. Version conflict: re-read and reconcile with the owner's decision, not blind retries.

## Selected deletion [O]

The tool's general [C] tag does not authorize its owner-only actions. An agent credential cannot set policy, preview deletion or delete, even when linked to the owner.

1. Require an exact owner order covering the selected bodies. Read the selection and policy. Only live records classified by the server as conversation can be removed, after explicit expiry, without hold, in a completed or canceled session. Failed sessions remain resumable and are ineligible.
2. Call `manage_aish_session_content` with `{sessionId, action:"preview-delete", recordIds}`. This is read-only and does not itself authorize deletion. Show count, IDs, current policy and scope. Do not silently change a selection.
3. Once that exact selection is authorized, call `{sessionId, action:"delete", recordIds, expectedPreviewDigest, confirmed:true}` using the fresh previewDigest. No invented digest or confirmation. State drift requires a fresh read and preview; materially changed scope requires a new owner decision.
4. Verify selected export has body:null, deletedAt and matching receipt tombstoneVersions. Audit identities and events remain. A lost response can be retried with the same digest and selection; current authority is checked again.

Report the session, operation, selected IDs/count and verified policy/receipt, without secrets. On denial, hold, stale state or missing owner order, stop that operation and report the reason; never change budgets or create a job to bypass it.
