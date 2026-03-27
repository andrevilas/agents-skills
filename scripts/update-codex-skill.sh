#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: update-codex-skill.sh <skill-name> [--dest <dir>]" >&2
  exit 1
fi

SKILL="$1"
shift
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$REPO_ROOT/scripts/update-skill.sh" --agent codex --skill "$SKILL" "$@"
