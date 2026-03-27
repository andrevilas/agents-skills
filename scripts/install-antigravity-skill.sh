#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: install-antigravity-skill.sh <skill-name> [--dest <dir>]" >&2
  exit 1
fi

SKILL="$1"
shift
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$REPO_ROOT/scripts/install-skill.sh" --agent antigravity --skill "$SKILL" "$@"
