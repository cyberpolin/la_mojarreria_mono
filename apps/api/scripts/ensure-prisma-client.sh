#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_INDEX="$ROOT_DIR/node_modules/.prisma/client/index.js"

if [ -f "$CLIENT_INDEX" ]; then
  echo "[ensure-prisma-client] Prisma client already present"
  exit 0
fi

echo "[ensure-prisma-client] Prisma client missing, generating..."
cd "$ROOT_DIR"
env -u DATABASE_URL -u SHADOW_DATABASE_URL pnpm exec prisma generate --schema=./schema.prisma
