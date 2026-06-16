#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
SITES_AVAILABLE_DIR="${SITES_AVAILABLE_DIR:-$NGINX_DIR/sites-available}"
SITES_ENABLED_DIR="${SITES_ENABLED_DIR:-$NGINX_DIR/sites-enabled}"
NGINX_BIN="${NGINX_BIN:-nginx}"
NGINX_TEST="${NGINX_TEST:-true}"
NGINX_RELOAD="${NGINX_RELOAD:-true}"

site_files=(
  "TAKU_API_SERVICE_SITE.conf"
  "TAKU_WA_SERVICE_SITE.conf"
  "TAKU_BOT_SERVICE_SITE.conf"
  "TAKU_WEB_SERVICE_SITE.conf"
)

if [ "$(id -u)" -eq 0 ]; then
  SUDO=()
elif command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  echo "This script needs permission to write to $NGINX_DIR, and sudo is unavailable." >&2
  exit 1
fi

"${SUDO[@]}" mkdir -p "$SITES_AVAILABLE_DIR" "$SITES_ENABLED_DIR"

for site_file in "${site_files[@]}"; do
  source_file="$ROOT_DIR/apps/$site_file"
  available_file="$SITES_AVAILABLE_DIR/$site_file"
  enabled_file="$SITES_ENABLED_DIR/$site_file"

  if [ ! -f "$source_file" ]; then
    echo "Missing nginx site config: $source_file" >&2
    exit 1
  fi

  if [ -e "$available_file" ] && ! cmp -s "$source_file" "$available_file"; then
    backup_file="$available_file.$(date +%Y%m%d%H%M%S).bak"
    echo "Backing up existing $available_file to $backup_file"
    "${SUDO[@]}" cp "$available_file" "$backup_file"
  fi

  echo "Installing $site_file into $SITES_AVAILABLE_DIR"
  "${SUDO[@]}" install -m 0644 "$source_file" "$available_file"

  if [ -e "$enabled_file" ] && [ ! -L "$enabled_file" ]; then
    backup_file="$enabled_file.$(date +%Y%m%d%H%M%S).bak"
    echo "Backing up existing enabled file $enabled_file to $backup_file"
    "${SUDO[@]}" mv "$enabled_file" "$backup_file"
  fi

  echo "Enabling $site_file"
  "${SUDO[@]}" ln -sfn "$available_file" "$enabled_file"
done

if [ "$NGINX_TEST" = "true" ]; then
  echo "Testing nginx configuration"
  "${SUDO[@]}" "$NGINX_BIN" -t
else
  echo "Skipping nginx test because NGINX_TEST=$NGINX_TEST"
fi

if [ "$NGINX_RELOAD" = "true" ] && [ "$NGINX_TEST" = "true" ]; then
  if command -v systemctl >/dev/null 2>&1; then
    echo "Reloading nginx with systemctl"
    "${SUDO[@]}" systemctl reload nginx
  else
    echo "Reloading nginx with nginx -s reload"
    "${SUDO[@]}" "$NGINX_BIN" -s reload
  fi
elif [ "$NGINX_RELOAD" = "true" ]; then
  echo "Skipping nginx reload because NGINX_TEST=$NGINX_TEST"
else
  echo "Skipping nginx reload because NGINX_RELOAD=$NGINX_RELOAD"
fi
