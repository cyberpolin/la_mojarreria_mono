#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"
MONOREPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
SHARED_NODE_MODULES_DIR="$MONOREPO_ROOT/node_modules"

# This cleanup is only needed for local monorepo development to prevent
# duplicate React/Next module copies under apps/api/node_modules.
# In CI/production (Railway), Keystone needs these local deps available.
if [ "${NODE_ENV:-}" = "production" ] || [ -n "${CI:-}" ] || [ -n "${RAILWAY_ENVIRONMENT:-}" ]; then
  echo "[normalize-deps] skipped (CI/production environment)"
  exit 0
fi

remove_if_real_dir() {
  local target="$1"
  local shared_target="$2"
  if [ ! -e "$shared_target" ]; then
    echo "[normalize-deps] skip ${target#$ROOT_DIR/} (no shared package at ${shared_target#$MONOREPO_ROOT/})"
    return
  fi
  if [ -d "$target" ] && [ ! -L "$target" ]; then
    rm -rf "$target"
    echo "[normalize-deps] removed copied package: ${target#$ROOT_DIR/}"
  fi
}

remove_if_real_dir "$NODE_MODULES_DIR/react" "$SHARED_NODE_MODULES_DIR/react"
remove_if_real_dir "$NODE_MODULES_DIR/react-dom" "$SHARED_NODE_MODULES_DIR/react-dom"
remove_if_real_dir "$NODE_MODULES_DIR/next" "$SHARED_NODE_MODULES_DIR/next"
remove_if_real_dir "$NODE_MODULES_DIR/styled-jsx" "$SHARED_NODE_MODULES_DIR/styled-jsx"
remove_if_real_dir "$NODE_MODULES_DIR/@next" "$SHARED_NODE_MODULES_DIR/@next"
