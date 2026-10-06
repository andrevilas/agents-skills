# Playbook: proposal
Use when: propose rewrites or copies (live scope untouched)
{{partial:playbook-rules}}

## You need
| Input | Where it comes from | If missing |
|---|---|---|
| projectId | the user | STOP. Say: "Which LPM project? (id or name)" |
| kind | "revisions" (new descriptions for current requirements) or "additions" (copies of existing requirements) | STOP. Say: "Rewrite descriptions of current requirements, or copy existing requirements?" |
| items | revisions: each requirement (id or exact title) with its new description; additions: each source requirement (id or exact title) | STOP. Say: "Which requirements, and (for rewrites) the new description of each?" |
| sourceProjectId | additions: the project the copied requirements come from | "none" (same project) |
| changeSet | an existing proposal id the user named | "none" |
| action | "create" or "review" (create if needed, then send to review) | "review" |
| title | the title the user gave | "Scope proposal" |
| summary | what changes and why | STOP. Say: "In one sentence: what changes and why?" |

## Steps
Every CALL with no error line: IF it returns an error → STOP. Say: "<tool> failed: <error text>. Live requirements were not touched."
1. CALL {{tool:get_mcp_connection_info}} {} [A]
   IF result.credential == "oauth" → STOP. Say: "Proposals need an LPM API key with project manage access."
2. CALL {{tool:list_requirement_baselines}} {"projectId":"<input:projectId>"} [A]
   SAVE: baselineId = id of the only item with isCurrent == true
   IF no item or 2+ items have isCurrent == true → STOP. Say: "A proposal needs exactly one current baseline; report this to the owner."
   IF <input:changeSet> != "none" → SAVE: csId = <input:changeSet>; go to step 10.
   IF <input:kind> == "revisions" → SAVE: src = <input:projectId>; srcBaselineId = <saved:baselineId>; go to step 5.
3. SAVE: src = <input:sourceProjectId> if it is not "none", else <input:projectId>
4. CALL {{tool:list_requirement_baselines}} {"projectId":"<saved:src>"} [A]
   SAVE: srcBaselineId = id of the only item with isCurrent == true
   IF no item matches → STOP. Say: "Project <saved:src> has no current baseline to copy from."
5. CALL {{tool:list_requirements}} {"projectId":"<saved:src>","baselineId":"<saved:srcBaselineId>"} [A]
   SAVE: rows = for each entry of <input:items>, the only item whose id or title == that entry
   IF an entry matches no item or 2+ items → STOP. Say: "Which requirement is '<that entry>'? (id)"
6. SAVE: proposal = one JSON object, never both keys:
     revisions → {"revisions":[{"requirementId":"<row id>","title":"<row title, exact>","beforeDescription":"<row description, exact>","description":"<the new description>"}, …]}
     additions → {"additions":[{"key":"<row id>","title":"<row title>","description":"<row description>","type":"<row type>","source":{"projectId":"<saved:src>","baselineId":"<saved:srcBaselineId>","requirementId":"<row id>"},"linkedIssueIds":[]}, …]}
   IF a new description equals its beforeDescription → STOP. Say: "The new description of <that requirementId> is the same as the current one."
7. CALL {{tool:create_change_set}} {"projectId":"<input:projectId>","title":"<input:title>","summary":"<input:summary>","sourceBaselineId":"<saved:baselineId>","requirementProposal":"<saved:proposal>","dryRun":true} [A] (dry run: nothing is written)
   SAVE: fingerprint = result.draft.scopeProposal.contentFingerprint; materiality = result.draft.reviewPolicy.materiality
   VERIFY: CALL {{tool:list_change_sets}} {"projectId":"<input:projectId>"} [A]
   IF the call returns an error or an item with id "proposal-<saved:fingerprint>" has status "approved" or "published" → STOP. Say: "This exact proposal already exists as proposal-<saved:fingerprint> (<that status>)."
8. ASK: "Create proposal '<input:title>' (<input:kind>, <the number of rows> requirements, materiality <saved:materiality>) on baseline <saved:baselineId>? Live requirements are not changed. (yes/no)" — continue only if the user says yes; otherwise STOP.
9. CALL {{tool:create_change_set}} {"projectId":"<input:projectId>","title":"<input:title>","summary":"<input:summary>","sourceBaselineId":"<saved:baselineId>","requirementProposal":"<saved:proposal>","expectedProposalFingerprint":"<saved:fingerprint>"} [A] (the same arguments as step 7, without dryRun)
   SAVE: csId = result.id; reused = result.reused
   VERIFY: CALL {{tool:get_change_set}} {"projectId":"<input:projectId>","changeSetId":"<saved:csId>"} [A]
   IF the call returns an error or result.scopeProposal.contentFingerprint != <saved:fingerprint> → STOP. Say: "Proposal <saved:csId> does not show fingerprint <saved:fingerprint>."
10. CALL {{tool:get_change_set}} {"projectId":"<input:projectId>","changeSetId":"<saved:csId>"} [A]
   SAVE: csStatus = result.status; fingerprint = result.scopeProposal.contentFingerprint (empty if no scopeProposal)
   IF <saved:fingerprint> is empty → switch to playbook change-set.
   IF <input:action> == "create" or <saved:csStatus> == "in-review" → go to Answer.
   IF <saved:csStatus> != "draft" → STOP. Say: "<saved:csId> is <saved:csStatus>; only a draft goes to review."
11. ASK: "Send proposal <saved:csId> to the owner's review? (yes/no)" — continue only if the user says yes; otherwise STOP.
12. CALL {{tool:update_change_set}} {"projectId":"<input:projectId>","changeSetId":"<saved:csId>","status":"in-review","expectedProposalFingerprint":"<saved:fingerprint>"} [C] (send only these 4 keys)
   IF the call returns an error → STOP. Say: "Not sent to review: <error text>. 'Proposal or base changed' means: build a fresh proposal (rerun this playbook)."
   VERIFY: CALL {{tool:get_change_set}} {"projectId":"<input:projectId>","changeSetId":"<saved:csId>"} [A]
   IF the call returns an error or result.status != "in-review" → STOP. Say: "<saved:csId> is <result.status>, not in-review."
   SAVE: csStatus = result.status

## Answer (reply with exactly this block, filled in; write nothing before or after it)
```text
Scope: <input:projectId>; proposal <saved:csId> on baseline <saved:baselineId>
Done: <proposal created (reused <saved:reused>) | sent to review | nothing changed>; status <saved:csStatus>; live requirements unchanged
Evidence: dry-run fingerprint <saved:fingerprint>, materiality <saved:materiality>; get_change_set → status <saved:csStatus> | reads only
Pending: none | owner review — the workspace owner
Next: <the ASK or STOP text that ended the run> | the owner approves or rejects it (playbook change-set-decision) | none
```
status: draft | in-review | approved | rejected | published, from your last get_change_set. Never claim a check that a step above did not run and pass.
