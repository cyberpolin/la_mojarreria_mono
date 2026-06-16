#!/usr/bin/env bash
set -euo pipefail

PIDS=()

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done

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

echo "[taku] Starting TAKU API Service on port 3010"
pnpm --filter @taku/api-service dev &
PIDS+=("$!")

echo "[taku] Starting WA Service"
pnpm --filter @mojarreria/wa-service dev &
PIDS+=("$!")

echo "[taku] Starting Bot Service on port 3002"
pnpm --filter @mojarreria/bot-service dev &
PIDS+=("$!")

echo "[taku] Starting TAKU Web on port 3003"
pnpm --filter @taku/web dev &
PIDS+=("$!")

echo "[taku] Services starting:"
echo "  TAKU API: http://localhost:3010"
echo "  WA Service: check apps/wa-service/.env port"
echo "  Bot Service: http://localhost:3002"
echo "  TAKU Web: http://localhost:3003"
echo "[taku] Press Ctrl+C to stop all services."

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
