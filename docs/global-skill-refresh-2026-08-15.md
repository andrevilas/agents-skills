# Global skill refresh evidence — 2026-08-15

## Scope

- Synchronized the external `grill-me` bundle with upstream commit
  `8b78b531ab965735c5dc74f6f7a219e1e37326df`.
- Installed all 15 canonical skills in the global Codex and Antigravity catalogs.
- Refreshed only the five already-adopted project-local skills in `lpm`,
  `ai-software-house`, and `agents-skills`.
- Preserved the user-owned untracked `AGENTS.md` file.
- No application deployment or credential change was performed.

## Distribution

- Global Codex canonical copies: 15.
- Global Antigravity canonical copies: 15.
- Project-local Codex copies: 15 (five skills in each of three projects).
- External global Codex copies: one (`grill-me`).
- Total recursively verified copies: 46.

The catalog verifier was expanded from the earlier 25-copy integrity subset to
the full distribution above. External synchronization and installation now copy
and compare the complete bundle recursively, including `agents/openai.yaml`.

## Validation

- Catalog structural validation: 15/15 passed.
- Governed behavioral scenarios: 12/12 passed.
- Shell syntax validation: passed.
- External sync smoke against a fresh upstream clone: passed.
- Recursive installed-distribution verification: 46/46 passed.
- Git whitespace validation: passed.

## Traceability

- LPM issue: `7rBWZCVieqfbDWGeVMAV`.
- AISH job: `aish-7fea4afa49223cb8fb7196755b5f7261e8eac0dc`.
- AISH runner evidence: `JcOPRb9GXXk48vsu2X4Q`.
- Implementation commit: `5c930ab` (`fix(skills): refresh global distribution`).
- Repository: `andrevilas/agents-skills`, branch `main`.

The failed direct `aish` wrapper attempt created no job. The successful job was
created through the isolated `lpm-codex` profile and reconciled its linked issue
after the deterministic runner completed.
