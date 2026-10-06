# Flow: cancel or delete an activity
Load when: decision rows 7–8 of SKILL.md (cancel or delete an activity)

## Preconditions
1. Cancel ({{tool:update_issue}} status `canceled`) works on connectors and keeps history. Delete ({{tool:delete_issue}}) is a hard delete with no undo: API key with profile full or custom.
2. The server lets anyone who can read the project delete an issue, including factory-governed (AISH) issues: this flow enforces the checks itself.
3. Cancel is [A] only when the user named this activity. Delete is always [C].

## Steps
1. {{tool:get_issue}}(projectId, issueId) → keep `title`, `status`, `requirementId`, `baselineId`, `factoryGovernance`.
2. `status` is `done` → SKILL.md §6 (closure belongs to {{skill:lpm-deliver-activity}}). `requirementId` set → ask "<title> delivers requirement <requirementId>. Does that requirement stay in scope? (yes/no)"; "no" → SKILL.md §6 scope doubt.
3. Cancel (row 7): the user did not name this activity (you picked it) → ask "Cancel <title> (<id>)? (yes/no)" and wait.
4. Cancel: {{tool:update_issue}}(projectId, issueId, status="canceled") [A]. Then step 9.
5. Delete (row 8): {{tool:list_comments}}(projectId, issueId) → keep commit-link comments (`LPM-Activity` webhook).
6. `factoryGovernance` present, a commit-link comment exists, or `requirementId` / `baselineId` set → never delete: offer cancel ("Cancel <title> instead? (yes/no)") and continue at step 4 only on "yes".
7. SKILL.md §6 delete question with the title and id; continue only on "yes".
8. {{tool:delete_issue}}(projectId, issueId) [C].
9. Verify: {{tool:get_issue}}(projectId, issueId) → `status` == "canceled"; deleted → "Issue not found".

## Stop and ask
| Situation | Do / ask exactly |
|---|---|
| bound to a requirement | "<title> delivers requirement <requirementId>. Does that requirement stay in scope? (yes/no)" |
| delete blocked by step 6 | "Cancel <title> instead? (yes/no)" |
| the user did not name the activity | "Cancel <title> (<id>)? (yes/no)" |

## Verify
| After | Re-read with | Pass when |
|---|---|---|
| cancel | {{tool:get_issue}}(projectId, issueId) | `status` == "canceled" |
| delete | {{tool:get_issue}}(projectId, issueId) | "Issue not found" |

## Report fields
Scope (project), activity id and title, canceled or deleted, the check that blocked a delete, Pending, Next.
