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
  cd "$ROOT_DIR/apps/bot-service"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/apps/bot-service/.env"
  warn_if_empty "BOT_SERVICE_API_KEY"
  warn_if_empty "DEEPSEEK_API_KEY"
  pnpm dev
) &

(
  cd "$ROOT_DIR/apps/taku-bot-web"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/apps/taku-bot-web/.env"
  warn_if_empty "TAKU_BOT_API_KEY"
  pnpm dev
) &

echo "[taku-bot] Services starting:"
echo "  Bot Service: http://localhost:3002"
echo "  TAKU Bot Web: http://localhost:3005"
echo "[taku-bot] Press Ctrl+C to stop all services."

wait
