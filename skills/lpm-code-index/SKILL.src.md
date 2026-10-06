# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when:
- "the Advisor says no_active_index", "o índice de código está desatualizado?"
- "reindexa o repositório", "link a repository to project X", "escaneie o repositório"
- "roll back the code index", "purge version X", "compare commits A and B"
Do not use:
| If the request is about | Use |
|---|---|
| what the code does | {{skill:lpm-ask-advisor}} |
| a GitHub token or credential | {{skill:lpm-access}} |
| index caps, search quota | {{skill:lpm-ai-cost}} |
| a commit for an activity | {{skill:lpm-deliver-activity}} |
| a new project kickoff | {{skill:lpm-workspace-admin}} |

## 2. Preconditions
1. Run one §4 row. CALL row: make that one call, reply with §8. Playbook row: open its file, do its steps in order, reply with its Answer block only.
2. Playbooks need an LPM API key; index tools and workspace links need a workspace owner/admin (full or custom key).
3. Only workspace links get a code index; index tools never take a project link id.

## 3. Inputs
| Input | Where it comes from | If missing |
|---|---|---|
| workspaceId | the user, or {{skill:lpm-start}} | ask "Which LPM workspace? (id)" |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 0 | on a ChatGPT/Claude connector | CALL {{tool:list_workspace_repository_links}} {"workspaceId":"<input:workspaceId>"} | A | `lastScanAt` is never index freshness |
| 1 | current? stale? `no_active_index` | playbook {{ref:flow-check}} | A | link missing or unmapped |
| 2 | link a repository | playbook {{ref:flow-link}} | C | already linked → row 8 |
| 3 | scan; scan older than 24 h | playbook {{ref:flow-scan}} | A | 10 scans per hour |
| 4 | refresh and activate the index | playbook {{ref:flow-refresh}} | C | document cap → owner |
| 5 | roll back the index | playbook {{ref:flow-rollback}} | C | no previous version |
| 6 | purge an old index version | playbook {{ref:flow-purge}} | C | not eligible |
| 7 | files changed between commits | playbook {{ref:flow-compare}} | A | short SHA |
| 8 | branch, mappings, unhide a link | playbook {{ref:flow-change-link}} | C | archived link |
| 9 | archive or hide a link | playbook {{ref:flow-unlink}} | C | no reason |

## 5. Procedures
| Playbook | Use when | File |
|---|---|---|
| check | is the code index current, stale or missing; no_active_index | {{ref:flow-check}} |
| link | link a new GitHub repository to the workspace or a project | {{ref:flow-link}} |
| scan | scan a linked repository (branch, commit, languages) | {{ref:flow-scan}} |
| refresh | build and activate a new code index (missing or stale) | {{ref:flow-refresh}} |
| rollback | put the previous code index version back | {{ref:flow-rollback}} |
| purge | delete the content of one old index version | {{ref:flow-purge}} |
| compare | list files changed between two commits | {{ref:flow-compare}} |
| change-link | change branch or project mappings, or unhide a link | {{ref:flow-change-link}} |
| unlink | archive a link, or hide it from agents | {{ref:flow-unlink}} |

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no repository | "Which repository? (https://github.com/<owner>/<repo>)" |
| a file or index cap | owner decision (LPM platform configuration); never work around it |
| a secret in the index | STOP: incident decision request to the owner and an LPM admin |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| activate, rollback | {{tool:get_repository_index_status}} after the write | `activeIndexVersionId` == expected (`expectedGeneration` re-read first) |
| link write, scan | its list tool | new fields, `archivedAt`, or `lastScanStatus` completed |
| purge | {{tool:get_repository_index_status}} | `contentPurgedAt` set; active unchanged |

## 8. Report (copy and fill)
A playbook's Answer block is this report, filled in; send it alone.
```text
Scope: <workspace> / <repositoryUrl> (link <id>)
Done: <action + ids>; state after: <missing | stale | current | unchanged>
Evidence: <ids, commits, generation, smoke hit | none>
Pending: <none | item — who acts>
Next: <the ASK or STOP text that ended the run | one action | none — index current>
```

## 9. Failures → fix
| Error or result contains | Do |
|---|---|
| "not available for code intelligence" | hidden → row 8; archived → row 2 |
| "No authorized active repository link is mapped to this scope" | row 1 with that projectId |
| `CODE_INDEX_NOT_ACTIVE`, `REPOSITORY_LINK_NOT_INDEXED` | row 1, then row 4 |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
