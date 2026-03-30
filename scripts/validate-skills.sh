#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  validate-skills.sh

Validates the structural conventions for all skills in this repository.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

failures=0
checked=0

fail() {
  local msg="$1"
  echo "FAIL: $msg" >&2
  failures=$((failures + 1))
}

pass() {
  local msg="$1"
  echo "OK: $msg"
}

json_string_value() {
  local file="$1"
  local key="$2"
  sed -nE "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$file" | head -n1
}

check_file() {
  local path="$1"
  local label="$2"
  if [[ ! -f "$path" ]]; then
    fail "$label missing at ${path#$REPO_ROOT/}"
    return 1
  fi
  return 0
}

while IFS= read -r -d '' skill_dir; do
  checked=$((checked + 1))

  skill_name="$(basename "$skill_dir")"
  skill_json="$skill_dir/skill.json"

  if ! check_file "$skill_json" "$skill_name skill.json"; then
    continue
  fi

  id="$(json_string_value "$skill_json" "id")"
  canonical_source_rel="$(json_string_value "$skill_json" "canonical_source")"
  codex_target_rel="$(sed -nE 's/.*"codex"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$skill_json" | head -n1)"
  antigravity_target_rel="$(sed -nE 's/.*"antigravity"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$skill_json" | head -n1)"

  if [[ -z "$id" ]]; then
    fail "$skill_name skill.json missing id"
    continue
  fi

  if [[ "$id" != "$skill_name" ]]; then
    fail "$skill_name skill.json id mismatch: expected $skill_name got $id"
  fi

  if [[ -z "$canonical_source_rel" ]]; then
    fail "$skill_name skill.json missing canonical_source"
  else
    check_file "$skill_dir/$canonical_source_rel" "$skill_name canonical source"
  fi

  if [[ -z "$codex_target_rel" ]]; then
    fail "$skill_name skill.json missing codex target"
  else
    codex_target_dir="$skill_dir/$codex_target_rel"
    if [[ ! -d "$codex_target_dir" ]]; then
      fail "$skill_name codex target directory missing at ${codex_target_dir#$REPO_ROOT/}"
    else
      check_file "$codex_target_dir/SKILL.md" "$skill_name codex SKILL.md"
      check_file "$codex_target_dir/agents/openai.yaml" "$skill_name codex openai.yaml"

      if grep -qE '^## Workflows$|^## Workflow Summary$|^## 1\.' "$codex_target_dir/SKILL.md"; then
        check_file "$codex_target_dir/references/e2e-examples.md" "$skill_name codex e2e examples"
      fi
    fi
  fi

  if [[ -z "$antigravity_target_rel" ]]; then
    fail "$skill_name skill.json missing antigravity target"
  else
    antigravity_target_dir="$skill_dir/$antigravity_target_rel"
    if [[ ! -d "$antigravity_target_dir" ]]; then
      fail "$skill_name antigravity target directory missing at ${antigravity_target_dir#$REPO_ROOT/}"
    else
      check_file "$antigravity_target_dir/manifest.json" "$skill_name antigravity manifest"
      check_file "$antigravity_target_dir/PLAYBOOK.md" "$skill_name antigravity playbook"
    fi
  fi

  pass "$skill_name"
done < <(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

if [[ "$checked" -eq 0 ]]; then
  echo "No skills found under $SKILLS_DIR" >&2
  exit 1
fi

if [[ "$failures" -ne 0 ]]; then
  echo
  echo "Validation failed: $failures issue(s) across $checked skill(s)." >&2
  exit 1
fi

echo
echo "Validation passed: $checked skill(s) checked."
