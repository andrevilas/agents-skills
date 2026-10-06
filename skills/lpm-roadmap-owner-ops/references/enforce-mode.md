# Enforce mode: what to do per operation
Load when: SKILL.md row 4 (mode `enforce` and an owner-ordered write of rows 5–9)
Applies to: lpm-roadmap-owner-ops    Source: lpm `server.ts` (`assertLegacyRoadmapMutationAllowed` callers, `applyWorkspaceRoadmapChangeCommand`, `commitOwnerRoadmapChangeCommand`), `src/lib/workspaceRoadmapGovernance.ts` (`ROADMAP_CHANGE_TYPES`), card {{tool:update_workspace_roadmap_dependency}}

## Summary
In `enforce` the server blocks the direct item, bulk, dependency, allocation and lifecycle tools (`GOVERNANCE_REVIEW_REQUIRED`).
Only some operations have a working change request (CR); the others need the owner's decision, never "needs a change request".
The owner commit, item create, import and roadmap archive are not blocked by the server. Every row below still needs a quoted owner order (SKILL.md P1 step 1).

## Facts
| Operation in mode `enforce` | Server / CR | Do |
|---|---|---|
| (a) edit, prioritize, archive or restore an item; lifecycle gate; new dependency link; new allocation (one item or many) | direct tool blocked; CR changeType edit, prioritize, archive, restore, lifecycle, link, allocate applies it | change request via {{skill:lpm-roadmap}}; STOP |
| (b) create an item; edit a roadmap header title/description or a capability name/description | not blocked; no CR (`create` previews an edit of an existing item and its apply writes nothing) | only with a quoted owner order (the speaker said they are the owner, P1 step 1): SKILL.md row 6 with ONLY `create_item`, `update_roadmap`, `update_capability` operations. No owner order → {{skill:lpm-roadmap}} row 10 decision request; STOP; no preview. New items start `draft`, so later gates still go through CRs |
| owner commit `update_item`, `create_dependency`, `create_allocation` | not blocked, but a CR exists | use row (a), not the owner commit |
| (c) import a TSV; archive a roadmap | not blocked; no CR type | decision request (Rule 2); STOP |
| (c) archive, reject or reactivate a dependency; archive an allocation or change its role/status | blocked; no CR type for unlink, unallocate or role change | decision request (Rule 2); STOP |
| materialization, mode change, migration | the mode is not checked | SKILL.md rows 10–12 as usual |

## Rules
1. Read the mode in P1 step 2; resolve the ids (P1 step 3) before any reply; pick the row above by operation, not by tool.
2. Decision request ({{ref:authority-and-owner-decisions#decision-request}}) for a (c) operation, filled from this run:
   "Decision needed: <operation> on <ids>. Context: <workspaceId> is in `enforce`; the server blocks <tool> and no change-request type exists. Options: A) {{tool:update_workspace_roadmap_governance_policy}}(workspaceId, mode=shadow, expectedUpdatedAt=<get_workspace `updatedAt`>, idempotencyKey=<new>) → <tool>(<ids>, reason=<owner's words>) → {{tool:update_workspace_roadmap_governance_policy}}(workspaceId, mode=enforce, idempotencyKey=<new>): a short window without review, reversible; B) wait for an LPM fix; C) do nothing. Recommendation: A when the owner's order names this operation, else C." Then STOP.
3. "Pode fazer direto" / "do it directly" is NOT an order to change the mode: the owner must pick option A.
4. Never answer "needs a change request" for import, roadmap archive, unlink, unallocate or a role change, even when a tools.md card's `GOVERNANCE_REVIEW_REQUIRED` fix text says "propose a change request".

## Examples
```text
example: owner in enforce: "I am the workspace owner: cria o item 'SSO' no roadmap R"
→ preview_owner_roadmap_change(operations=[{type:"create_item", roadmapId:"<R>", values:{title:"SSO"}}]) → commit (flow-direct-ops A5)
example: no owner statement, enforce: "add item 'SSO'"
→ decision request (lpm-roadmap row 10); STOP; no preview_owner_roadmap_change
example: owner in enforce: "remove a dependência A → B"
→ list_workspace_roadmap_item_links → linkId → decision request (Rule 2: A shadow then back / B wait for LPM fix / C nothing); STOP
```
