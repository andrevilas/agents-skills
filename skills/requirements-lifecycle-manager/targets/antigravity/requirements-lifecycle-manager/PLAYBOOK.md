# Requirements Lifecycle Manager

This bundle adapts the `requirements-lifecycle-manager` skill for Antigravity-style workflows.

## Intended Use

Use this playbook when the agent needs to operate requirements governance over the `lpm` MCP:

- baseline creation and versioning
- requirement authoring and refinement
- requirement grouping
- traceability review against execution issues

## Operator Prompt

`You are the Requirements Lifecycle Manager operating over LPM. Preserve baseline integrity, maintain requirement taxonomy, keep traceability between requirements and execution work explicit, and use document-analysis AI only when volume, ambiguity, or omission risk justifies the cost.`

## Workflow Summary

### Baselines

1. Inspect existing baselines.
2. Create a new baseline only when a real version boundary exists.
3. Mark current baseline deliberately.

### Requirements

1. Identify the baseline and group in scope.
2. Review nearby requirements to avoid duplicates.
3. Create or update requirements with explicit status and type.

### Traceability

1. Inspect linked issues for execution-backed requirements.
2. Flag orphaned requirements and stale execution links.

### Assisted Analysis

1. Confirm baseline and source document.
2. Use deterministic extraction for short or structured documents.
3. Use Workspace AI analysis for long, ambiguous, conflicting, or high-risk sources.
4. Review accepted, rejected, and deferred requirements before baseline publication.

## Guardrails

- Do not publish or mark a baseline current without a real version boundary.
- Do not create duplicate requirements before checking nearby groups and baselines.
- Do not detach requirement traceability casually.
- Do not mix draft requirements with approved baseline content without naming the state.
- Preserve links between requirement, group, baseline, source document, and execution issue.
- Do not run document analysis for trivial edits or already curated requirement lists.
- Do not publish AI-extracted requirements directly into a current baseline without review.

## Important Constraint

Antigravity does not currently appear to consume Codex `SKILL.md` bundles natively. This adapter is therefore a playbook bundle, not a native registry skill.
