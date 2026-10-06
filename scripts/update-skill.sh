#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs update` (design §6.2).
# `update` reuses the selection recorded in the install manifest, so a skill name is ignored.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

ARGS=(update)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) ARGS+=(--agent "${2:-}"); shift 2 ;;
    --dest) ARGS+=(--dest "${2:-}"); shift 2 ;;
    --skill) echo "note: --skill ${2:-} ignored; update reuses the manifest's selection" >&2; shift 2 ;;
    --force) shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
deprecated_notice update-skill.sh "${ARGS[@]}"
deprecated_run "${ARGS[@]}"
