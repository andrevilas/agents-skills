#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs install --agent codex --include-external` (design §6.2).
# v2 installs every active external bundle (external/*/metadata.json status == active) together with the
# selected LPM profile (core by default); the bundle name argument is only checked for existence.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

if [[ $# -gt 0 && "$1" != --* ]]; then
  if [[ ! -f "$DEPRECATED_REPO_ROOT/external/$1/codex/$1/SKILL.md" ]]; then
    echo "External Codex bundle not found for $1: external/$1/codex/$1" >&2
    exit 1
  fi
  shift
fi
ARGS=(install --agent codex --include-external)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) ARGS+=(--dest "${2:-}"); shift 2 ;;
    --force) shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
deprecated_notice install-external-codex-skill.sh "${ARGS[@]}"
deprecated_run "${ARGS[@]}"
