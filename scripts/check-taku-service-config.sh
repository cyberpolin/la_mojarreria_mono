#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/taku-service-helpers.sh
. "$ROOT_DIR/scripts/taku-service-helpers.sh"

taku_load_service_ports "$ROOT_DIR"

failures=0

record_failure() {
  echo "ERROR: $*" >&2
  failures=$((failures + 1))
}

while IFS= read -r service; do
  domain="$(taku_service_value "$service" "DOMAIN")"
  port="$(taku_service_value "$service" "PORT")"
  service_path="$(taku_service_value "$service" "PATH")"
  repo_path="$(taku_service_repo_path "$ROOT_DIR" "$service" || true)"
  site_file="$(taku_service_site_file "$service")"
  site_path="$ROOT_DIR/apps/$site_file"

  echo "Checking $service"

  if [ -z "$domain" ]; then
    record_failure "$service DOMAIN is missing"
  fi

  case "$port" in
    ''|*[!0-9]*)
      record_failure "$service PORT must be numeric"
      ;;
  esac

  if [ -z "$service_path" ]; then
    record_failure "$service PATH is missing"
  elif [ ! -d "$repo_path" ]; then
    if [ "${TAKU_CREATE_MISSING_SERVICE_PATHS:-false}" = "true" ]; then
      echo "Creating missing $service path for config check: $service_path"
      mkdir -p "$repo_path"
    else
      record_failure "$service path does not exist: $service_path"
    fi
  fi

  if [ ! -f "$site_path" ]; then
    record_failure "$service nginx site config is missing: apps/$site_file"
    continue
  fi

  if [ -n "$domain" ] && ! grep -Eq "server_name[[:space:]]+$domain;" "$site_path"; then
    record_failure "$site_file does not use server_name $domain"
  fi

  if [ -n "$port" ] && ! grep -Eq "proxy_pass[[:space:]]+http://127\\.0\\.0\\.1:$port;" "$site_path"; then
    record_failure "$site_file does not proxy to port $port"
  fi
done < <(taku_selected_services)

if [ "$failures" -ne 0 ]; then
  echo "TAKU service config check failed with $failures issue(s)." >&2
  exit 1
fi

echo "TAKU service config check passed."
