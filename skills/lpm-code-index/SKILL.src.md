# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "no_active_index", "o índice de código está desatualizado?", "reindexa o repositório"
- "link a repository to project X", "roll back the code index", "compare commits A and B"
Do not use:
| If the request is about | Use |
|---|---|
| what the code does | {{skill:lpm-ask-advisor}} |
| a GitHub token or credential | {{skill:lpm-access}} |
| index caps, search quota | {{skill:lpm-ai-cost}} |
| a commit for an activity | {{skill:lpm-deliver-activity}} |
| a new project kickoff | {{skill:lpm-workspace-admin}} |

## 2. Preconditions
1. Owner/admin for every write, preview and reconcile (project links: project manage); status and compare: workspace read.
2. Index tools take a workspace link id; project links are never indexed.
3. Read-only request → no write tool (scans are writes).

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| workspaceId, projectId | {{skill:lpm-start}} §3 | ask |
| repositoryUrl | user | ask "Which repository? `https://github.com/<owner>/<repo>`" |
| repositoryLinkId | {{tool:list_workspace_repository_links}}(workspaceId) / {{tool:list_project_repository_links}}(projectId) → `id` of that `canonicalRepositoryUrl` | 0 → row 2; 2+ → ask |
| expectedGeneration | {{tool:get_repository_index_status}} → `pointer.generation` (null → 0) | re-read each time |
| idempotencyKey | `manual:<yyyy-mm-dd>:<repositoryLinkId>`, only for {{tool:refresh_repository_code_index}}; no other tool here takes a key | — |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 0 | on a connector | {{tool:list_workspace_repository_links}} → report links, `lastScanAt`; say "index state needs an LPM API key" | A | never state index freshness from `lastScanAt` |
| 1 | current? stale? `no_active_index` | `no_active_index` → flow-repository-links § P0 first; then P1 | A | requested repo `current` |
| 2 | link, change or unlink a repository | flow-repository-links § Steps | C | private, no access → §6 |
| 3 | scan; `lastScanAt` > 24 h; scan failed | asked to scan → flow-repository-links § Scan; else report, offer a scan | A | completed < 24 h → report |
| 4 | refresh a missing/stale index | P2 (includes activate) | C | cap → §6; indexing disabled → §9 |
| 5 | revert a bad new index | code-index-lifecycle § Rollback | C | no `previousIndexVersionId` → P2 |
| 6 | delete old index content | code-index-lifecycle § Purge | C | `eligibility.eligible == false` |
| 7 | files changed between commits | {{tool:compare_repository_commits}}(…, baseCommitSha, headCommitSha): P1 or user SHAs | A | short SHA → ask |
| 8 | scan with the workspace vault | flow-repository-links § Scan, `credentialSource="workspace"` | A | no vault → {{skill:lpm-access}} |

## 5. Procedures
### P1 Check — row 1
1. {{tool:reconcile_workspace_code_indexes}}(workspaceId[, repositoryLinkId]) → per `repositoryUrl`: `state`, `indexedCommitSha`, `repositoryCommitSha`.
2. Say "Index current; pushes and the daily job refresh it." only if the requested repo is in `results` with `state == "current"`. Empty `results` or repo absent → not current: flow-repository-links § P0. Else report; offer P2.
3. "You do not have permission" → {{tool:get_repository_index_status}} `pointer.expectedRepositoryCommitSha` vs list `lastKnownCommit` (scan < 24 h) → indicative only; STOP.
### P2 Refresh and activate — row 4 ({{ref:code-index-lifecycle}})
1. {{tool:get_repository_index_status}}(workspaceId, repositoryLinkId) → keep `pointer.generation`, `pointer.expectedRepositoryCommitSha`.
2. {{tool:preview_repository_code_index}}(workspaceId, repositoryLinkId) → keep `commitSha`, `selectedFileCount`. Same as step 1 SHA → STOP: "already current".
3. [C] "Refresh <url> at <commitSha> (<selectedFileCount> files, ~9 min)? refresh_repository_code_index(workspaceId=<id>, repositoryLinkId=<id>, commitSha=<sha>, idempotencyKey=manual:<yyyy-mm-dd>:<repositoryLinkId>)"
4. After "yes": {{tool:refresh_repository_code_index}} [C] as shown → keep `id`, `status`. Timeout → wait ~10 min, retry once with the SAME key.
5. `status == "active"` → step 8; not `validating` → STOP.
6. {{tool:get_repository_index_status}} again → expectedGeneration = `pointer.generation` (null → 0).
7. [C] "Activate <id>? activate_repository_code_index(workspaceId=<id>, versionId=<id>, expectedGeneration=<step 6>)" → "yes" → {{tool:activate_repository_code_index}} [C] once, exactly these 3 arguments (no repositoryLinkId).
8. Verify: AFTER activate call {{tool:get_repository_index_status}} AGAIN (the step 6 read and the activate response do not count) → pass only if `pointer.activeIndexVersionId == id`. Report ids, generation and version statuses only from this read.
9. Smoke: {{tool:search_workspace_code}}(workspaceId, query=<file name or identifier seen in this repo, e.g. `README.md`; not the repo name>, limit=10) → pass only on a hit with this `repositoryLinkId`, step 2 `commitSha`, `lexicalMatch: true`; quote `<path> (link <id>, commit <sha>, lexicalMatch true)`. Else (field missing = false) → Pending: smoke search inconclusive.
10. Step 8 passed → `state after: current`. Failed → never re-send activate; run P1, report its `state`.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| "document cap" | owner's decision request (authority-and-owner-decisions § Decision request), STOP |
| private repo: access error from preview, refresh, reconcile or compare | STOP: "The link creator (credentialOwnerId <id>) needs a personal GitHub credential in LPM, or an LPM admin must install the GitHub App." |
| secret or sensitive data indexed | STOP: incident decision request to the owner and an LPM admin (no purge here). |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| link write, scan | its list tool | flow-repository-links § Verify |
| activate, rollback | {{tool:get_repository_index_status}} AFTER the write | `pointer.activeIndexVersionId` == expected |
| purge | {{tool:purge_repository_code_index}}(…, dryRun=true) | `reasons` has `already-purged` |

## 8. Report (copy and fill)
```text
Scope: <workspace> / <repositoryUrl> (link <id>)
Done: <action + ids>; state after: <missing|stale|current|n/a> (required)
Evidence: <index: version, commit, generation <old> -> <new>, files, smoke hit path + lexicalMatch, rollback target | link: id, URL, mappings | scan: status, commit | compare: status, aheadBy, files | purge: reasons>
Pending: <none | item — who acts>
Next: <one action | none — index current>
```
Index evidence and `state after`: only from reconcile or a status read AFTER the write, never from the activate response.

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| "not available for code intelligence" | archived or hidden link → row 2 |
| omission "No authorized active repository link is mapped to this scope" | flow-repository-links § P0 |
| "Requested commit does not match the canonical branch head" | rerun P2 from step 2, once |
| `CODE_INDEX_NOT_ACTIVE`, `REPOSITORY_LINK_NOT_INDEXED` | P1, then P2 |
| search quota exhausted | Pending "smoke after 00:00 UTC" |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
