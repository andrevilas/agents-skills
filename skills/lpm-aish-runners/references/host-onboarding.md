# Host onboarding and fleet CLI
Load when: before a host, hosts, accounts or fleet CLI command
Applies to: lpm-aish-runners    Source: lpm `src/cli/lpm.ts` (`handleAishHostWizard`, `handleAishHostBootstrap`, `handleAishHostDoctor`, `handleAishHostSyncRepos`, `handleAishHostMonitor`, `handleAishHostsRemoteAccess`), `src/lib/aishHostWizard.ts`, `src/lib/aishHostBootstrap.ts`; cards `get_aish_runner_management_overview`, `preview_aish_runner_management_action`, `apply_aish_runner_management_action`; legacy digest `aish-governed-development-operator` §1.3

## Summary
Onboarding order: `aish host wizard` (on the host; it creates its own 60-minute token) → `aish host doctor` → `aish host sync-repos --dry-run` → `aish host monitor` → `aish host start --targeted-only --budget-contract aish-budget/1`. `aish hosts create-token --expires-minutes 60` only for a host without LPM login, run by the human on that host.
Enrollment tokens and host credentials are secrets: they go to the host terminal only, never to chat, comments or evidence.
Enrolling a host never approves work: jobs still need their execution gate (lpm-aish-jobs) and funding (owner).
Account-level changes (bind a workspace, grants, rotate a credential) are the runner account owner's.
Revoke stale hosts; never run work on a host that is not onboarded, monitored and scoped to the project.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `lpm aish hosts create-token --project <anchorProjectId> [--scope project\|workspace\|account] [--account <accountId>] --expires-minutes 60 --json` | short-lived enrollment token for one host | the output holds the token: the human runs it on the host terminal, never the agent; never paste it into chat |
| `--scope` | `project` (default), `workspace` (needs workspace ids), `account` (needs `--account`) | ask the user which scope; account scope needs a bound workspace |
| `lpm aish host wizard [--token <t>] --project <anchorProjectId> [--scope …] [--account <id>] [--dry-run] --json` | preflight, enroll, profile and slots in one command | without `--token` it creates its own 60-minute token; `--dry-run` changes nothing |
| wizard result | `ok`, `hostId`, `profilePath`, `managedDir`, `slotCount`, `capabilities`, `findings` | keep `hostId` and `profilePath` |
| default profile path | `~/.lpm/aish-hosts/<displayName>.json` | the profile holds the host credential: never print or upload it |
| `aish host enroll-wizard` | same handler as `aish host wizard` | use `aish host wizard` |
| `lpm aish host bootstrap --token <t> [--repo <git-url[#branch]; …>] [--capabilities <a; b>]` | older manual enrollment (default capabilities `local-command`, `codex-cli`, `agy-cli`) | use when the wizard is unavailable; store only the generated profile on the host |
| `lpm aish host doctor --profile <path> --json` | local checks → `ok`, `readiness`, `findings` | `ok == false` → fix every finding before start |
| doctor findings | `profile-permissions-too-open`, `managed-dir-missing`, `managed-dir-not-writable`, `git-not-found`, `codex-cli-not-found`, `codex-cli-not-authenticated`, `agy-cli-not-found`, `agy-cli-not-authenticated`, `node-version-unsupported` | permissions: `chmod 600 <profile>`; the rest: install or log in the named tool |
| `lpm aish host sync-repos --profile <path> --dry-run --json` | lists each declared repo with `status: planned` | a missing repo → re-enroll with the right `--repo`; then run without `--dry-run` (`status: ok`) |
| `lpm aish host monitor --project <id> [--host <hostId>] --json` (same output: `lpm aish host status`) | `host.connection`: `online`, `busy`, `stale`, `offline`, `draining`, `revoked`, `unknown`; `jobs.ready`, `running`, `pendingApproval`, `failed` | stale after 90 s without heartbeat, offline after 5 min |
| `lpm aish host start --profile <path> --executor-command <cmd> --budget-contract aish-budget/1 [--targeted-only] [--once] --json` | fenced host worker (heartbeats, leases, traces, evidence) | `--targeted-only` takes only jobs whose `targetHostId` is this host; use it for dedicated hosts |
| host start options | `--provider-adapter vertex-bounded`, `--orphan-watchdog-interval-ms`, `--poll-interval-ms`, `--heartbeat-interval-ms`, `--timeout-ms` | leave defaults unless the operator names them |
| `lpm aish host heartbeat`, `aish host update-inventory`, `aish host remote-access --action preflight\|status\|apply\|disable` | host-side maintenance commands | run on the host; `apply` needs `--confirm` |
| `lpm aish hosts list --project <id>` / `aish hosts usage --account <id> [--include-removed]` | project hosts / account fleet usage | MCP equivalent of usage: {{tool:get_aish_runner_management_overview}} |
| `lpm aish hosts rename --account <id> --host <id> --display-name <name> --dry-run` / `lpm aish hosts remote-access --account <id> --host <id> --remote-access <disabled\|tailscale-ssh> --dry-run` | account host metadata changes | exactly one of `--dry-run` / `--confirm --reason <text> --idempotency-key <key>`; dry-run first |
| `lpm aish hosts revoke --project <id> --host <id>` | revokes a project (legacy) host | use for stale hosts the user named and for removing a legacy host (preview/apply lifecycle actions reject legacy hosts) |
| `lpm aish hosts enroll --token <t>` | enroll without writing a profile | prefer the wizard |
| `lpm aish accounts list --json` / `lpm aish accounts create` | runner accounts (only the CLI lists them) | source of `accountId` |
| `lpm aish accounts bind-workspace --account <id> --workspace <id>` | lets account hosts run work of that workspace | account owner's decision: ask, never run it on your own |
| `lpm aish accounts grants create --account <id> --host <id>` / `lpm aish accounts grants revoke --account <id> --grant <grantId>` | which workspaces/projects a host may serve | [C]; least privilege: name explicit ids |
| `lpm aish fleet topology --account <id> --json` | pools, hosts, agents, slots with status | read-only check after any fleet command |
| `lpm aish fleet create --kind pool\|agent\|slot --idempotency-key <k>` / `lpm aish fleet transition --kind … --status … --reason <t> --idempotency-key <k>` | fleet structure and status | for host status prefer {{tool:preview_aish_runner_management_action}} → {{tool:apply_aish_runner_management_action}} |
| `lpm aish fleet rotate-credential --account <id> --host <id> --expected-generation <n> --reason <t> --show-secret-once` | new host credential, shown once | the account owner runs it in their own terminal |

## Rules
1. Run `--dry-run` (wizard, sync-repos, rename, remote-access) before the real command and show its result.
2. Never echo, log, comment or upload an enrollment token, a host credential or a profile file.
3. Do not assume local credentials, git remotes, VPN or browser sign-ins exist on a remote host; doctor proves them.
4. Do not reuse a host workdir for unrelated work without a repo sync or cleanup.
5. Managed runners and Cloud Run Jobs stay gated; never enable them from this skill.
6. At the end of a cycle, a host is healthy and working, explicitly left as a queue worker, or stopped.

## Examples
```text
example: lpm aish host wizard --project <anchorProjectId> --dry-run --json
example: lpm aish host start --profile ~/.lpm/aish-hosts/<name>.json --executor-command ./run-job.sh --budget-contract aish-budget/1 --targeted-only --json
```
