#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTS_FILE="${PORTS_FILE:-$ROOT_DIR/apps/service-ports.conf}"
CERTBOT_BIN="${CERTBOT_BIN:-certbot}"
CERT_ROOT="${CERT_ROOT:-/etc/letsencrypt/live}"

if [ ! -f "$PORTS_FILE" ]; then
  echo "Missing service config: $PORTS_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$PORTS_FILE"
set +a

services=(
  "TAKU_API_SERVICE"
  "TAKU_WA_SERVICE"
  "TAKU_BOT_SERVICE"
  "TAKU_WEB_SERVICE"
)

certbot_args=(--nginx)

if [ "${CERTBOT_NON_INTERACTIVE:-true}" = "true" ]; then
  certbot_args+=(--non-interactive)
fi

if [ -n "${CERTBOT_EMAIL:-}" ]; then
  certbot_args+=(--agree-tos --email "$CERTBOT_EMAIL")
fi

missing_count=0

for service in "${services[@]}"; do
  domain_var="${service}_DOMAIN"
  port_var="${service}_PORT"
  domain="${!domain_var:-}"
  port="${!port_var:-}"

  if [ -z "$domain" ]; then
    echo "Skipping $service: $domain_var is not set"
    continue
  fi

  if [ -z "$port" ]; then
    echo "Skipping $service: $port_var is not set"
    continue
  fi

  cert_dir="$CERT_ROOT/$domain"
  fullchain="$cert_dir/fullchain.pem"
  privkey="$cert_dir/privkey.pem"

  if [ -f "$fullchain" ] && [ -f "$privkey" ]; then
    echo "Certificate exists for $domain ($service)"
    continue
  fi

  missing_count=$((missing_count + 1))
  echo "Creating certificate for $domain ($service on port $port)"
  "$CERTBOT_BIN" "${certbot_args[@]}" -d "$domain"
done

if [ "$missing_count" -eq 0 ]; then
  echo "All TAKU service certificates already exist."
else
  echo "Created $missing_count TAKU service certificate(s)."
fi
