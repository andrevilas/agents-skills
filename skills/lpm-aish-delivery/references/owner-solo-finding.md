# Owner-authorized SOLO finding resolution
Load when: the owner explicitly authorizes resolving their own finding using a concrete SOLO decision and native evidence.

This optional exception to finding-author segregation is not independent human review, activity closure, release approval or a global solo mode. It has its own evidence contract; the separate single-human-workspace rule for roadmap reviews does not substitute for it. Default finding resolution remains unchanged.

## Prepare concrete evidence

1. Read {{tool:get_issue}} and the relevant {{tool:get_aish_job}} records. Keep the exact project, target issue, finding id and original block reason. Retrieve the current findingFingerprint from its original block response or an identical block replay using {{tool:record_aish_delivery_finding}}. Do not guess the fingerprint or change the block reason. There is no finding-list tool.
2. Require the owner's explicit instruction for this resolution and their existing authorized credential. The authenticated caller must own the workspace; only projects genuinely without a workspace may use project ownership. Agent credentials cannot invoke SOLO even when associated with the owner. Never create another identity or broaden credentials to evade this guard.
3. Obtain a real review report registered as existing artifact kind `document`, at most 64 KiB, and verify it with {{tool:read_aish_delivery_artifact}} using its actual producer issue. Report schema `aish-solo-finding-review/1` binds projectId, target issueId, findingId, findingFingerprint, commitSha, reviewedAt, reviewMethod (`automated` or `owner-reviewed`), reviewerDescription, conclusion=`finding-resolved`, summary and nonempty sourceEvidenceIds. Describe the actual reviewer/model and limitations. Do not fabricate evidence or call model review independent human review.
4. Verify the report producer and `test-validation` job are completed at the exact 40-character commit with current authenticated, sanitized, successful native completion receipts. Failed attempts, partial dispositions, administrative completion or a different commit do not qualify. Copy validationJobId and validationEvidenceId from the actual job. Report artifact id/hash and source evidence must be intact. The producer must have its exact native plan and node-run: current approved plan hash, canonical plan contents, node revision/recipe/scope and run job binding must agree. An executing session may supply a completed review job; a missing or replaced run does not qualify. Cross-issue evidence is allowed only within the same project/workspace, with both actual producer issue ids explicitly named in the decision.
5. Through {{skill:lpm-governance-decisions}}, record the owner's concrete authorization after report and validation exist. The thread must be a resolved owner clarification, with genuine UTC resolvedAt and updatedAt identifying the same unmodified resolution. If edited since resolution, obtain a fresh owner resolution; do not reuse old author/time metadata. Generic autopilot prose is insufficient. Its entire decisionOutcome.summary must be strict JSON:

```text
example: structured authorization with synthetic placeholders (replace only from verified records)
{
  "schema": "aish-owner-solo-review-authorization/1",
  "scope": "resolve-one-finding",
  "projectId": "<actual project>", "issueId": "<target issue>", "findingId": "<exact finding>",
  "expectedFindingFingerprint": "<actual fingerprint>",
  "baselineId": "<actual issue baseline; JSON null only if absent>",
  "commitSha": "<reviewed and validated commit>",
  "reviewArtifactId": "<actual artifact>", "reviewArtifactSha256": "<actual hash>",
  "reviewArtifactIssueId": "<actual producer issue>",
  "validationJobId": "<actual validation job>", "validationEvidenceId": "<current receipt>",
  "validationIssueId": "<actual validation issue>"
}
```

The report predates the decision; use real record timestamps, never invent a time for a human statement. The report itself need not include decisionThreadId, avoiding a circular dependency.

## Resolve and verify

6. Call {{tool:record_aish_delivery_finding}} with the existing projectId, issueId, findingId, action=`resolve`, authorized reason and optional object soloReview containing the decision thread id plus the six request bindings shown below, all from the verified records above. No caller identity or time fields belong in the request. Missing or conflicting bindings → stop and report the unmet condition; never silently fall back or relax validation.
```text
example: soloReview request bindings (synthetic placeholders)
{"decisionThreadId":"<resolved owner thread>","expectedFindingFingerprint":"<current fingerprint>","commitSha":"<exact commit>","reviewArtifactId":"<artifact id>","reviewArtifactSha256":"<artifact hash>","validationJobId":"<job id>","validationEvidenceId":"<current receipt>"}
```

7. Keep the returned finding id, eventId, mode=`owner-authorized-solo`, reused flag and all proof ids. An identical retry is read-only and returns the same event; changed inputs conflict. Verify {{tool:get_issue}} reflects audit invalidation for a newly resolved finding. An identical replay must not clear a later audit. Preserve original finding author/reason/history and failed job evidence.
8. Run {{tool:audit_aish_issue_delivery}} and report its outcome separately. An audit error, including aggregate size limits, does not undo a confirmed resolution and does not prove closure. Record the resolution receipt and the audit gap; do not delete evidence, raise limits, change session history or claim completion. Release readiness uses its own server-scoped checks and authorization.

The server first authorizes access and pre-reads the bounded immutable report to discover source ids, then snapshots every authority/provenance record and named source, verifies the report again, and compares all records in the final transaction. Source changes after that complete snapshot refuse resolution; this does not attest that no change preceded the snapshot.

Report: owner instruction, exact decision/finding/commit, review and validation evidence, resolution event/mode, audit outcome and remaining gates. Resolving this one finding grants no authority over another finding, later commit, release or pilot.
