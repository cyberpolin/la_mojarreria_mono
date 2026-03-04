#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

NODE_ENV_VALUE="${NODE_ENV:-development}"

if [[ "$NODE_ENV_VALUE" == "production" || "$NODE_ENV_VALUE" == "prod" ]]; then
  echo "[seed] NODE_ENV=$NODE_ENV_VALUE -> running production seed"
  bash ./scripts/run-seed-prod.sh
else
  echo "[seed] NODE_ENV=$NODE_ENV_VALUE -> running development seed"
  bash ./scripts/run-seed-dev.sh
fi
