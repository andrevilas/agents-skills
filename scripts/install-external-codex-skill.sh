#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  install-external-codex-skill.sh <skill-name> [--dest <dir>] [--force]

Installs an external Codex skill bundle from:
  external/<skill-name>/codex/<skill-name>/

Default destination:
  ${CODEX_SKILLS_DIR:-$HOME/.codex/skills}
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

SKILL="$1"
shift
DEST="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)
      DEST="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SOURCE_DIR="$REPO_ROOT/external/$SKILL/codex/$SKILL"
TARGET_DIR="$DEST/$SKILL"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "External Codex bundle not found for $SKILL: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/SKILL.md" ]]; then
  echo "Invalid external bundle for $SKILL: missing SKILL.md" >&2
  exit 1
fi

mkdir -p "$DEST"

if [[ -e "$TARGET_DIR" && "$FORCE" -ne 1 ]]; then
  echo "Target already exists: $TARGET_DIR" >&2
  echo "Use --force to overwrite." >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "Installed external Codex skill $SKILL at $TARGET_DIR"
