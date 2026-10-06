# AISH CLI for jobs and cockpit sessions
Load when: using the CLI
Applies to: lpm-aish-jobs    Source: `catalog/lpm-cli.snapshot.json` (lpm `src/cli/lpm.ts` `commands` Map); cards `cli` fields; digest `legacy-aish-governed-development-operator.md` §2.2

## Summary
The binary is `lpm` (`lpm aish ...`); the same subcommands also run as `aish ...`. Never use `lpm-codex`: it is one machine's wrapper.
Every CLI call is the MCP tool of the same row, with the same authority tag. Add `--json` and read the result as data.
`lpm aish autopilot materialize --approve` commits the materialization only; it never approves execution.
Commands that execute or transcribe need `--budget-contract aish-budget/1`.

## Facts
### Jobs
| CLI | MCP tool | Auth |
|---|---|---|
| `lpm aish jobs create --project <projectId> --title <title> --prompt <text> [--intent <analysis\|implementation\|test\|documentation\|review>] [--issue <issueId>] [--repository <path>] [--execution-recipe <id>] [--required-capabilities <a; b>] [--idempotency-key <key>] [--json]` | {{tool:create_aish_job}} | [C] |
| `lpm aish jobs list --project <projectId> [--json]` | {{tool:list_aish_jobs}} | [A] |
| `lpm aish jobs get --job <jobId> [--json]` | {{tool:get_aish_job}} | [A] |
| `lpm aish autopilot approve --job <jobId> [--reason <text>] [--target-host <hostId>] [--json]` | {{tool:approve_aish_job_execution}} (reads the manifest hash itself) | [O] |

### Autopilot (objective → activities + queued jobs)
| CLI | Effect | Auth |
|---|---|---|
| `lpm aish autopilot plan --project <projectId> --objective <text> [--requirements <a; b>] [--constraints <a; b>] [--repository <path>] [--json]` | plan preview; materializes nothing | [A] |
| `lpm aish autopilot materialize ... --create-jobs --idempotency-key <key> --dry-run --json` | preview of the materialization | [A] |
| `lpm aish autopilot materialize ... --create-jobs --idempotency-key <key> --approve --json` | creates activities and queued jobs with `runnerMayExecute=false` | [C] |

### Cockpit
| CLI | MCP tool | Auth |
|---|---|---|
| `lpm aish cockpit create --workspace <workspaceId> --scope <project\|workspace> --projects "<id; id>" --objective <text> --idempotency-key <key> --json` | {{tool:create_aish_execution_session}} | [C] |
| `lpm aish cockpit get --session <sessionId> [--after-sequence <n>] --json` | {{tool:get_aish_execution_session}} | [A] |
| `lpm aish cockpit coordinator --session <sessionId> --coordinator <id> --idempotency-key <key> --json` | {{tool:acquire_aish_coordinator_lease}} | [A] |
| `lpm aish cockpit plan --session <id> --coordinator <id> --lease-nonce <nonce> --fencing-token <n> --plan-file <path> --command-id <id> --json` | {{tool:put_aish_execution_plan}} | [C] |
| `lpm aish cockpit command --session <id> --command-id <id> --type <type> [--project <id>] [--payload-json <json>] [--next-status <status>] --json` | {{tool:append_aish_execution_session_command}} (never sends the fence) | [C] |
| `lpm aish cockpit readiness --session <sessionId> --json` | {{tool:get_aish_execution_readiness}} | [A] |
| `lpm aish cockpit approve --session <id> --coordinator <id> --lease-nonce <nonce> --fencing-token <n> --plan-hash <sha256> --command-id <id> --json` | {{tool:approve_aish_execution_plan}} | [O] |
| `lpm aish cockpit dispatch --session <id> --coordinator <id> --lease-nonce <nonce> --fencing-token <n> --plan-hash <sha256> --json` | {{tool:dispatch_aish_execution_plan}} | [C] |
| `lpm aish cockpit pause` / `resume` `--session <id> --coordinator <id> --lease-nonce <nonce> --fencing-token <n> --command-id <id> --json` | {{tool:pause_aish_execution_session}} / {{tool:resume_aish_execution_session}} | [C] |
| `lpm aish cockpit retry --session <id> --coordinator <id> --lease-nonce <nonce> --fencing-token <n> --plan-hash <sha256> --command-id <id> --json` | {{tool:retry_aish_execution_plan}} | [C] |

### Intake and the generic bridge
| CLI | MCP tool | Auth |
|---|---|---|
| `lpm aish intake transcribe --project <id> --job <id> --attempt <id> --attachment <id> --budget-contract aish-budget/1 --json` | claim, Whisper, consumption receipt, then {{tool:record_aish_intake_transcript}} (`source.kind == "execution"`) | [C] |
| `lpm aish command <tool> --file <payload.json> [--transport rest\|mcp] --json` | any tool without its own subcommand (sessions list, checkpoints, intake, Copilot) | the tool's tag |

## Rules
1. Use a stable `--idempotency-key` per governed objective; a retry with the same key reuses the run, activities and jobs.
2. Rerun a materialization only with the same key, or with a new key for a deliberately new scope.
3. Run `--dry-run` (or `autopilot plan`) and show the result before `--approve`.
4. The cockpit has no list subcommand: use `lpm aish command list_aish_execution_sessions --file <payload.json> --transport mcp --json`.
5. Keep the `--lease-nonce` value out of logs, comments and shell history you share.
6. Runner start, host commands and job closure are not here: {{skill:lpm-aish-runners}} and {{skill:lpm-aish-delivery}}.

## Examples
```text
example: materialize after the owner's "yes"
lpm aish autopilot materialize --project <projectId> --objective "Fix checkout totals" \
  --create-jobs --idempotency-key auto-<projectId>-checkout-totals --approve --json
-> reused: false; jobs[].executionGate.runnerMayExecute: false (approval still needed)
```
