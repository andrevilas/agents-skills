# Code index lifecycle
Load when: before any refresh, activate, rollback or purge
Applies to: lpm-code-index    Source: cards of get_repository_index_status, preview_repository_code_index, refresh_repository_code_index, activate_repository_code_index, rollback_repository_code_index, purge_repository_code_index, reconcile_workspace_code_indexes, scan_workspace_repository_readonly

## Summary
Only workspace repository links carry a code index; project links get metadata scans only.
A build is an immutable version: preview (dry run) → refresh (candidate, `validating`) → activate (live).
Activate and rollback need `expectedGeneration` = the current `pointer.generation` (0 when `pointer` is null).
GitHub pushes and the daily maintenance job already refresh and activate stale or missing indexes.
Caps (files, chunks, daily documents) are the owner's financial decision: never work around them.
Purge is irreversible and only for old, terminal versions; always dry-run first.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `pointer` null | the repository was never indexed | `expectedGeneration` = 0; rollback is impossible |
| `pointer.activeIndexVersionId` | the version every agent and the Advisor search | verify it after activate or rollback |
| `pointer.previousIndexVersionId` | the only rollback target | null → no rollback; offer a refresh |
| `pointer.expectedRepositoryCommitSha` | commit of the active version | base commit for {{tool:compare_repository_commits}} |
| `pointer.generation` | integer, +1 on every activate and rollback | re-read with {{tool:get_repository_index_status}} right before each activate or rollback |
| version `validating` | a refresh result that is not live yet | the only status {{tool:activate_repository_code_index}} accepts |
| version `active` / `superseded` / `failed` | live / replaced (rollback target) / build failed (`failureReason`) | a failed build: fix the cause, refresh again |
| candidate not in `versions[]` | status lists only the active and previous versions | keep the `id` that {{tool:refresh_repository_code_index}} returned |
| `idempotentReplay: true` | refresh of an already-built commit | same commit → same version id; `status == "active"` means already live |
| reconcile `state` | `missing` (no index), `stale` (branch moved after indexing), `current` | the requested repository `current` → STOP, nothing to do |
| reconcile scope | at most 25 active agent-visible links, one GitHub preview each; archived and hidden links are skipped | `results` empty or the repository absent is NOT current: check the link (SKILL.md P0) or re-run with `repositoryLinkId`; one failing repository fails the whole call |
| preview `truncated: true` | more eligible files than `maxFiles` | implementation code is kept before tests, config and docs |
| `maxFiles` | 500 files per build by default (platform max 1000) | report it; raising it is not an agent decision |
| chunk cap | 5,000 chunks per build | "exceeds configured document cap 5000" → owner decision, STOP |
| daily document cap | configured daily indexing capacity | "exceeds the configured daily document cap" → owner decision, STOP |
| eligible file | source, config or doc extension, ≤ 512 KB, outside node_modules/dist/build/vendor/coverage/secrets; no lock, min.js, map or .env files | explains why a file never appears in search |
| refresh duration | synchronous; server timeout 9 min | client timeout → wait ~10 min, then one call with the same key and commit |
| refresh `idempotencyKey` | stored only; dedupe is by commit | recipe `manual:<yyyy-mm-dd>:<repositoryLinkId>` |
| purge eligibility | `superseded` or `failed`, not active or previous, ≥ 30 days old, no incident hold, not purged | `reasons[]`: active-version, rollback-version, non-terminal-version, incident-hold, purge-in-progress, already-purged, retention-window |
| purge retention | the daily maintenance job purges eligible versions after 30 days | routine cleanup needs no agent action; a secret indexed in a recent or rollback version cannot be purged here → SKILL.md §6 incident |
| scan vs index | a scan stores GitHub metadata (commit, languages, tree); it never refreshes the index | after a scan, still check reconcile `state` |
| scan limits | 10 scans per workspace hour (project, workspace and automated), 30 s, 30 GitHub requests, 5 MB | a failed scan still counts: never repeat in a loop |
| scan age | older than 24 h = stale | re-scan before stating the current branch or commit |
| GitHub access for indexing | GitHub App, or the personal credential of the link creator (`credentialOwnerId`) | the workspace vault token is used only by scans with `credentialSource="workspace"` |
| archived or `agentVisible == false` link | "not available for code intelligence" | unhide with an update, or link again (new id, no index) |

## Rules
1. Run {{tool:reconcile_workspace_code_indexes}} before any refresh; the requested repository `current` → STOP.
2. Run {{tool:preview_repository_code_index}} before {{tool:refresh_repository_code_index}}; pass its `commitSha`.
3. Never call refresh twice in a row: a repeat while the build is running restarts it.
4. Activate only a `validating` candidate, once; after success verify with status, never re-send.
5. "Code index pointer generation conflict" → re-read status; target already active → done; else retry once with the new generation.
6. Roll back once: it is a swap, so a second rollback re-activates the version just replaced.
7. Purge with `dryRun=true` first; the real purge needs a reason of at least 10 characters and the user's explicit yes.
8. Indexing disabled ("dedicated data store is not configured") is platform configuration: STOP and report.

## Rollback
Decision row 5. One call; verify, never re-send.
1. {{tool:get_repository_index_status}}(workspaceId, repositoryLinkId) → keep `pointer.generation` (expectedGeneration), `previousIndexVersionId`. Null → no rollback; offer a refresh (SKILL.md P2).
2. [C] "Roll back <url> to older code?" → {{tool:rollback_repository_code_index}}(workspaceId, repositoryLinkId, expectedGeneration) [C], once.
3. Verify: AFTER rollback call {{tool:get_repository_index_status}} AGAIN (the rollback response does not count) → `pointer.activeIndexVersionId` == step 1 `previousIndexVersionId`.

## Purge
Decision row 6. Irreversible; dry run first.
1. versionId: only from the user or an earlier refresh result in this conversation; never from `versions[]` (it lists only the active and rollback versions, which are never eligible). None → STOP: "Old versions are purged automatically after 30 days." reason: from the user, ≥ 10 characters.
2. [C] "Dry-run purge of <versionId>?" → {{tool:purge_repository_code_index}}(workspaceId, versionId, reason, dryRun=true) [C] → keep `eligibility`. `eligibility.eligible == false` → STOP, report `reasons[]`.
3. [C] "Delete <versionId> forever?" → {{tool:purge_repository_code_index}}(workspaceId, versionId, reason, dryRun=false) [C].
4. Verify: {{tool:purge_repository_code_index}}(workspaceId, versionId, reason, dryRun=true) → `eligibility.reasons` contains `already-purged`; {{tool:get_repository_index_status}} → active version unchanged.

## Examples
```text
example: status before activate
pointer: null                       -> expectedGeneration = 0
pointer.generation: 4               -> activate(versionId=<refresh id>, expectedGeneration=4) -> generation 5
example: idempotencyKey = manual:2026-10-06:<repositoryLinkId>
example: reconcile result {state: "stale", indexedCommitSha: A, repositoryCommitSha: B}
  -> compare_repository_commits(base=A, head=B) lists the changed files (max 100)
```
