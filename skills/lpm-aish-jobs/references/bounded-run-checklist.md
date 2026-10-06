# Bounded-run checklist
Load when: proposing a plan
Applies to: lpm-aish-jobs    Source: card `put_aish_execution_plan` (plan.authorization, node.financial), `dispatch_aish_execution_plan`, `retry_aish_execution_plan`; lpm `docs/aish-continuity-center-adr-2026-08-25.md` §4; digest `legacy-aish-governed-development-operator.md` §1.5

## Summary
A cockpit plan runs many jobs under ONE owner approval, so every limit must come from the owner before the plan is shown.
Any limit missing → do not build a session: create and approve job by job.
A deploy is never covered by a bounded-run authorization: deploy-gated nodes still wait for a release package the owner approves.
Never invent caps, hosts, recipes, `deployAllowed` or financial amounts.

## Facts
### `plan.authorization` (all from the owner)
| Field | Range | Meaning | If the owner did not give it |
|---|---|---|---|
| `maxJobs` | 1–100, ≥ node count | jobs the plan may create, retries included | ask; no default |
| `maxConcurrency` | 1–20 | jobs per dispatch wave | ask |
| `timeoutMinutes` | 5–1440 | window from the session's `createdAt`, including the wait for owner approval; then jobs stop being leasable | ask; tell the owner the deadline (`createdAt` + `timeoutMinutes`) |
| `stopOnFailure` | true / false | a failed node blocks further dispatch (retry still works) | ask |
| `deployAllowed` | true / false | required for any deploy, release or production node | false; deploy stays out of the plan |
| `allowEligiblePool` | true / false | any eligible host may run nodes without `targetHostId` | ask, or pin hosts per node |
| `allowedHostIds[]` | host ids | hosts the plan may use | ask; ids come from {{skill:lpm-aish-runners}} |
| `allowedRecipeIds[]` | recipe ids | recipes the plan may use | ask |

### Node fields
| Field | Rule | Source |
|---|---|---|
| `id`, `title`, `intent` | unique node id; short title | you, from the objective |
| `projectId` | in the session scope | session `scope.projectIds` |
| `issueId` | REQUIRED: an open activity of node `projectId`, used by < 20 sessions; without it dispatch reserves the cap, then fails ("Repository jobs require workspace and issue lineage") | {{tool:list_issues}}; none → create or select the activity first ({{skill:lpm-plan-work}} / ask) |
| `recipeId` | one of the 7 recipes; stages `local-deploy`, `staging`, `production` only with `deploy-gated` | user / {{ref:aish-operating-model}} |
| `revision` | REQUIRED: equals the repository link's `lastKnownCommit`, copied exactly | {{tool:list_project_repository_links}} |
| `dependsOn` | node ids, ≤50, no cycles | you |
| `targetHostId` | required unless `allowEligiblePool == true` | the owner |
| `financial` | exactly {currency (3 capital letters), maxAmount (decimal string > 0), requireIssueBudget} | the owner; a node without it is not dispatched |
| `prompt` | ≤16 KB, no secrets | user |
| `intakeBinding` | {contextId, fingerprint} | {{tool:create_aish_intake_context}} |

### Also agree before the plan
| Item | Why |
|---|---|
| objective and project scope | becomes the session objective (≤4000 chars) |
| stop condition | when to stop besides `maxJobs` / `timeoutMinutes` |
| required validation and smoke evidence | what proves each node; recorded in {{skill:lpm-aish-delivery}} |
| recoverable LPM attachments | screenshots, logs and reports attached to the activity, not only AISH ids |
| AI posture | max model-heavy planning/review passes; deterministic checks first ({{ref:ai-cost-and-budgets}}) |
| budget capacity | project (and issue) budgets must cover every cap; owner decision ({{skill:lpm-ai-cost}}) |

## Rules
1. Show the filled checklist with the plan; one owner "yes" approves only what was shown.
2. Missing limit → fall back to job-by-job: SKILL.md P1 and P2 per job.
3. Stop when validation fails, a governance decision is required, a secret would be exposed, a host is unhealthy or a release boundary is reached.
4. Each retry creates new jobs and new reservations that count against `maxJobs` and the budget.
5. Approving the plan reserves each node's cap at dispatch; never present it as free.

## Examples
```text
example: plan shown to the owner
{"version": 1,
 "nodes": [{"id": "n1", "projectId": "<projectId>", "issueId": "<issueId>", "title": "Analyze checkout bug",
            "intent": "analysis", "recipeId": "analysis-readonly", "revision": "<lastKnownCommit>",
            "dependsOn": [], "targetHostId": "<hostId>",
            "financial": {"currency": "BRL", "maxAmount": "5.00", "requireIssueBudget": false}}],
 "authorization": {"maxJobs": 2, "maxConcurrency": 1, "timeoutMinutes": 120, "stopOnFailure": true,
                   "deployAllowed": false, "allowEligiblePool": false,
                   "allowedHostIds": ["<hostId>"], "allowedRecipeIds": ["analysis-readonly"]}}
```
