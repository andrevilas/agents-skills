# Enums (fixed values)
Load when: you send or read a status, type, priority, role or other fixed value
Applies to: lpm-deliver-activity, lpm-plan-work, lpm-unblock-work, lpm-roadmap, lpm-requirements-scope, lpm-aish-jobs, lpm-aish-delivery    Source: cards `inputs[].notes` and `returns` (catalog/cards); lpm `src/server/oauthToolPolicy.ts` (OAuth enums, lifecycle transitions), `server.ts` (`codeEvidence.status`)
Owner skill: catalog

## Summary
- Copy values exactly: with an API key many tools store an unknown value as is (no validation), so a typo corrupts data.
- Activities have no `blocked` status: blockers are links or a blocker context.
- `is-blocked-by` is stored reversed as `blocks`; activity links and roadmap/portfolio links use different vocabularies.
- Roadmap lifecycle moves only along the transitions below; `closed` is final.

## Facts
| Field | Values | Notes |
|---|---|---|
| issue `status` | `backlog`, `todo`, `in-progress`, `done`, `canceled` | no `blocked`; prefer `canceled` over delete |
| issue / roadmap item `priority` | `none`, `low`, `medium`, `high`, `urgent` | |
| cycle `status` | `upcoming`, `active`, `completed` | no "planned"; an `active` cycle past `endDate` is a stale-cycle signal |
| milestone `status` | `open`, `closed` | |
| issue link `type` | `blocks`, `is-blocked-by`, `duplicates`, `related-to` | `A blocks B` = source A, target B; `relates_to` is NOT an issue-link type |
| portfolio link and roadmap dependency `type` | `blocks`, `depends_on`, `relates_to`, `enables_future_use`, `shared_capability` | roadmap dependency default `depends_on` |
| governance thread `targetType` | `requirement`, `baseline`, `roadmap-item`, `roadmap-change-request` | never an activity (`issue` is rejected) |
| thread `status` | `open`, `answered`, `decision-needed`, `resolved`, `closed` | `resolved`/`closed` record a decision [O] |
| thread `outcomeType` | `clarification`, `create-activity`, `derive-requirement`, `propose-change-set`, `publication-note`, `no-action` | the 3 actionable ones lead to `prepare_*` drafts |
| thread `actionTargetType` | `issue`, `requirement`, `change-set`, `baseline`, `roadmap-item`, `roadmap-change-request` | link-back after the draft is created |
| change set `status` | `draft`, `in-review`, `approved`, `rejected`, `published` | `approved` is the owner's decision; material sets cannot skip review |
| requirement `status` | `pending`, `met`, `not-met`, `in-progress`, `obsolete` | new scope = `pending`; prefer `obsolete` over delete |
| requirement `type` | `functional`, `non-functional`, `interface`, `business`, `technical` | not validated server-side |
| roadmap item `lifecycle` | `draft`, `imported`, `reviewed`, `approved`, `deferred`, `rejected`, `materialized`, `delivered`, `closed` | create only as `draft` (default) or `imported` |
| lifecycle moves | draft/imported → reviewed, deferred, rejected; reviewed → approved, deferred, rejected; approved → deferred; deferred/rejected → reviewed; materialized → delivered; delivered → closed | `review_workspace_roadmap_item`; imported → approved takes two calls; `commit_roadmap_materialization` keeps `approved` (progress in `materializationSummary.state`), so `delivered` then fails: report it |
| change request `status` | `draft`, `awaiting-review`, `changes-requested`, `approved`, `rejected`, `stale`, `applied`, `withdrawn`, `superseded` | `stale` = nothing applied; submit again |
| change request `changeType` | `edit` (default), `prioritize`, `archive`, `restore`, `lifecycle`, `allocate`, `link`, `capability-link`, `create`, `materialize` | `create` and `materialize` are not usable as change requests (preview needs an existing itemId; apply writes nothing for them). New item → owner-ordered `create_workspace_roadmap_item` as a draft (`lpm-roadmap`) or an owner commit `create_item` (`lpm-roadmap-owner-ops`); later changes use `edit`, `prioritize`, `lifecycle`, `allocate`, `link` |
| review `decision` | `approve`, `request-changes`, `reject` | [O]; never on your own submission |
| roadmap governance `mode` | `off`, `shadow`, `enforce` | read from `get_workspace` → `roadmapGovernanceMode` |
| AISH job `status` | `queued`, `leased`, `running`, `completed`, `failed`, `canceled` | |
| operational entry `type` | `bug`, `improvement`, `incident`, `request` | |
| operational entry `status` | `open`, `in_progress`, `resolved`, `archived` | `archived` is final |
| workspace member `role` | `owner`, `admin`, `member`, `viewer` | least privilege: `member` or `viewer` |
| team member `role` | `owner`, `admin`, `member` | |
| notification `type` | `assignment`, `resolution`, `due-date`, `system`, `action_required`, `info`, `warning` | in-app only |
| workspace `status` | `active`, `archived` | |
| `codeEvidence.status` | `found`, `no_matches`, `no_relevant_matches`, `no_active_index`, `unavailable`, `not_requested` | see `advisor-semantics.md` |

## Rules
1. Use only the values in this table; another value → ask the user.
2. Send the value in the exact case and spelling shown.
3. Never move a lifecycle outside the listed transitions; an error → report it, do not try other values.

## Examples
```text
example: "marca como bloqueada" -> no blocked status -> record a link or a blocker context (lpm-unblock-work)
example: "A depende de B" (activities) -> create_issue_link(sourceIssueId=B, targetIssueId=A, type="blocks")
```
