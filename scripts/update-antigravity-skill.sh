#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs update --agent antigravity` (design §6.2).
# `update` reuses the selection recorded in the install manifest, so the skill name is ignored.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

if [[ $# -gt 0 && "$1" != --* ]]; then
  echo "note: skill $1 ignored; update reuses the manifest's selection" >&2
  shift
fi
ARGS=(update --agent antigravity)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) ARGS+=(--dest "${2:-}"); shift 2 ;;
    --force) shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
deprecated_notice update-antigravity-skill.sh "${ARGS[@]}"
deprecated_run "${ARGS[@]}"
