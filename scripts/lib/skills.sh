#!/usr/bin/env bash

skills_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

json_string_value() {
  local file="$1"
  local key="$2"
  sed -nE "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$file" | head -n1
}

skill_dir() {
  local repo_root="$1"
  local skill="$2"
  echo "$repo_root/skills/$skill"
}

skill_json_path() {
  local repo_root="$1"
  local skill="$2"
  echo "$(skill_dir "$repo_root" "$skill")/skill.json"
}

skill_exists() {
  local repo_root="$1"
  local skill="$2"
  [[ -f "$(skill_json_path "$repo_root" "$skill")" ]]
}

skill_target_rel() {
  local repo_root="$1"
  local skill="$2"
  local agent="$3"
  local skill_json
  skill_json="$(skill_json_path "$repo_root" "$skill")"
  sed -nE "s/.*\"$agent\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" "$skill_json" | head -n1
}

skill_supports_agent() {
  local repo_root="$1"
  local skill="$2"
  local agent="$3"
  local skill_json
  skill_json="$(skill_json_path "$repo_root" "$skill")"
  grep -q "\"$agent\"" "$skill_json"
}

skill_target_dir() {
  local repo_root="$1"
  local skill="$2"
  local agent="$3"
  local rel
  rel="$(skill_target_rel "$repo_root" "$skill" "$agent")"
  if [[ -z "$rel" ]]; then
    return 1
  fi
  echo "$(skill_dir "$repo_root" "$skill")/$rel"
}

default_agent_dest() {
  local agent="$1"
  case "$agent" in
    codex)
      echo "${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"
      ;;
    antigravity)
      echo "${ANTIGRAVITY_SKILLS_DIR:-$HOME/.antigravity/skills}"
      ;;
    *)
      return 1
      ;;
  esac
}
