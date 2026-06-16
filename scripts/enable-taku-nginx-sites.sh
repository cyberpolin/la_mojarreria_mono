#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
SITES_AVAILABLE_DIR="${SITES_AVAILABLE_DIR:-$NGINX_DIR/sites-available}"
SITES_ENABLED_DIR="${SITES_ENABLED_DIR:-$NGINX_DIR/sites-enabled}"
NGINX_BIN="${NGINX_BIN:-nginx}"
NGINX_TEST="${NGINX_TEST:-true}"
NGINX_RELOAD="${NGINX_RELOAD:-true}"
DEBUG="${DEBUG:-true}"

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

log_debug() {
  if [ "$DEBUG" = "true" ]; then
    echo "[nginx-sites] $*"
  fi
}

list_dir() {
  dir="$1"
  if [ "$DEBUG" != "true" ]; then
    return
  fi

  echo "[nginx-sites] Listing $dir"
  if [ -d "$dir" ]; then
    "${SUDO[@]}" ls -la "$dir"
  else
    echo "[nginx-sites] $dir does not exist"
  fi
}

assert_installed_site() {
  site_file="$1"
  available_file="$SITES_AVAILABLE_DIR/$site_file"
  enabled_file="$SITES_ENABLED_DIR/$site_file"

  if ! "${SUDO[@]}" test -f "$available_file"; then
    echo "Expected installed nginx site file is missing: $available_file" >&2
    exit 1
  fi

  if ! "${SUDO[@]}" test -L "$enabled_file"; then
    echo "Expected enabled nginx site symlink is missing: $enabled_file" >&2
    exit 1
  fi

  symlink_target="$("${SUDO[@]}" readlink "$enabled_file")"
  if [ "$symlink_target" != "$available_file" ]; then
    echo "Enabled nginx site symlink points to $symlink_target, expected $available_file" >&2
    exit 1
  fi
}

log_debug "Running as user: $(id)"
log_debug "Repo root: $ROOT_DIR"
log_debug "NGINX_DIR: $NGINX_DIR"
log_debug "SITES_AVAILABLE_DIR: $SITES_AVAILABLE_DIR"
log_debug "SITES_ENABLED_DIR: $SITES_ENABLED_DIR"
log_debug "NGINX_BIN: $NGINX_BIN"
log_debug "NGINX_TEST: $NGINX_TEST"
log_debug "NGINX_RELOAD: $NGINX_RELOAD"
log_debug "Source site configs:"
for site_file in "${site_files[@]}"; do
  if [ -f "$ROOT_DIR/apps/$site_file" ]; then
    log_debug "  found $ROOT_DIR/apps/$site_file"
  else
    log_debug "  missing $ROOT_DIR/apps/$site_file"
  fi
done

if [ -f "$NGINX_DIR/nginx.conf" ]; then
  log_debug "nginx.conf include lines:"
  "${SUDO[@]}" grep -n "sites-enabled\|conf.d\|include" "$NGINX_DIR/nginx.conf" || true
else
  log_debug "$NGINX_DIR/nginx.conf does not exist"
fi

list_dir "$NGINX_DIR"
list_dir "$SITES_AVAILABLE_DIR"
list_dir "$SITES_ENABLED_DIR"

"${SUDO[@]}" mkdir -p "$SITES_AVAILABLE_DIR" "$SITES_ENABLED_DIR"

for site_file in "${site_files[@]}"; do
  source_file="$ROOT_DIR/apps/$site_file"
  available_file="$SITES_AVAILABLE_DIR/$site_file"
  enabled_file="$SITES_ENABLED_DIR/$site_file"
  acme_site_file="${site_file%_SITE.conf}_ACME.conf"
  acme_available_file="$SITES_AVAILABLE_DIR/$acme_site_file"
  acme_enabled_file="$SITES_ENABLED_DIR/$acme_site_file"

  log_debug "Processing $site_file"
  log_debug "  source: $source_file"
  log_debug "  available: $available_file"
  log_debug "  enabled: $enabled_file"

  if [ ! -f "$source_file" ]; then
    echo "Missing nginx site config: $source_file" >&2
    exit 1
  fi

  if [ -e "$acme_enabled_file" ] || [ -L "$acme_enabled_file" ]; then
    echo "Removing temporary ACME enabled site $acme_enabled_file"
    "${SUDO[@]}" rm -f "$acme_enabled_file"
  fi

  if [ -e "$acme_available_file" ]; then
    echo "Removing temporary ACME available site $acme_available_file"
    "${SUDO[@]}" rm -f "$acme_available_file"
  fi

  if [ -e "$available_file" ] && ! cmp -s "$source_file" "$available_file"; then
    backup_file="$available_file.$(date +%Y%m%d%H%M%S).bak"
    echo "Backing up existing $available_file to $backup_file"
    "${SUDO[@]}" cp "$available_file" "$backup_file"
  fi

  echo "Installing $site_file into $SITES_AVAILABLE_DIR"
  "${SUDO[@]}" install -m 0644 "$source_file" "$available_file"
  log_debug "Installed file details:"
  "${SUDO[@]}" ls -la "$available_file"

  if [ -e "$enabled_file" ] && [ ! -L "$enabled_file" ]; then
    backup_file="$enabled_file.$(date +%Y%m%d%H%M%S).bak"
    echo "Backing up existing enabled file $enabled_file to $backup_file"
    "${SUDO[@]}" mv "$enabled_file" "$backup_file"
  fi

  echo "Enabling $site_file"
  "${SUDO[@]}" ln -sfn "$available_file" "$enabled_file"
  log_debug "Enabled symlink details:"
  "${SUDO[@]}" ls -la "$enabled_file"
done

list_dir "$SITES_AVAILABLE_DIR"
list_dir "$SITES_ENABLED_DIR"

echo "Verifying nginx site installation"
for site_file in "${site_files[@]}"; do
  assert_installed_site "$site_file"
done
echo "Verified ${#site_files[@]} nginx site file(s) in $SITES_AVAILABLE_DIR and $SITES_ENABLED_DIR"

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
