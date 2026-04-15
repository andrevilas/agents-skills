---
name: governance-decision-operator
description: Operate governance threads, decision inbox triage, and structured outcomes over the LPM MCP. Use this skill when the user wants to process decision threads, respond with auditability, or resolve governance into action-ready outcomes.
---

# Governance Decision Operator

Use this skill when the task is governance decision handling over the `lpm` MCP. It focuses on decision inbox triage, governance thread resolution, and structured downstream outcomes.

## When To Use

Use this skill when the user asks to:

- inspect pending governance decisions
- answer or resolve a governance thread
- derive an issue, requirement, or change set from a decision
- summarize what still needs a decision owner

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Inbox: `get_project_decision_inbox`, `list_project_decision_queue`
- Thread reads: `get_governance_thread_resolution_context`, `get_governance_thread_messages`
- Response and resolution: `reply_to_governance_thread`, `update_governance_thread`, `resolve_governance_thread_with_outcome`
- Draft helpers: `prepare_issue_draft_from_governance_thread`, `prepare_requirement_draft_from_governance_thread`, `prepare_change_set_draft_from_governance_thread`

## Operating Principles

1. Read before deciding.
   Inspect full thread context before replying or resolving.

2. Preserve auditability.
   Prefer structured outcomes over loose narrative conclusions.

3. Route to the right artifact.
   Derive issue, requirement, or change set only when the thread clearly points there.

4. Minimize governance drift.
   Close the thread only when the decision outcome is explicit.

## Workflows

## 1. Decision Inbox Triage

1. Read pending decision items.
2. Rank by action required and downstream impact.
3. Choose the next thread to resolve.

## 2. Thread Resolution

1. Inspect resolution context and messages.
2. Reply if clarification is needed.
3. Resolve with a structured outcome when the decision is clear.

## 3. Outcome Derivation

1. Draft the right downstream artifact.
2. Confirm the title, summary, and target.
3. Link the outcome back to the decision thread.

## Guardrails

- Do not close a governance thread without explicit outcome.
- Do not derive downstream work from ambiguous threads without clarification.
- Do not collapse governance and execution history into one opaque comment.
