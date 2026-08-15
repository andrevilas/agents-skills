#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

assert_contains() {
  local file="$1"
  local pattern="$2"
  local scenario="$3"
  if ! grep -qE -- "$pattern" "$file"; then
    echo "FAIL: $scenario missing behavior '$pattern' in ${file#$REPO_ROOT/}" >&2
    exit 1
  fi
  echo "OK: $scenario"
}

"$REPO_ROOT/scripts/validate-skills.sh"

INTEGRITY_SKILL="$REPO_ROOT/skills/governed-project-integrity-review/targets/codex/governed-project-integrity-review/SKILL.md"
AISH_SKILL="$REPO_ROOT/skills/aish-governed-development-operator/targets/codex/aish-governed-development-operator/SKILL.md"
HEALTH_SKILL="$REPO_ROOT/skills/portfolio-health-review/targets/codex/portfolio-health-review/SKILL.md"
ORCHESTRATOR_SKILL="$REPO_ROOT/skills/software-project-orchestrator/targets/codex/software-project-orchestrator/SKILL.md"
ADMIN_SKILL="$REPO_ROOT/skills/lpm-workspace-admin/targets/codex/lpm-workspace-admin/SKILL.md"

assert_contains "$INTEGRITY_SKILL" 'A completed AISH job linked to an issue requires evidence' 'terminal integrity invariant'
assert_contains "$INTEGRITY_SKILL" 'same key must not create more work items' 'materialization idempotency invariant'
assert_contains "$INTEGRITY_SKILL" 'active cycle past its end date is a health signal' 'stale-cycle detection'
assert_contains "$INTEGRITY_SKILL" 'current baseline does not erase unpublished changes' 'scope-drift detection'
assert_contains "$AISH_SKILL" '--idempotency-key' 'AISH stable materialization key'
assert_contains "$AISH_SKILL" 'aish jobs reconcile' 'AISH terminal retry path'
assert_contains "$HEALTH_SKILL" 'metrics\.integrity' 'composite portfolio health'
assert_contains "$ORCHESTRATOR_SKILL" 'terminal issue-job reconciliation' 'orchestrator closure contract'
assert_contains "$ADMIN_SKILL" 'After unarchiving' 'post-unarchive governance preflight'

echo
echo 'Behavior validation passed: governed integrity scenarios are present.'
