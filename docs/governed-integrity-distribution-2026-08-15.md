# Governed integrity skills distribution — 2026-08-15

## Scope

This record covers the governed integrity hardening distributed after the LPM,
AISH, and Agents Skills sanitation review. It contains no credentials or runtime
payloads.

| Skill | Version | Codex `SKILL.md` SHA-256 |
| --- | --- | --- |
| `governed-project-integrity-review` | `1.0.0` | `df0c3185e0ce0aaedb2434469fb75ee86b94a85fcad3cfc0cfd48c8b18e23869` |
| `aish-governed-development-operator` | `1.1.1` | `689e8e19ea5c2e77f1d9db397726bd423e2af17e4f0aa76cd91c8f79998d1f87` |
| `portfolio-health-review` | `1.1.0` | `95ee1d94782499f3cfc4daa99a576e056640012ac9ca2c8628a0551f7993df4b` |
| `software-project-orchestrator` | `1.2.0` | `35980cec16388ccafd2e0ac8d43fe3ff4e3b92360d6ea89be9404dbf44771549` |
| `lpm-workspace-admin` | `1.1.0` | `406cfa4f0c49a254eff351e07632d5fc320f20cc1cb0cc68aee25a3d7d6af55e` |

## Installed destinations

- Codex global: `~/.codex/skills`.
- Antigravity global: `~/.antigravity/skills`.
- Codex project-local: `lpm/.codex/skills`,
  `ai-software-house/.codex/skills`, and `agents-skills/.codex/skills`.

Only the five named skill directories were replaced. The installer verified
each copy with a recursive byte-level comparison. Project-local distributions
are ignored by Git and remain machine-local; Antigravity uses its supported
global catalog rather than a project-local mirror.

## Validation

- Catalog structural validation passed.
- Codex quick validation passed for all five skills.
- Behavioral contract validation passed for terminal-state convergence,
  idempotent materialization, stale-cycle detection, scope drift, AISH
  reconciliation, runtime dependency preflight, bounded validation resource
  closure, composite health, orchestrated closure, and post-unarchive preflight.
- Installer smoke validation passed in an isolated temporary destination.
- Post-install recursive comparisons passed for every destination listed above.

The repository remains the authoritative source. Local copies are deployment
artifacts and must be refreshed through `scripts/install-skill.sh` after future
version changes.
