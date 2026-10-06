#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs install` (design §6.2).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

AGENT=""
SKILL=""
REST=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="${2:-}"; shift 2 ;;
    --skill) SKILL="${2:-}"; shift 2 ;;
    *) REST+=("$1"); shift ;;
  esac
done
if [[ -z "$AGENT" ]]; then
  echo "Usage: install-skill.sh --agent <codex|claude-code|antigravity> [--skill <name>] [--dest <dir>]" >&2
  exit 2
fi
deprecated_install_args install-skill.sh "$AGENT" "$SKILL" "${REST[@]}"
deprecated_run "${DEPRECATED_ARGS[@]}"
