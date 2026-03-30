# End-to-End Examples

Use these examples when the user wants a complete requirements workflow rather than one isolated mutation.

Replace placeholder IDs with the actual IDs returned by LPM.

## Example 1: Establish The First Working Baseline

Goal: create a current baseline, define requirement groups, and seed the first requirement set.

1. `get_project`
   - `projectId: "<project-id>"`
2. `list_requirement_baselines`
   - `projectId: "<project-id>"`
3. `create_requirement_baseline`
   - `name: "MVP Baseline"`
   - `version: "v1.0"`
   - `isCurrent: true`
4. `list_requirement_groups`
   - `projectId: "<project-id>"`
5. `create_requirement_group`
   - only for missing groups such as `Checkout`, `Payments`, `Observability`
6. `create_requirement`
   - create the first scoped requirements under the new baseline

Expected outcome:

- one current baseline exists
- groups reflect the domain model
- seed requirements are attached to the baseline

## Example 2: Add Traceable Requirements For Existing Delivery Work

Goal: connect new requirements to execution already underway.

1. `list_requirement_baselines`
   - find the current baseline
2. `list_issues`
   - `projectId: "<project-id>"`
   - focus on the issue that already represents delivery work
3. `create_requirement`
   - set `baselineId`
   - set `groupId`
   - set `issueId`
   - write explicit requirement text
4. `get_issue`
   - verify the linked issue is the intended execution artifact

Expected outcome:

- requirement records exist
- traceability to delivery issues is explicit

## Example 3: Baseline Drift Review

Goal: identify whether the active baseline still matches execution reality.

1. `list_requirement_baselines`
2. `list_requirements`
   - `baselineId: "<baseline-id>"`
3. For requirements linked to execution:
   - `get_issue`
4. Flag:
   - linked issues that are missing or closed unexpectedly
   - execution issues with no corresponding requirements
5. `update_requirement`
   - refine status, title, or linkage where the mismatch is understood

Expected outcome:

- orphaned traceability is visible
- the baseline is cleaner and more current

## Placeholder Rules

- Never fabricate IDs.
- Resolve baseline and group IDs before creating requirements.
- Prefer updating requirement records over deleting them when the user asks for cleanup only.
