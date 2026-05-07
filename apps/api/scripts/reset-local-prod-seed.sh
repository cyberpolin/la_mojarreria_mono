#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "$PWD" != "$API_DIR" ]]; then
  echo "[reset] Please run this from ${API_DIR}"
  exit 1
fi

if [[ -f "${API_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "${API_DIR}/.env"
  set +a
else
  echo "[reset] Missing ${API_DIR}/.env (required)."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[reset] DATABASE_URL is required in ${API_DIR}/.env"
  exit 1
fi

LOCAL_DB_REGEX='^(file:|sqlite:)|localhost|127\.0\.0\.1'
if ! [[ "${DATABASE_URL}" =~ ${LOCAL_DB_REGEX} ]]; then
  echo "[reset] Refusing to reset non-local DATABASE_URL."
  echo "[reset] DATABASE_URL=${DATABASE_URL}"
  exit 1
fi

echo "[reset] Resetting local database and seeding production super admin only..."
npm run migrate:dev:reset
npm run seed:prod
echo "[reset] Done."
