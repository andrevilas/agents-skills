#!/usr/bin/env bash
# Shared helper for the one-release deprecation wrappers (design §6.2, §6.6 step 7).
# Each old scripts/*.sh prints one deprecation line and then runs `node scripts/skills.mjs`.
# Remove this file together with the wrappers one release after the v2 cut-over.

DEPRECATED_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPRECATED_CLI="$DEPRECATED_REPO_ROOT/scripts/skills.mjs"

# deprecated_notice <old-script> <new-command...>
deprecated_notice() {
  local old="$1"
  shift
  echo "DEPRECATED: scripts/$old will be removed in the next release; use: node scripts/skills.mjs $*" >&2
}

# deprecated_run <args...>: runs skills.mjs with the given arguments and returns its exit code.
deprecated_run() {
  if ! command -v node >/dev/null 2>&1; then
    echo "error: node (>= 20) is required: node scripts/skills.mjs" >&2
    return 1
  fi
  node "$DEPRECATED_CLI" "$@"
}

# deprecated_map_skill <id>: prints the v2 skill for a legacy skill id (catalog/legacy-ids.json), else the id itself.
deprecated_map_skill() {
  local id="$1"
  node -e '
    const fs = require("node:fs");
    const [file, id] = process.argv.slice(1);
    let out = id;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      const hit = (data.legacy || []).find((e) => e && e.id === id);
      if (hit && hit.primary) out = hit.primary;
    } catch {}
    process.stdout.write(out);
  ' "$DEPRECATED_REPO_ROOT/catalog/legacy-ids.json" "$id"
}

# deprecated_install_args <old-script> <agent> <skill> [--dest DIR] [--force]
# Builds the skills.mjs install argument list into the DEPRECATED_ARGS array.
deprecated_install_args() {
  local old="$1"
  local agent="$2"
  local skill="$3"
  shift 3
  local mapped
  DEPRECATED_ARGS=(install --agent "$agent")
  if [[ -n "$skill" ]]; then
    mapped="$(deprecated_map_skill "$skill")"
    if [[ "$mapped" != "$skill" ]]; then
      echo "note: legacy skill $skill is now $mapped" >&2
    fi
    DEPRECATED_ARGS+=(--skills "$mapped")
  fi
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dest)
        DEPRECATED_ARGS+=(--dest "${2:-}")
        shift 2
        ;;
      --force)
        # v2 install replaces atomically; --force is no longer needed.
        shift
        ;;
      *)
        DEPRECATED_ARGS+=("$1")
        shift
        ;;
    esac
  done
  deprecated_notice "$old" "${DEPRECATED_ARGS[@]}"
}
