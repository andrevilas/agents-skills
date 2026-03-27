#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-skill.sh --agent <codex|antigravity> --skill <name> [--dest <dir>] [--force]

Environment overrides:
  CODEX_SKILLS_DIR
  ANTIGRAVITY_SKILLS_DIR
EOF
}

AGENT=""
SKILL=""
DEST=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)
      AGENT="${2:-}"
      shift 2
      ;;
    --skill)
      SKILL="${2:-}"
      shift 2
      ;;
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

if [[ -z "$AGENT" || -z "$SKILL" ]]; then
  usage >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/skills/$SKILL/targets/$AGENT/$SKILL"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Skill target not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ -z "$DEST" ]]; then
  case "$AGENT" in
    codex)
      DEST="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"
      ;;
    antigravity)
      DEST="${ANTIGRAVITY_SKILLS_DIR:-$HOME/.antigravity/skills}"
      ;;
    *)
      echo "Unsupported agent: $AGENT" >&2
      exit 1
      ;;
  esac
fi

TARGET_DIR="$DEST/$SKILL"
mkdir -p "$DEST"

if [[ -e "$TARGET_DIR" && "$FORCE" -ne 1 ]]; then
  echo "Target already exists: $TARGET_DIR" >&2
  echo "Use --force to overwrite." >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "Installed $SKILL for $AGENT at $TARGET_DIR"
