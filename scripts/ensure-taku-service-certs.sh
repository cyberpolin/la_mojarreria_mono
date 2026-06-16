#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTS_FILE="${PORTS_FILE:-$ROOT_DIR/apps/service-ports.conf}"
CERTBOT_BIN="${CERTBOT_BIN:-certbot}"
CERTBOT_AUTHENTICATOR="${CERTBOT_AUTHENTICATOR:-standalone}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@taku.lat}"
CERTBOT_MANAGE_NGINX="${CERTBOT_MANAGE_NGINX:-true}"
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

certbot_args=(certonly "--$CERTBOT_AUTHENTICATOR")

if [ "${CERTBOT_NON_INTERACTIVE:-true}" = "true" ]; then
  certbot_args+=(--non-interactive)
fi

certbot_args+=(--agree-tos --email "$CERTBOT_EMAIL")

missing_count=0
nginx_stopped=false

restart_nginx_if_needed() {
  if [ "$nginx_stopped" = "true" ] && command -v systemctl >/dev/null 2>&1; then
    echo "Starting nginx after certificate issuance"
    systemctl start nginx
  fi
}

trap restart_nginx_if_needed EXIT

stop_nginx_for_standalone_if_needed() {
  if [ "$CERTBOT_AUTHENTICATOR" != "standalone" ]; then
    return
  fi

  if [ "$CERTBOT_MANAGE_NGINX" != "true" ]; then
    return
  fi

  if [ "$nginx_stopped" = "true" ]; then
    return
  fi

  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
    echo "Stopping nginx so Certbot standalone can bind port 80"
    systemctl stop nginx
    nginx_stopped=true
  fi
}

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
  stop_nginx_for_standalone_if_needed
  "$CERTBOT_BIN" "${certbot_args[@]}" -d "$domain"
done

if [ "$missing_count" -eq 0 ]; then
  echo "All TAKU service certificates already exist."
else
  echo "Created $missing_count TAKU service certificate(s)."
fi
