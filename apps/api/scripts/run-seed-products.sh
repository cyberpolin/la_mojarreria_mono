#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

set -a
[ -f ./.env ] && . ./.env
[ -f ./.env.local ] && . ./.env.local
set +a

pnpm run prisma:ensure-client
node ./scripts/seed-products.js
