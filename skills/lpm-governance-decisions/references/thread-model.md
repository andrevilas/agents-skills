# Governance thread model
Load when: before creating or resolving a thread
Applies to: lpm-governance-decisions    Source: cards of the thread, inbox and draft tools; server.ts governance thread commands; help `glossario`, `papeis-governanca-e-responsabilidades`

## Summary
- A thread is a decision discussion on one requirement, baseline, roadmap item or roadmap change request of a project. Threads cannot target activities.
- Status runs open → answered / decision-needed → resolved / closed. Replies never change the status.
- A decision is a structured `decisionOutcome` (type + summary). The agent records what an authorized human stated and never originates a decision.
- Server policy is always `requiresHumanReview: true`, `allowDirectExecution: false`: drafts are previews; the artifact is created explicitly, then linked back with `actionTargetType` + `actionTargetId`.
- Governance or execution: a debate that changes the meaning, approval or official form of the scope is governance; one about how approved work is done is execution (activity comments).

## Facts
| Field / value | Meaning | Consequence for the agent |
|---|---|---|
| `status: open` | new thread (start state), discussion running | reply; set `decision-needed` when the question is ready |
| `status: answered` | someone answered; no decision yet | the decider still has to decide |
| `status: decision-needed` | waiting for the decider | `assignedTo` = the decider's userId (free text, not validated: never a name) |
| `status: resolved` | decision recorded; `resolvedAt`, `resolvedBy` stamped | drafts allowed when the outcome is actionable |
| `status: closed` | finished, nothing more to do | treated like resolved for drafts |
| `targetType: requirement` / `baseline` | project scope | ids come from lpm-requirements-scope |
| `targetType: roadmap-item` / `roadmap-change-request` | workspace roadmap; the project must belong to a workspace | ids come from lpm-roadmap; no workspace → "Project workspace is required for roadmap governance threads" |
| an activity as target | rejected: "Unsupported governance thread target" | comment on the activity with {{tool:create_comment}} |
| `outcomeType: clarification` | the question is answered; nothing to create | resolve or close |
| `outcomeType: create-activity` | an activity must be created (mutation class operational) | {{tool:prepare_issue_draft_from_governance_thread}} → {{tool:create_issue}} |
| `outcomeType: derive-requirement` | a requirement must be added (mutation class scope) | {{tool:prepare_requirement_draft_from_governance_thread}} → {{tool:create_requirement}} [C] |
| `outcomeType: propose-change-set` | a change set must be proposed (mutation class material) | {{tool:prepare_change_set_draft_from_governance_thread}} → {{tool:create_change_set}} |
| `outcomeType: publication-note` | a note for the next baseline publication | nothing to create |
| `outcomeType: no-action` | decided not to act | status `closed` |
| `actionTargetType` | `issue`, `requirement`, `change-set`, `baseline`, `roadmap-item`, `roadmap-change-request`; any of them with any outcome type | set with `actionTargetId` only after the artifact exists (not validated); a roadmap decision links its CR or item this way |
| actionable outcome on an unresolved thread | rejected: "Governance thread must be resolved before a decision can materialize into an action draft" | record the decision first |
| `decisionOutcome` on resolve | replaced on every call | to link back, resend `type`, `summary`, `actionTitle` of `decision.outcome` and `thread.status` from the LATEST re-read |
| `policy.automationPolicy.reasonCodes` | actionable outcomes only: `awaiting-reviewed-artifact-creation` → `artifact-created-from-reviewed-draft` once `actionTargetId` is set | proof that the link-back worked |
| inbox `requiresAction` | true for almost every unresolved thread without an outcome; false once resolved/closed or with any `decisionOutcome` | decided threads with a pending artifact never show: sweep {{tool:list_governance_threads}}; context `decision.requiresAction` is true only for `decision-needed` |
| `readyToCreate` | issue, change-set draft: thread resolved/closed; requirement draft: a baseline exists, even on an open thread | never a decision check; read `decision.outcome.type` |
| `policy.directCreationAllowed` | always false | drafts write nothing |
| draft texts | Portuguese; quote the last loaded message | pass `messageLimitCount=100` on long threads |
| change-set draft delta | the WHOLE working scope vs the source baseline, not only this decision | say so to the decider |
| read permission | project owner, any project governance role, workspace or team member | {{tool:list_governance_threads}} works for all of them |
| project inbox permission | project governance role: project-owner (incl. the project `ownerId`), product-owner, delivery-lead; workspace admin alone is not enough | denied → {{tool:list_governance_threads}} or {{tool:get_workspace_decision_inbox}} |
| write permission (create, reply, update, resolve) | project owner, product-owner, delivery-lead, workspace or team manager, platform admin | else "You do not have permission …": do not retry |
| the decider | project owner, product owner or delivery lead | an activity assignee is not governance authority |
| `blockedAishJobIds` | API key only, max 50, queued jobs of this project; held at gate governance-decision | add only when the user asked to hold those jobs |
| reopen (`status=open`, `decisionOutcome=null`) | erases the decision; re-holds listed jobs (approval lost); a job no longer queued fails the call | [O]; warn about the jobs first |
| resolve or close with held jobs | the jobs move to execution approval; they still need approval in lpm-aish-jobs | fails while a held job is running: wait, never loop |
| idempotency | create and reply: none; update and resolve: same arguments = no write | re-read before any retry |
| inbox limits | 100 most recent threads, no cursor | sweep with {{tool:list_governance_threads}} (cursor) |
| messages in the context | the OLDEST `messageLimitCount` messages, no `nextCursor` | `thread.messageCount > 100` → page {{tool:get_governance_thread_messages}}, cursor = last message `id` (an unknown cursor restarts at the first) |
| OAuth connector | {{tool:get_project_decision_inbox}}, {{tool:list_governance_threads}} (portfolio:read); {{tool:create_governance_thread}}, {{tool:reply_governance_thread}} (opt-in portfolio:manage) | resolve, update, drafts and messages need an API key |

## Rules
1. Read the resolution context before any reply, update, resolve or draft.
2. Never target an activity; comment on it instead.
3. Never resolve or close without an explicit outcome; use {{tool:resolve_governance_thread_with_outcome}}, never a bare status change.
4. Record only a decision the decider stated, on the decider's own order in this conversation; quote it in the report.
5. Derive an artifact only from a resolved or closed thread with an actionable outcome; ask when the thread is ambiguous.
6. Create each artifact once, then link it back in the same run.
7. When the decision enables, expands or cuts AI spend, require the 7 AI fields before resolving.
8. Keep governance and execution history apart: decisions in the thread, work notes in activity comments.

## Examples
```text
example: decision request (create_governance_thread content)
Context: requirement <key> asks for CSV export; the client now asks for PDF too.
Options: A) add PDF to this requirement; B) new requirement in the next baseline.
Recommendation: B, because A changes the approved scope of the current baseline.
Consequences: A = scope change, the next publication needs a reviewed change set; B = no change now.
Decision requested from: <product owner name>.

example: link-back after create_issue returned "Issue created with ID: <issueId>"
resolve_governance_thread_with_outcome(projectId, threadId, outcomeType="create-activity",
  summary=<same>, actionTitle=<same>, status="resolved",
  actionTargetType="issue", actionTargetId=<issueId>)
```
