#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs install --agent codex` (design §6.2).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

SKILL=""
if [[ $# -gt 0 && "$1" != --* ]]; then
  SKILL="$1"
  shift
fi
deprecated_install_args install-codex-skill.sh codex "$SKILL" "$@"
deprecated_run "${DEPRECATED_ARGS[@]}"
