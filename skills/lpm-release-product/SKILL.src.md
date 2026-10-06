# {{title}}
> Done when: {{doneWhen}}
{{banner:access}}
{{banner:authority}}
{{partial:core-rules}}
{{partial:tool-naming}}

## 1. Use when / Do not use
Use when (LPM maintainers, `lpm` repo):
- "deploy the fix to lpm.rocks", "faz o deploy em produção", "promover o candidato"
- "rollback da revisão do LPM", "add a regression for the pilot failure"
Do not use:
| If the request is about | Use |
|---|---|
| an AISH release package, delivery artifact or DoD | {{skill:lpm-aish-delivery}} |
| delivering an activity in any other repository | {{skill:lpm-deliver-activity}} |
| verifying a pilot or tester report | {{skill:lpm-pilot-feedback}} |
| a workspace AI budget, model or limit | {{skill:lpm-ai-cost}} |

## 2. Preconditions
1. `git remote get-url origin` ends in `/lpm` or `/lpm.git`; else row 1.
2. MCP tools need an API-key connection (not OAuth). Scripts need `LPM_API_KEY`, set by the maintainer; never print or create a key.
3. Load {{ref:lpm-repo-rules}} first (this file wins), {{ref:advisor-golden-set}} before P3; follow `AGENTS.md`.
4. Read-only request ("which revision is live?") → `<live>` only, no write.

## 3. Inputs
| Input | Get it from (call → field) | If missing |
|---|---|---|
| mainPath, wtPath | `git worktree list` → line 1; your `lpm-wt-<topic>` line | P1 step 1 |
| `<svc>` | `little-project-manager --project=gen-lang-client-0962999154 --region=us-west1` | — |
| `<live>` | `gcloud run services describe <svc> --format=json \| jq -r '.status.traffic[] \| select(.percent==100) \| .revisionName'` | — |
| issueId | the user, `LPM-Activity:` in `git log origin/main..HEAD --format=%B`, `<mainPath>/.lpm-activity`; confirm: {{tool:get_issue}}(issueId) | §6 |
| projectId, workspaceId | get_issue → `projectId`, `workspaceId` (absent → `workspaceId` of the `lpm-` questions in docs/evaluation/advisor-golden-set.json) | ask |
| revision, candidateUrl, promoteCmd; rollback target | P2 lines `Revision:`, `Candidate:`, `Promote:`; P4 step 1 (before promotion) | {{ref:release-inputs}} |

## 4. Decision table (first match wins)
| # | If the user wants / you see | Do | Auth | Stop if |
|---|---|---|---|---|
| 1 | not in the `lpm` repository | STOP: "This skill ships only the LPM product repository." | — | always |
| 2 | an experiment through an environment variable | Refuse. Offer (only if agreed): P1 on a branch → P2 → P3; no promotion without row 6. | — | — |
| 3 | write or fix code for the release | P1; deploy also asked → then row 4 | A | — |
| 4 | deploy / ship / subir para produção (fix included) | P1 (code committed → step 6 only) → P2 → P3 → P4 → row 8 | A | a check fails → §6 |
| 5 | evaluate a deployed candidate | P3 | A | — |
| 6 | promote a candidate | P4 | C | no P3 result ({{ref:release-inputs}}) → P3 first |
| 7 | smoke failed after promotion, or "rollback" | {{ref:flow-rollback-evidence}} steps 0–5 | A | target not found → §6; == `<live>` → flow precondition 2 |
| 8 | attach evidence, release report, pilot notice | {{ref:flow-rollback-evidence}} steps 6–11 | A | smoke not passed → no pilot notice |
| 9 | a confirmed failure needs a regression | Advisor → golden question (advisor-golden-set rule 6); else vitest (P1) | A | new `xpory-` question → flow-golden-eval step 3 |
| 10 | the change touches signed-in web UI | {{ref:ui-e2e-emulator}} → row 8 | A | real user's token → never mint or reuse |
| 11 | prepare a live demo | {{ref:demo-prep}} | A | a demo check fails → tell the owner |
| 12 | close the delivered activity | {{skill:lpm-deliver-activity}}, after row 8 | A | smoke not passed |

