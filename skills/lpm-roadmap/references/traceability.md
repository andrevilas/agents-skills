# Roadmap traceability
Load when: when tracing a roadmap item or auditing unlinked work
Applies to: lpm-roadmap    Source: cards {{tool:get_workspace_roadmap_traceability}}, {{tool:explain_workspace_roadmap_traceability_gap}}, {{tool:get_project_roadmap_drilldown}}, {{tool:list_unlinked_project_work}}, {{tool:list_workspace_roadmap_materializations}}, {{tool:list_workspace_roadmap_allocations}}, {{tool:get_workspace_roadmap_governance_observability}}

## Summary
Lineage runs item → project allocation → materialization into a requirement → activities that carry the item's lineage.
{{tool:explain_workspace_roadmap_traceability_gap}} names the missing steps; {{tool:get_workspace_roadmap_traceability}} returns the records.
Both are heavy (they load every activity of the workspace) and need an LPM API key: one item per call, never a loop.
Records include superseded, rejected or archived entries: check each `status` before counting.
This skill reports gaps and names the owner skill; it closes no gap itself.

## Facts
### Item lineage ({{tool:get_workspace_roadmap_traceability}})
| Field | Meaning | Consequence for the agent |
|---|---|---|
| `completeness.allocated` | the item has an allocation record | count only allocations with `status` active or absent |
| `completeness.materialized` | any materialization record exists | true even for `method` `conflict` or `deferred`: check `materializations[].method` |
| `completeness.executionLinked` | an activity points at the item | only activities created with `workOrigin: "roadmap-materialized"` and `roadmapLineageRefs` count |
| `linkedIssues[]` | those activities, each with `projectId` | report title, status and project |
| `dependencies[]`, `allocations[]` | include rejected/archived records | filter by `status` |
| `edges[]` | `{sourceType, sourceId, targetType, targetId, relationship}` | use for "what depends on what" |

### Gaps ({{tool:explain_workspace_roadmap_traceability_gap}})
| Gap | Next action | Owner skill |
|---|---|---|
| `allocated` | mode `shadow`/`enforce`: change request `changeType: "allocate"` (SKILL.md P1); mode `off`: owner-ordered allocation | this skill / {{skill:lpm-roadmap-owner-ops}} |
| `materialized` | the item must be `approved` and allocated, then materialization preview → commit | {{skill:lpm-roadmap-owner-ops}}, then {{skill:lpm-requirements-scope}} |
| `executionLinked` | create activities from the materialized requirement with `workOrigin` and `roadmapLineageRefs` | {{skill:lpm-plan-work}} |

`nextActions[]` holds one English sentence per gap, in the same order as `gaps[]`. `complete == true` → no gap.

### Materialization methods ({{tool:list_workspace_roadmap_materializations}})
| `method` | `lineageState` | Meaning |
|---|---|---|
| `linked_existing`, `new_requirement`, `split_from_parent` | `productive` | the item reached a requirement (`requirementId`, `baselineId`); one productive lineage per item + project |
| `conflict`, `deferred` | `attention` | a decision is still needed: report it to the owner |

### Project drilldown ({{tool:get_project_roadmap_drilldown}})
| Field | Meaning |
|---|---|
| `allocations[]` | includes `superseded`: an item may show for a project that lost primary ownership |
| `items[]` | roadmap items allocated to the project (archived items excluded) |
| `upstreamLinks[]` / `downstreamLinks[]` | what the project's items depend on / what depends on them |
| `materializations[]` | lineage records of the project |
| error "Project is not attached to a workspace" | there is no workspace roadmap: nothing to drill down |

### Unlinked work ({{tool:list_unlinked_project_work}})
| Fact | Consequence |
|---|---|
| plain array of full activity objects, no count, no pagination | count it yourself |
| includes `done` and `canceled` activities | drop them unless the user asked for all |
| loads every activity of the workspace | always pass `projectId` on a large workspace |
| relinking an activity to an item is a governed roadmap change | propose it to the owner (decision request); never relink yourself |

### Coverage numbers
{{tool:get_workspace_roadmap_governance_observability}} → `lineage{issueCount, coveredCount, coverageRatio}` gives workspace coverage without listing activities. It is slow: call it once per report.

## Rules
1. Call {{tool:explain_workspace_roadmap_traceability_gap}} first; call {{tool:get_workspace_roadmap_traceability}} only when the user needs the records.
2. Never call either tool in a loop over many items; for a whole-roadmap view use {{tool:get_workspace_roadmap_overview}} → `counts`, `allocations[]`, `materializations[]`.
3. Treat an allocation as current only when `status` is `active` or absent.
4. Report `conflict` and `deferred` materializations as pending decisions, never as delivered.
5. Every gap in the report names its owner skill from the Gaps table.
6. On a connector these tools are absent: say "Traceability needs an LPM API key." and STOP.

## Examples
```text
example: gaps = ["materialized", "executionLinked"]
  → "Item <title> is allocated to <project> but not materialized.
     Next: lpm-roadmap-owner-ops (materialization, owner order), then lpm-plan-work (activities with lineage)."
```
