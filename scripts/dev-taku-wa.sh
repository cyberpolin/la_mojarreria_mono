#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    echo "Loading env: $env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  else
    echo "Env file not found: $env_file"
  fi
}

warn_if_empty() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Warning: $name is not configured"
  fi
}

cleanup() {
  local pid
  for pid in $(jobs -pr); do
    kill "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

(
  cd "$ROOT_DIR/apps/wa-service"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/apps/taku-wa-web-service/.env"
  load_env_file "$ROOT_DIR/apps/wa-service/.env"
  warn_if_empty "MERCADOPAGO_ACCESS_TOKEN"
  pnpm dev
) &

(
  cd "$ROOT_DIR/apps/taku-wa-web-service"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/apps/taku-wa-web-service/.env"
  pnpm dev
) &

wait
