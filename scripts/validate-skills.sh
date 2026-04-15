#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$REPO_ROOT/scripts/lib/skills.sh"

usage() {
  cat <<'EOF'
Usage:
  validate-skills.sh

Validates the structural conventions and target contracts for all skills in this repository.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

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

check_file() {
  local path="$1"
  local label="$2"
  if [[ ! -f "$path" ]]; then
    fail "$label missing at ${path#$REPO_ROOT/}"
    return 1
  fi
  return 0
}

check_contains() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -qE "$pattern" "$path"; then
    fail "$label missing expected content in ${path#$REPO_ROOT/}"
    return 1
  fi
  return 0
}

while IFS= read -r -d '' skill_dir_path; do
  checked=$((checked + 1))

  skill_name="$(basename "$skill_dir_path")"
  skill_json="$skill_dir_path/skill.json"

  if ! check_file "$skill_json" "$skill_name skill.json"; then
    continue
  fi

  id="$(json_string_value "$skill_json" "id")"
  display_name="$(json_string_value "$skill_json" "name")"
  version="$(json_string_value "$skill_json" "version")"
  canonical_source_rel="$(json_string_value "$skill_json" "canonical_source")"
  codex_target_rel="$(skill_target_rel "$REPO_ROOT" "$skill_name" "codex")"
  antigravity_target_rel="$(skill_target_rel "$REPO_ROOT" "$skill_name" "antigravity")"

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
    check_file "$skill_dir_path/$canonical_source_rel" "$skill_name canonical source"
  fi

  if [[ -z "$codex_target_rel" ]]; then
    fail "$skill_name skill.json missing codex target"
  else
    codex_target_dir="$skill_dir_path/$codex_target_rel"
    if [[ ! -d "$codex_target_dir" ]]; then
      fail "$skill_name codex target directory missing at ${codex_target_dir#$REPO_ROOT/}"
    else
      check_file "$codex_target_dir/SKILL.md" "$skill_name codex SKILL.md"
      check_file "$codex_target_dir/agents/openai.yaml" "$skill_name codex openai.yaml"
      check_contains "$codex_target_dir/SKILL.md" "^---$" "$skill_name codex frontmatter"
      check_contains "$codex_target_dir/SKILL.md" "^name: $skill_name$" "$skill_name codex frontmatter name"
      if [[ -n "$display_name" ]]; then
        check_contains "$codex_target_dir/SKILL.md" "^# $display_name$" "$skill_name codex title"
        check_contains "$codex_target_dir/agents/openai.yaml" "display_name: \"$display_name\"" "$skill_name codex display name"
      fi
      check_contains "$codex_target_dir/agents/openai.yaml" "short_description:" "$skill_name codex short description"
      check_contains "$codex_target_dir/agents/openai.yaml" "default_prompt:" "$skill_name codex default prompt"

      if grep -qE '^## Workflows$|^## Workflow Summary$|^## 1\.' "$codex_target_dir/SKILL.md"; then
        check_file "$codex_target_dir/references/e2e-examples.md" "$skill_name codex e2e examples"
      fi
    fi
  fi

  if [[ -z "$antigravity_target_rel" ]]; then
    fail "$skill_name skill.json missing antigravity target"
  else
    antigravity_target_dir="$skill_dir_path/$antigravity_target_rel"
    if [[ ! -d "$antigravity_target_dir" ]]; then
      fail "$skill_name antigravity target directory missing at ${antigravity_target_dir#$REPO_ROOT/}"
    else
      check_file "$antigravity_target_dir/manifest.json" "$skill_name antigravity manifest"
      check_file "$antigravity_target_dir/PLAYBOOK.md" "$skill_name antigravity playbook"
      check_contains "$antigravity_target_dir/manifest.json" "\"id\"[[:space:]]*:[[:space:]]*\"$skill_name\"" "$skill_name antigravity manifest id"
      if [[ -n "$display_name" ]]; then
        check_contains "$antigravity_target_dir/manifest.json" "\"name\"[[:space:]]*:[[:space:]]*\"$display_name\"" "$skill_name antigravity manifest name"
        check_contains "$antigravity_target_dir/PLAYBOOK.md" "^# $display_name$" "$skill_name antigravity playbook title"
      fi
      if [[ -n "$version" ]]; then
        check_contains "$antigravity_target_dir/manifest.json" "\"version\"[[:space:]]*:[[:space:]]*\"$version\"" "$skill_name antigravity manifest version"
      fi
      check_contains "$antigravity_target_dir/manifest.json" "\"agent\"[[:space:]]*:[[:space:]]*\"antigravity\"" "$skill_name antigravity agent"
      check_contains "$antigravity_target_dir/manifest.json" "\"entrypoint\"[[:space:]]*:[[:space:]]*\"PLAYBOOK.md\"" "$skill_name antigravity entrypoint"
      check_contains "$antigravity_target_dir/PLAYBOOK.md" "Antigravity does not currently appear to consume Codex \`SKILL.md\` bundles natively" "$skill_name antigravity compatibility note"
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
