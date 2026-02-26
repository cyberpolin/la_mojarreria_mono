#!/usr/bin/env bash
set -euo pipefail

PIDS=()

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 0.3
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done

  # Give child processes a moment to exit gracefully.
  sleep 0.4

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  wait || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

free_port 3000
free_port 3001

pnpm --filter @mojarreria/api dev &
PIDS+=("$!")

pnpm --filter @mojarreria/web dev &
PIDS+=("$!")

if [ "${OPEN_MOBILE_NEW_TERMINAL:-0}" = "1" ] && command -v osascript >/dev/null 2>&1; then
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  PNPM_BIN="$(command -v pnpm || true)"
  if [ -n "${PNPM_BIN}" ]; then
    PNPM_CMD="${PNPM_BIN}"
  else
    PNPM_CMD="corepack pnpm"
  fi
  osascript <<EOF >/dev/null
tell application "Terminal"
  activate
  do script "cd \"${ROOT_DIR}\" && ${PNPM_CMD} --filter @mojarreria/mobile start"
end tell
EOF
  echo "[dev] Mobile started in a new Terminal window."
else
  pnpm --filter @mojarreria/mobile start &
  PIDS+=("$!")
fi

# Portable replacement for `wait -n` (not available in macOS bash 3.x).
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" || true
      exit 0
    fi
  done
  sleep 0.3
done
