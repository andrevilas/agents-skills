# Flow: onboard a runner host
Load when: decision row 2 of SKILL.md

## Preconditions
1. Load {{ref:host-onboarding}} (commands, scopes, doctor findings).
2. Ask: anchor projectId, scope (`project`/`workspace`/`account`), accountId (account scope), repos, executor command.
3. The enrollment token and the host profile are secrets: they go to the host terminal only, never to chat, comments, evidence or your own tool output.
4. Default: the host is logged in to the `lpm` CLI. `lpm aish host wizard` without `--token` creates its own 60-minute token and never prints it. You never run `lpm aish hosts create-token` yourself.

## Steps
1. Host: `lpm aish host wizard --project <anchorProjectId> [--scope …] [--account <accountId>] --dry-run --json` → `ok == true`; else fix `findings`. The host has no LPM login → Stop and ask row 2.
2. [C] The same command without `--dry-run` → keep `hostId`, `profilePath`.
3. `lpm aish host doctor --profile <profilePath> --json` → `ok == true`; else fix every finding.
4. `lpm aish host sync-repos --profile <profilePath> --dry-run --json` → expected repos `planned`; then without `--dry-run`.
5. `lpm aish host monitor --project <projectId> --host <hostId> --json` → keep `host.connection`.
6. [C] `lpm aish host start --profile <profilePath> --executor-command <cmd> --budget-contract aish-budget/1 --targeted-only --json`.
7. Verify: step 5 again → `host.connection` `online`/`busy`.

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| the host has no LPM login | "On the host terminal (not here), run `lpm aish hosts create-token --project <anchorProjectId> --expires-minutes 60 --json` and then `lpm aish host wizard --token <token> --project <anchorProjectId> --dry-run --json`. Never paste the token to me." |
| a token or profile value would enter chat or your tool output | do not send it; redact ({{ref:security-and-untrusted-text}}) |
| account scope, workspace not bound | "The account owner must run `lpm aish accounts bind-workspace --account <accountId> --workspace <workspaceId>`." |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| host start (step 6) | `lpm aish host monitor --json` | `host.connection` `online`/`busy` |

## Report fields
- anchor projectId, scope, hostId, profilePath (path only, never its content)
- doctor result, synced repos, `host.connection`
- pending: workspace binding, grants — the account owner
