#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/skills.sh"

GITHUB_ROOT="$(dirname "$REPO_ROOT")"
LPM_REPO="${LPM_REPO:-$GITHUB_ROOT/lpm}"
AISH_REPO="${AISH_REPO:-$GITHUB_ROOT/ai-software-house}"
CODEX_GLOBAL="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"
ANTIGRAVITY_GLOBAL="${ANTIGRAVITY_SKILLS_DIR:-$HOME/.antigravity/skills}"

SKILLS=(
  governed-project-integrity-review
  aish-governed-development-operator
  portfolio-health-review
  software-project-orchestrator
  lpm-workspace-admin
)

verify_copy() {
  local skill="$1"
  local agent="$2"
  local destination_root="$3"
  local source_dir
  local destination_dir="$destination_root/$skill"

  source_dir="$(skill_target_dir "$REPO_ROOT" "$skill" "$agent")"
  if [[ ! -d "$destination_dir" ]]; then
    echo "FAIL: missing $agent copy for $skill at $destination_dir" >&2
    return 1
  fi
  if ! diff -qr "$source_dir" "$destination_dir" >/dev/null; then
    echo "FAIL: divergent $agent copy for $skill at $destination_dir" >&2
    return 1
  fi
  echo "OK: $skill $agent at $destination_root"
}

for skill in "${SKILLS[@]}"; do
  verify_copy "$skill" codex "$CODEX_GLOBAL"
  verify_copy "$skill" antigravity "$ANTIGRAVITY_GLOBAL"
  verify_copy "$skill" codex "$LPM_REPO/.codex/skills"
  verify_copy "$skill" codex "$AISH_REPO/.codex/skills"
  verify_copy "$skill" codex "$REPO_ROOT/.codex/skills"
done

echo "Governed distribution verified across 25 installed copies."
