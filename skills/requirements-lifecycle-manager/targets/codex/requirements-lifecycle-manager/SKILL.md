---
name: requirements-lifecycle-manager
description: Manage requirements, requirement groups, baselines, and traceability over the LPM MCP. Use this skill when the user wants to create or version requirement sets, organize requirements into groups, review baseline drift, or link requirements to execution issues.
---

# Requirements Lifecycle Manager

Use this skill when the task is requirements governance over the `lpm` MCP. It turns Codex into a structured operator for baselines, requirement groups, and requirement traceability without mixing that workflow into generic issue execution.

## When To Use

Use this skill when the user asks to:

- create or version a requirement baseline
- organize requirements into groups or capability buckets
- add, update, or remove requirements
- review requirement coverage or drift
- connect requirements to delivery issues
- inspect whether a project has a coherent current baseline

Read [references/lpm-capabilities.md](./references/lpm-capabilities.md) when you need exact tool mapping.
Read [references/e2e-examples.md](./references/e2e-examples.md) when the user wants a realistic end-to-end flow.

## Tool Surface

This skill assumes the `lpm` MCP exposes these tool groups:

- Requirements: `list_requirements`, `create_requirement`, `update_requirement`, `delete_requirement`
- Baselines: `list_requirement_baselines`, `create_requirement_baseline`, `update_requirement_baseline`, `delete_requirement_baseline`
- Groups: `list_requirement_groups`, `create_requirement_group`, `update_requirement_group`, `delete_requirement_group`
- Adjacent context: `get_project`, `list_issues`, `get_issue`

## Operating Principles

1. Treat the baseline as the unit of truth.
   Inspect the current baseline before creating net-new requirements.

2. Separate taxonomy from content.
   Create or rename groups only when the grouping model is genuinely unclear or fragmented.

3. Preserve traceability.
   If a requirement points to an issue, retain or explicitly update that link during edits.

4. Minimize drift.
   Prefer updating the current baseline deliberately rather than scattering parallel baselines with overlapping purpose.

5. Keep change intent explicit.
   State whether the action is authoring, refinement, deprecation, or structural cleanup.

## Workflows

## 1. Baseline Setup

1. Inspect the project and existing baselines.
2. Create a new baseline only when there is a real version boundary.
3. Mark the new baseline as current only when the user intends to shift the source of truth.
4. Create missing requirement groups before importing many requirements.

## 2. Requirements Authoring

1. Identify the target baseline and group.
2. Inspect nearby requirements to avoid duplicates.
3. Create the requirement with a clear title, type, and status.
4. Link the requirement to an issue when execution already exists or must be tracked.

## 3. Change Control

1. List requirements for the baseline or group in scope.
2. Update requirement text, type, status, or traceability links deliberately.
3. If a requirement is obsolete, prefer status change or baseline replacement before deletion unless the user clearly wants hard removal.

## 4. Traceability Review

1. Inspect requirements in the active baseline.
2. Check whether execution-linked requirements still point to live issues.
3. Flag orphaned requirements and issue work that lacks requirement coverage.

## Decision Heuristics

- If many requirements share the same domain and none are grouped, create a group before scaling edits.
- If a baseline exists but is not marked current, confirm the user wants a new working source of truth before flipping it.
- If a requirement maps to a closed or missing issue, mark that as a traceability review item.
- If the user asks for cleanup only, favor updates over deletions to preserve auditability.

## Guardrails

- Do not create overlapping baselines with the same intent and version shape.
- Do not delete a baseline before understanding whether it is current.
- Do not drop issue traceability without saying so explicitly.
- Do not infer requirement coverage from issue titles alone when requirement records are available.
