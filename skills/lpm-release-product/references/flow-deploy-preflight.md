# Flow: preflight before a candidate deploy
Load when: SKILL.md P2 step 1

## Preconditions
1. mainPath, wtPath: SKILL.md §3. Run every step in wtPath unless the step names mainPath.
2. Nothing else edits wtPath until the deploy exits (the deploy uploads the working dir with `--source .`).

## Steps
1. `git -C ../agents-skills pull` (deploy parity reads its `main`). Fails → Stop table.
2. `git fetch origin && git merge-base --is-ancestor origin/main HEAD`; exit ≠ 0 → the branch is behind origin/main → Stop table.
3. `git status --porcelain` → only `?? .gcloudignore`, plus `?? node_modules` when `test -L node_modules`; any other line → STOP and report it.
4. `gcloud meta list-files-for-upload . | sort` in wtPath and in mainPath → diff; a line not in `git diff --name-only --diff-filter=AD $(git -C <mainPath> rev-parse HEAD) HEAD` → STOP and report the diff. `node_modules/` or `.git/` listed → fix `.gcloudignore` (SKILL.md P1 step 2), repeat this step.
5. `test -n "$LPM_API_KEY"` (no echo, never print the key); fails → Stop table.
6. Verify: steps 1–5 passed; keep one pass line per step for the release report ("Upload check").

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| step 1 fails, or local `main` ≠ `origin/main` | "agents-skills main is out of sync with origin/main; deploy stopped." |
| step 2 fails | "The branch lacks origin/main; rebase it first. Deploy stopped." |
| step 5 fails | "Set LPM_API_KEY (reads the demo, LPM and XporY workspaces) in this shell; I will not create a key." |

## Verify
Step 6.

## Report fields
One line per step: pass, or the failing output.