## 5. Procedures
### P1 Change in a worktree — rows 3, 4, 9
1. In mainPath: `git fetch origin`, then `git worktree add ../lpm-wt-<topic> -b <branch> origin/main`; work only there (wtPath).
2. In wtPath: `ln -s <mainPath>/node_modules node_modules` (none there → `npm ci`). `test -L node_modules` → untracked `.gcloudignore` = the 5 lines of {{ref:lpm-repo-rules#gcloudignore}}.
3. Bug fix → regression test in the same change.
4. Commit message ends with `LPM-Activity: <issueId>` ({{ref:delivery-tracking}}).
5. Before push: `npx vitest run`, `npm run lint`, `npm run check:mcp-parity`; keep each summary line. One fails → fix, no push.
6. Verify: §7 commit row.
### P2 Preflight and candidate deploy — row 4
1. {{ref:flow-deploy-preflight}} steps 1–6; one fails → STOP with its text.
2. In wtPath: `CANDIDATE_ONLY=true bash scripts/deploy-production.sh`; edit nothing there until it exits.
3. Exit ≠ 0 → §6 with the last 30 lines; else keep revision, candidateUrl, promoteCmd.
4. Verify: output has "Candidate ready without traffic (CANDIDATE_ONLY=true).", "MCP smoke passed:" and `Revision:`; missing → its §9 row, else §6.
### P3 Golden-set evaluation — rows 4, 5
1. Default `--only <subsetIds>`; at most one full XporY run per UTC day.
2. {{ref:flow-golden-eval}} steps 1–9 (`evaluate-advisor-golden-set.ts`, never `--with-answers`).
3. Verify: flow step 9 passed; a flow Stop row → no promotion.
### P4 Rollback target, promote, smoke — rows 4, 6
1. Run `<live>` → exactly one line = rollback target; empty or 2+ lines → §6.
2. {{tool:create_comment}}(projectId, issueId, content="Release <revision>: rollback target <rollback target>; golden <summary>", idempotencyKey="rel-<revision>-target") [A] → commentId from "Comment created with ID: <id>".
3. Verify: §7 comment check; fails → no promotion.
4. [C] Show promoteCmd (`update-traffic … --to-revisions=<revision>=100`) and the P3 result; a "deploy"/"promote" order is the yes.
5. Run promoteCmd; then `<live>` → revision.
6. `node scripts/smoke-mcp-protocol.mjs https://lpm.rocks` → keep the output.
7. Verify: step 5 holds; smoke printed "MCP smoke passed:" ("skipped" fails). Failed → row 7.

## 6. Stop and ask
| Situation | Do / ask exactly |
|---|---|
| no issueId / not found | "Which LPM activity is this release for? (id or title)" |
| a check fails, edits in the deploying checkout, upload lists differ | STOP; report the check or diff |
| `<live>` empty or 2+ lines | "Traffic is split (<lines>). Which revision is the rollback target?" |
| rollback target not found (no "Release <live>: rollback target " comment or feed preview) | "No rollback target is recorded for <live>. Which revision served 100 % before that promotion?" Suggest none; never take one from `gcloud run revisions list` or a comment on another revision. |

## 7. Verify
| After | Re-read with | Pass when |
|---|---|---|
| commit / pre-push | `git log origin/main..HEAD --format=%B`; exit codes | trailer in every commit; checks exit 0 |
| golden set | flow-golden-eval step 9 | no id went PASS → FAIL |
| comment | {{tool:list_comments}}(projectId, issueId) or {{tool:list_workspace_activities}}(workspaceId, projectId, limit=20) | `id` or `metadata.commentId` == commentId |
| promotion / rollback | `<live>` | exactly the intended revision |
| smoke | its output | "MCP smoke passed:" |

## 8. Report (copy and fill)
```text
Scope: lpm / <issueId> / revision <revision> (rollback target <rollback target>)
Done: <promoted to 100 % | rolled back | candidate only>; commits <sha subject>
Evidence: tests <summary>; golden <prev → now, reportFile>; smoke <line>; files <fileName (id)>
Pending: <none | failing check or open item — who must act>
Next: <one action>
```

## 9. Failures → fix
{{errors:auto}}
| Error or result contains | Do |
|---|---|
| "MCP smoke skipped" / "Set LPM_API_KEY" | preflight step 5; redeploy (P2) or re-smoke (P4) |
| "MCP smoke test failed on the candidate" | traffic was not moved → fix in P1, redeploy |

## 10. Tools and references
{{tools:index}}
{{refs:index}}
