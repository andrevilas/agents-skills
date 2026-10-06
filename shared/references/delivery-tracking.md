# Delivery tracking (LPM-Activity trailer)
Load when: you commit code that delivers an LPM activity
Applies to: lpm-deliver-activity, lpm-aish-jobs, lpm-aish-runners, lpm-release-product    Source: help `lpm-activity-commit-linking`; lpm `src/lib/commitActivityLinker.ts`, `.githooks/prepare-commit-msg`, `.gitignore`, `CONTRIBUTING.md`
Owner skill: lpm-deliver-activity

## Summary
- A commit that delivers an LPM activity ends with one line per activity: `LPM-Activity: <issueId>`, after a blank line, next to other trailers.
- The issueId is the Firestore id of the activity (8–100 characters `[A-Za-z0-9_-]`). Unknown → ask, or omit the trailer. Never guess.
- On push, the LPM GitHub webhook comments on the activity (commit link, author, files, estimated duration). It never blocks a push.
- A linked commit is evidence of work, not closure: acceptance criteria, tests and evidence still decide `done`.
- Work outside AISH runners (Claude Code, Codex, Gemini, Cursor, editors) is tracked only this way.

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `LPM-Activity: <issueId>` | case-sensitive line at the start of a line | exact spelling; one line per activity; several activities allowed |
| issueId format | `^[A-Za-z0-9_-]{8,100}$` | take it from `list_issues` → `id`, the activity URL, the user or `.lpm-activity` |
| other trailers | `Co-Authored-By`, `Claude-Session`, … | keep them in the same trailer block |
| push webhook | fire-and-forget; unknown ids are ignored | never use the webhook comment as proof the id was right: check the activity |
| webhook comment | SHA with link, subject line, author and date, files changed, estimated duration (first → last commit) | do not duplicate it in your progress comment; link to it |
| `.githooks/prepare-commit-msg` | appends the trailer from `.lpm-activity` to new commits (not merges, amends or squashes) | enable with `git config core.hooksPath .githooks` |
| `.lpm-activity` | one line with the issueId, gitignored in the lpm repo | update it when you switch activity; never commit it |
| AI cost of non-AISH work | comes from the provider bill | LPM records it; it does not compute it |
| an AISH job | tracked by AISH evidence, not by this trailer alone | AISH work → `lpm-aish-jobs` / `lpm-aish-delivery` |

## Rules
1. Message shape: subject, blank line, body, blank line, `LPM-Activity: <issueId>`, other trailers.
2. Before committing, confirm the issueId with `get_issue`; not found → ask, do not commit with it.
3. Verify after the commit: `git log -1 --format=%B` contains the exact trailer line.
4. One commit may reference several activities, one line each; never join ids on one line.
5. The hook only suggests; you still check the id it wrote.
6. Never close an activity because a commit references it; run the closure check (`evidence-and-closure.md`).

## Examples
```text
example:
fix(advisor): corrigir grau de certeza

The guard now detects categorical wording for an inference.

LPM-Activity: uRubTAhmX6veNW7NVTRP
Co-Authored-By: <agent> <noreply@example.com>
```
```text
example: hook setup in a repository that ships .githooks
git config core.hooksPath .githooks
echo "uRubTAhmX6veNW7NVTRP" > .lpm-activity
```
