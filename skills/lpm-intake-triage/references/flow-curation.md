# Flow: curate and merge operational entries
Load when: decision row 6 (curate an entry), row 7 (find or merge duplicates), row 8 (AI proposal) or row 9 (convert to an activity) of SKILL.md

## Preconditions
1. Key profile planning or full. Read {{ref:operational-entry-curation}} for the state machines and the `decision` object.
2. Approve, reject, defer and the entry that stays in a merge are the user's decisions: record them with the user's words.
3. {{tool:find_operational_entry_semantic_matches}} and {{tool:suggest_operational_entry}} spend AI quota ({{ref:ai-cost-and-budgets}}): one call per entry, never in a loop.

## Steps
Curate an entry (row 6):
1. {{tool:list_operational_entries}}(projectId, curationState="new", then "under_review") → `items[].id`; cursor=`nextCursor` while `hasMore`.
2. {{tool:get_operational_entry}}(projectId, entryId) → keep `curationState`, `status`, `relatedTaskId`, `duplicateOfEntryId`. `duplicateOfEntryId` set → use that primary; `relatedTaskId` set → already linked: report.
3. Fixes and `new` → `under_review` → `classified`, one step per call: {{tool:update_operational_entry}}(projectId, entryId, curationState, changed fields) [C].
4. Approve, reject, defer: {{tool:update_operational_entry}}(…, curationState, decision={decisionType, decidedBy, decidedAt=<ISO now>, rationale=<user words>}) [C]. Map: approve → curationState "approved", decisionType "create_task" (or "link_existing_task" with relatedTaskId, step 5); reject → "rejected", decisionType "reject", status "archived"; defer → "deferred", decisionType "defer", decision.revaluationDate, status "open". Approve only from `classified` (do step 3 first); defer only from `under_review`, `classified` or `approved`; reject from any state but `consolidated`/`rejected`. decidedBy: the server replaces it with the caller on approve/reject/defer; send {{tool:list_api_keys}} → `userId` (every row is the caller's; it needs a full or custom key, else ask the user for their uid).
5. Existing activity: issueId from the user or {{tool:list_issues}}(projectId) → `id` (same project). With the user's approval and `curationState == "classified"` → one call: {{tool:update_operational_entry}}(…, curationState="approved", relatedTaskId=issueId, decision={decisionType="link_existing_task", targetTaskId=issueId, decidedBy, decidedAt, rationale}) [C]. Otherwise only {{tool:update_operational_entry}}(…, relatedTaskId=issueId) [C]. Work moves: {{tool:update_operational_entry}}(…, status="in_progress" or "resolved") [C], only if `approved`.
6. Verify: {{tool:get_operational_entry}} → `curationState`, `status`, `decision.decisionType` as sent; report `priority`.

Merge duplicates (row 7):
7. The user named both entries → skip this step; go to step 8. Otherwise: {{tool:get_operational_entry}}(projectId, entryId) → `title`, `description` → {{tool:find_operational_entry_semantic_matches}}(projectId, entryId, title, description) once → `matches[]`; a match with `duplicateOfEntryId` → that id is the primary. Unavailable → compare titles from {{tool:list_operational_entries}}.
8. [C] Ask which entry stays (§ Stop and ask) → keep primaryEntryId, duplicateEntryId. A match is a candidate, not proof.
9. {{tool:get_operational_entry}}(projectId, primaryEntryId) and {{tool:get_operational_entry}}(projectId, duplicateEntryId). The kept entry has `duplicateOfEntryId` (already merged) → {{tool:get_operational_entry}}(projectId, duplicateOfEntryId) → not `consolidated`/`rejected`/`archived` → ask "'<kept>' was already merged into '<title>' (<id>). Merge '<duplicate>' into '<title>' instead? The duplicate is archived for good. (yes/no)" (yes → primaryEntryId = <id>); else STOP and report. Either has `curationState` `consolidated`/`rejected` or `status` `archived` → STOP and report. Duplicate has `relatedTaskId` → ask "Its activity <relatedTaskId> stays; archive the entry anyway?" before the merge question.
10. {{tool:consolidate_operational_entries}}(projectId, primaryEntryId, duplicateEntryId, rationale) [C]. Timeout → read the duplicate; never re-call.
11. Verify: {{tool:get_operational_entry}}(projectId, duplicateEntryId) → `consolidated` and `archived`.

AI triage proposal (row 8):
12. {{tool:get_operational_entry}}(projectId, entryId) → `agentSuggestion` set → report it; call {{tool:suggest_operational_entry}}(projectId, entryId) only when it is empty or the user asks for a fresh proposal (paid AI call), once. Verify: {{tool:get_operational_entry}} → `agentSuggestion` set.

Convert an entry into an activity (row 9):
13. {{tool:get_operational_entry}}(projectId, entryId) → `relatedTaskId` set → report it, STOP. Go on only if `curationState == "approved"`, or `classified` with a rationale in the user's words.
14. [C] Ask (§ Stop and ask) → {{tool:convert_operational_entry_to_issue}}(projectId, entryId, rationale, assigneeId) → `issueId`. assigneeId: {{tool:list_project_assignable_members}}(projectId) → `uid`, or omit.
15. Verify: {{tool:get_operational_entry}}(projectId, entryId) → `relatedTaskId == issueId`. Next: owner, cycle, dates in {{skill:lpm-plan-work}}.

## Stop and ask
Ask in the user's language: translate the template, keep ids, enum values and the quoted reason verbatim; yes/no → sim/não in PT-BR.

| Situation | Do / ask exactly |
|---|---|
| curation decision missing | "Approve, reject or defer '<title>'? Reason? (defer: re-evaluation date)" |
| link without approval (step 5) | "Link '<title>' to activity <issueId> and approve the entry? Reason?" |
| merge (step 8) | "Merge '<duplicate>' into '<primary>'? The duplicate is archived for good. (yes/no)" |
| conversion (step 14) | "Create activity '<title>' in <projectName>, assignee <name or none>? (yes/no)" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| {{tool:update_operational_entry}} | {{tool:get_operational_entry}} | `curationState`, `status`, `decision.decisionType` as sent |
| {{tool:consolidate_operational_entries}} | {{tool:get_operational_entry}}(duplicate) | `curationState == "consolidated"` and `status == "archived"` |
| {{tool:suggest_operational_entry}} | {{tool:get_operational_entry}} | `agentSuggestion` set |
| {{tool:convert_operational_entry_to_issue}} | {{tool:get_operational_entry}} | `relatedTaskId == issueId` |

## Report fields
Scope (project), entry ids with `curationState` and `priority`, decision type and reason (quoted), primary and merged entry ids, created issueId, Pending, Next.
