#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/skills.sh"

GITHUB_ROOT="$(dirname "$REPO_ROOT")"
LPM_REPO="${LPM_REPO:-$GITHUB_ROOT/lpm}"
AISH_REPO="${AISH_REPO:-$GITHUB_ROOT/ai-software-house}"
CODEX_GLOBAL="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"
ANTIGRAVITY_GLOBAL="${ANTIGRAVITY_SKILLS_DIR:-$HOME/.antigravity/skills}"

GLOBAL_SKILLS=()
for skill_dir in "$REPO_ROOT"/skills/*; do
  [[ -d "$skill_dir" ]] || continue
  GLOBAL_SKILLS+=("${skill_dir##*/}")
done

PROJECT_SKILLS=(
  governed-project-integrity-review
  aish-governed-development-operator
  portfolio-health-review
  software-project-orchestrator
  lpm-workspace-admin
)

verified_copy_count=0

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
  verified_copy_count=$((verified_copy_count + 1))
}

verify_external_codex_copy() {
  local skill="$1"
  local source_dir="$REPO_ROOT/external/$skill/codex/$skill"
  local destination_dir="$CODEX_GLOBAL/$skill"

  if [[ ! -d "$destination_dir" ]]; then
    echo "FAIL: missing external codex copy for $skill at $destination_dir" >&2
    return 1
  fi
  if ! diff -qr "$source_dir" "$destination_dir" >/dev/null; then
    echo "FAIL: divergent external codex copy for $skill at $destination_dir" >&2
    return 1
  fi
  echo "OK: $skill external codex at $CODEX_GLOBAL"
  verified_copy_count=$((verified_copy_count + 1))
}

for skill in "${GLOBAL_SKILLS[@]}"; do
  verify_copy "$skill" codex "$CODEX_GLOBAL"
  verify_copy "$skill" antigravity "$ANTIGRAVITY_GLOBAL"
done

for skill in "${PROJECT_SKILLS[@]}"; do
  verify_copy "$skill" codex "$LPM_REPO/.codex/skills"
  verify_copy "$skill" codex "$AISH_REPO/.codex/skills"
  verify_copy "$skill" codex "$REPO_ROOT/.codex/skills"
done

verify_external_codex_copy grill-me

echo "Governed distribution verified across $verified_copy_count installed copies."
