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
ACME_DEFAULT_SITE="TAKU_ACME_DEFAULT.conf"

if [ ! -f "$PORTS_FILE" ]; then
  echo "Missing service config: $PORTS_FILE" >&2
  exit 1
fi

# shellcheck source=scripts/taku-service-helpers.sh
. "$ROOT_DIR/scripts/taku-service-helpers.sh"
taku_load_service_ports "$ROOT_DIR"

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

print_http_listeners() {
  echo "Listeners on :80 and :443"
  if command -v ss >/dev/null 2>&1; then
    ss -lptn 'sport = :80 or sport = :443' || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:80 -sTCP:LISTEN || true
    lsof -nP -iTCP:443 -sTCP:LISTEN || true
  fi
}

stop_non_nginx_http() {
  print_http_listeners

  pids="$(
    if command -v ss >/dev/null 2>&1; then
      ss -lptn 'sport = :80' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p'
    fi | sort -u
  )"

  for pid in $pids; do
    comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
    case "$comm" in
      nginx | "" ) continue ;;
    esac
    echo "Stopping $comm (pid $pid) so nginx can own port 80"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx
  fi

  print_http_listeners
}

disable_enabled_site() {
  enabled_file="$1"
  if [ -e "$enabled_file" ] || [ -L "$enabled_file" ]; then
    echo "Disabling nginx site: $enabled_file"
    rm -f "$enabled_file"
  fi
}

disable_competing_http_sites() {
  disable_enabled_site "$SITES_ENABLED_DIR/default"
  disable_enabled_site "$SITES_ENABLED_DIR/000-default"
  disable_enabled_site "$SITES_ENABLED_DIR/default.conf"

  while IFS= read -r service; do
    disable_enabled_site "$SITES_ENABLED_DIR/${service}_SITE.conf"
    disable_enabled_site "$SITES_ENABLED_DIR/${service}_ACME.conf"
  done < <(taku_selected_services)
}

install_shared_acme_site() {
  available_file="$SITES_AVAILABLE_DIR/$ACME_DEFAULT_SITE"
  enabled_file="$SITES_ENABLED_DIR/$ACME_DEFAULT_SITE"

  mkdir -p "$CERTBOT_WEBROOT/.well-known/acme-challenge"
  mkdir -p "$SITES_AVAILABLE_DIR" "$SITES_ENABLED_DIR"

  cat > "$available_file" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /.well-known/acme-challenge/ {
        root $CERTBOT_WEBROOT;
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 404;
    }
}
EOF

  ln -sfn "$available_file" "$enabled_file"
  echo "Installed shared ACME default site: $enabled_file -> $available_file"
}

assert_acme_webroot() {
  domain="$1"
  probe="taku-certbot-probe"
  probe_path="$CERTBOT_WEBROOT/.well-known/acme-challenge/$probe"
  printf 'ok\n' > "$probe_path"

  echo "ACME probe via 127.0.0.1 Host=$domain"
  local_body="$(
    curl -fsS --max-time 10 \
      -H "Host: $domain" \
      "http://127.0.0.1/.well-known/acme-challenge/$probe" || true
  )"
  if [ "$local_body" != "ok" ]; then
    echo "Local ACME probe failed for $domain. nginx is not serving $probe_path" >&2
    echo "Probe response: ${local_body:-<empty>}" >&2
    return 1
  fi

  echo "ACME probe via http://$domain"
  public_body="$(
    curl -fsS --max-time 10 \
      "http://$domain/.well-known/acme-challenge/$probe" || true
  )"
  if [ "$public_body" != "ok" ]; then
    echo "Public ACME probe failed for $domain. Skipping local certbot; use CloudCluster Website Management SSL."
    echo "Probe response: ${public_body:-<empty>}"
    return 2
  fi
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

disable_competing_http_sites
install_shared_acme_site
stop_non_nginx_http
reload_nginx

missing_count=0

while IFS= read -r service; do
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
  print_domain_debug "$domain"
  set +e
  assert_acme_webroot "$domain"
  probe_status="$?"
  set -e
  if [ "$probe_status" -eq 2 ]; then
    echo "Leaving $domain on HTTP inside the VPS. Enable Free SSL in CloudCluster Website Management."
    continue
  fi
  if [ "$probe_status" -ne 0 ]; then
    exit "$probe_status"
  fi
  "$CERTBOT_BIN" "${certbot_args[@]}" -d "$domain"
done < <(taku_selected_services)

if [ "$missing_count" -eq 0 ]; then
  echo "All TAKU service certificates already exist."
else
  echo "Created $missing_count TAKU service certificate(s)."
fi
