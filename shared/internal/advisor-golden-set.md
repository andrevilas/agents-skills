# Advisor golden set (maintainers)
Load when: before running, comparing or extending the Advisor golden set
Applies to: lpm-release-product, lpm-pilot-feedback    Source: lpm `docs/evaluation/advisor-golden-set.json`, `docs/evaluation/README.md`, `scripts/evaluate-advisor-golden-set.ts`, `CLAUDE.md`, `src/server/workspaceAiQuota.ts`
Owner skill: lpm-release-product

## Summary
- Harness: `LPM_BASE_URL=<candidate url> npx tsx scripts/evaluate-advisor-golden-set.ts --only <ids>` with `LPM_API_KEY` from the environment (never printed).
- At most one full XporY run per UTC day (the pilot workspace's 1M tokens/day budget), after the last deploy of the day.
- Between deploys run only the demo and LPM subsets (`--only`).
- Compare question by question with the previous report; single runs are noisy.
- Commit reports without answer text. Every confirmed pilot failure becomes a regression fixture.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `docs/evaluation/advisor-golden-set.json` | `{schema, notes, questions[{id, workspaceId, roadmapId?, itemId?, question, expect}]}`; id prefixes `demo-`, `lpm-`, `xpory-` | the prefix tells whose budget a question spends |
| one question | one real Advisor call in that question's workspace | spends its AI tokens and code-search quota |
| XporY question cost | about 18k tokens and up to 8 code searches each | 4 full runs on 2026-10-03 exhausted the pilot budget and broke the pilot's retest |
| daily budgets | XporY 1M tokens/day; demo and LPM 500k tokens/day each; leave 60k of buffer | reset at 00:00 UTC |
| subset ids | `jq -r '[.questions[].id \| select(startswith("demo-") or startswith("lpm-"))] \| join(",")' docs/evaluation/advisor-golden-set.json` | pass the output to `--only` |
| today's AI use | Firestore `workspaces/<workspaceId>/ai_usage_daily/<YYYY-MM-DD>` → `totalTokens`, `totalRequests` | read before a full XporY run |
| today's code searches | Firestore `owner_agent_usage_daily/<workspaceId>_<YYYYMMDD>` | read before a full XporY run |
| report | `docs/evaluation/reports/advisor-<timestamp>.json`, schema `advisor-golden-set-report/1` | commit it; never with `--with-answers` |
| `--min-pass-rate 0.8` | exits 1 below the rate | optional gate |
| fallback answers | count as failures by design | a run that hit `ai_usage_limit_reached` is not a measurement |
| `expect` fields | `citedPaths`, `forbiddenPaths`, `answerIncludes`, `answerIncludesAny`, `answerExcludes`, `maxCitedExcerpts` | use them when adding a fixture |

## Rules
1. Before a full XporY run: no full run today in the ledger (a `golden-full-<yyyymmdd>` comment, or a report of today with `xpory-` ids), and remaining tokens ≥ (number of `xpory-` questions × 18k) + 60k buffer; otherwise run subsets only.
2. Ledger: after a full XporY run, comment on the release activity "golden-full-run <YYYY-MM-DD UTC> <revision> <report file>" with idempotencyKey `golden-full-<yyyymmdd>`.
3. Never raise a workspace budget to make a run fit; that is the owner's decision.
4. Compare each question with the previous report of the same ids; a regression on a question that passed before → repeat that question once; still failing → STOP, no promotion.
5. Report pass rate, cited-file recall and p50/p95 latency; never answer text.
6. Confirmed Advisor failure → add a question with the files an expert would cite, plus a negative control when the failure was a fabricated answer.
7. Confirmed non-Advisor defect → a vitest regression test in the fix's change.

## Examples
```text
example: LPM_BASE_URL=<Candidate: line> npx tsx scripts/evaluate-advisor-golden-set.ts \
  --only demo-pix-blocker,lpm-oauth-optional-scope
-> PASS/FAIL per id, then "Report: docs/evaluation/reports/advisor-<timestamp>.json"
```
