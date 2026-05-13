#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  sync-external-mattpocock-skill.sh <skill-name> --source-repo <path> [--dest <dir>]

Copies a productivity skill from a local clone of mattpocock/skills into this
repository's external Codex bundle area.

Expected source path inside the source repo:
  skills/productivity/<skill-name>/SKILL.md
EOF
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

SKILL="$1"
shift

SOURCE_REPO=""
DEST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-repo)
      SOURCE_REPO="${2:-}"
      shift 2
      ;;
    --dest)
      DEST="${2:-}"
      shift 2
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

if [[ -z "$SOURCE_REPO" ]]; then
  usage >&2
  exit 1
fi

SOURCE_FILE="$SOURCE_REPO/skills/productivity/$SKILL/SKILL.md"
DEST_DIR="${DEST:-$REPO_ROOT/external/$SKILL/codex/$SKILL}"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Source skill not found: $SOURCE_FILE" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$SOURCE_FILE" "$DEST_DIR/SKILL.md"

echo "Synced mattpocock skill $SKILL to $DEST_DIR"
