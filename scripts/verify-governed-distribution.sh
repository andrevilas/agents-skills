#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs verify --agent <agent>` (design §6.2, §5.8).
# Without arguments it verifies the user-scope codex and antigravity installs, as the old script did;
# project roots now come from the gitignored install-targets.json (verify --agent X --scope project).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

if [[ $# -gt 0 ]]; then
  deprecated_notice verify-governed-distribution.sh verify "$@"
  deprecated_run verify "$@"
  exit $?
fi
status=0
for agent in codex antigravity; do
  deprecated_notice verify-governed-distribution.sh verify --agent "$agent"
  deprecated_run verify --agent "$agent" || status=1
done
exit "$status"
