#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTS_FILE="${PORTS_FILE:-$ROOT_DIR/apps/service-ports.conf}"
CERTBOT_BIN="${CERTBOT_BIN:-certbot}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@taku.lat}"
CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"
CERT_ROOT="${CERT_ROOT:-/etc/letsencrypt/live}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
SITES_AVAILABLE_DIR="${SITES_AVAILABLE_DIR:-$NGINX_DIR/sites-available}"
SITES_ENABLED_DIR="${SITES_ENABLED_DIR:-$NGINX_DIR/sites-enabled}"
NGINX_BIN="${NGINX_BIN:-nginx}"

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

certbot_args=(certonly --webroot -w "$CERTBOT_WEBROOT")

if [ "${CERTBOT_NON_INTERACTIVE:-true}" = "true" ]; then
  certbot_args+=(--non-interactive)
fi

certbot_args+=(--agree-tos --email "$CERTBOT_EMAIL")

remove_broken_enabled_sites() {
  if [ ! -d "$SITES_ENABLED_DIR" ]; then
    return
  fi

  echo "Checking for broken nginx enabled-site symlinks in $SITES_ENABLED_DIR"
  find "$SITES_ENABLED_DIR" -xtype l -print -delete
}

reload_nginx() {
  remove_broken_enabled_sites
  "$NGINX_BIN" -t

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet nginx; then
      systemctl reload nginx
    else
      systemctl start nginx
    fi
  else
    "$NGINX_BIN" -s reload
  fi
}

disable_final_ssl_site() {
  service="$1"
  site_file="${service}_SITE.conf"
  enabled_file="$SITES_ENABLED_DIR/$site_file"

  if [ -e "$enabled_file" ] || [ -L "$enabled_file" ]; then
    echo "Disabling final SSL nginx site while certificate is missing: $enabled_file"
    rm -f "$enabled_file"
  fi
}

install_acme_site() {
  service="$1"
  domain="$2"
  port="$3"
  site_file="${service}_ACME.conf"
  available_file="$SITES_AVAILABLE_DIR/$site_file"
  enabled_file="$SITES_ENABLED_DIR/$site_file"

  mkdir -p "$CERTBOT_WEBROOT/.well-known/acme-challenge"
  mkdir -p "$SITES_AVAILABLE_DIR" "$SITES_ENABLED_DIR"

  cat > "$available_file" <<EOF
server {
    listen 80;
    server_name $domain;

    location /.well-known/acme-challenge/ {
        root $CERTBOT_WEBROOT;
    }

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  ln -sfn "$available_file" "$enabled_file"
  echo "Installed temporary ACME nginx site for $domain: $enabled_file -> $available_file"
}

print_domain_debug() {
  domain="$1"
  echo "DNS/HTTP debug for $domain"
  if command -v getent >/dev/null 2>&1; then
    getent hosts "$domain" || true
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -I --max-time 10 "http://$domain/.well-known/acme-challenge/taku-certbot-probe" || true
  fi
}

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
  disable_final_ssl_site "$service"
  install_acme_site "$service" "$domain" "$port"
  reload_nginx
  print_domain_debug "$domain"
  "$CERTBOT_BIN" "${certbot_args[@]}" -d "$domain"
done

if [ "$missing_count" -eq 0 ]; then
  echo "All TAKU service certificates already exist."
else
  echo "Created $missing_count TAKU service certificate(s)."
fi
