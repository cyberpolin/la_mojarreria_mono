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

cleanup() {
  local exit_code=$?
  local pid
  trap - EXIT INT TERM

  for pid in $(jobs -pr); do
    kill "$pid" 2>/dev/null || true
  done

  wait || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

(
  cd "$ROOT_DIR/taku-backend"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/taku-backend/.env"
  pnpm dev
) &

(
  cd "$ROOT_DIR/apps/taku-site"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/apps/taku-site/.env"
  load_env_file "$ROOT_DIR/apps/taku-site/.env.local"
  pnpm dev
) &

echo "[taku-main] Services starting:"
echo "  TAKU Backend: http://localhost:4000/api"
echo "  TAKU Site: http://localhost:3006"
echo "[taku-main] Press Ctrl+C to stop all services."

wait
