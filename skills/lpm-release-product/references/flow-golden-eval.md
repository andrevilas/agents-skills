# Flow: golden-set evaluation of a candidate
Load when: SKILL.md P3

## Preconditions
1. candidateUrl, revision, projectId, issueId, mainPath, wtPath: SKILL.md §3 (new session: `release-inputs.md`). subsetIds: advisor-golden-set Facts; pilotWorkspaceId = `workspaceId` of the `xpory-` questions. `test -n "$LPM_API_KEY"` passed; never print the key.
2. Baseline per id, taken BEFORE step 4 so the new report is not its own baseline: `jq -r '.generatedAt as $t | .results[] | [.id, $t, .pass] | @tsv' <mainPath>/docs/evaluation/reports/advisor-*.json <wtPath>/docs/evaluation/reports/advisor-*.json | sort -k1,1 -k2,2r | awk '!seen[$1]++'` → one line per id: id, report time, `true`/`false`. An id with no line → "no baseline" for that id only.
3. Golden ledger (today, UTC): `for f in <mainPath>/../lpm*/docs/evaluation/reports/advisor-$(date -u +%F)T*.json; do jq -e '[.results[].id | select(startswith("xpory-"))] | length > 0' "$f" >/dev/null && echo "$f"; done`, plus {{tool:list_comments}}(projectId, issueId) → a `content` starting "golden-full-run <today>". Any hit, or unsure → a full XporY run happened today.
4. Remaining XporY tokens today: no MCP tool returns today's use. Only the owner can state it in this conversation (or read it in the web AI-cost view). {{tool:get_workspace_ai_config}}(workspaceId=pilotWorkspaceId) → `usageLimits.dailyTokenBudget` is the limit, not the use; `null` = no daily limit (not "unknown").

## Steps
1. Default ids = subsetIds (demo and LPM). At most one full XporY run per UTC day.
2. Full run only when precondition 3 found no run today AND the owner stated remaining tokens ≥ (number of `xpory-` questions × 18k) + 60k (advisor-golden-set rule 1). Else subsets only.
3. One new `xpory-` regression question → `--only <id>` when step 2's budget check passes for one question; else tomorrow.
4. `LPM_BASE_URL=<candidateUrl> npx tsx scripts/evaluate-advisor-golden-set.ts --only <ids>` → keep the `Report:` path (reportFile). Never `--with-answers`.
5. Per id: `true` in its baseline and FAIL now → re-run that id once (`--only <id>`); still FAIL → Stop table.
6. FAIL with `ai_usage_limit_reached` is no measurement → Stop table; never raise a budget.
7. Commit reportFile in wtPath with the `LPM-Activity:` trailer, so the next run has a baseline (the owner prefers not to commit → copy it to `<mainPath>/docs/evaluation/reports/` after the deploy).
8. After a full XporY run → {{tool:create_comment}}(projectId, issueId, content="golden-full-run <YYYY-MM-DD UTC> <revision> <reportFile>", idempotencyKey="golden-full-<yyyymmdd>") [A] → commentId from "Comment created with ID: <id>".
9. Verify: reportFile schema is `advisor-golden-set-report/1`; no id went `true` → FAIL; after step 8, SKILL.md §7 comment check for commentId.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| step 5 regression | "Question <id> regressed (PASS → FAIL). Promotion stopped." |
| step 6 | "The golden run hit the AI budget (<workspace>); it is no measurement. Promotion stopped." |
| full run wanted, ledger hit or tokens not stated | subsets only; never change a budget |

## Verify
Step 9.

## Report fields
ids (subset or full); pass rate baseline → now; regressions (ids or none); "no baseline" ids; reportFile; ledger commentId.
