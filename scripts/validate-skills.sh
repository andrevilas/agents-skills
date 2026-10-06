#!/usr/bin/env bash
# DEPRECATED (one release): use `node scripts/skills.mjs check` (design §6.2).
# The old hard-coded behavior assertions now live in catalog/behavior-contracts.json (validator V12).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deprecated.sh"

deprecated_notice validate-skills.sh check "$@"
deprecated_run check "$@"
