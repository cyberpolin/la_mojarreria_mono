#!/usr/bin/env bash

TAKU_SERVICE_NAMES=(
  "TAKU_WEB"
  "TAKU_BACKEND"
  "TAKU_WA_WEB"
  "TAKU_WA_SERVICE"
  "TAKU_BOT_SERVICE"
  "TAKU_BOT_WEB"
)

taku_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

taku_load_service_ports() {
  local root_dir="${1:-$(taku_repo_root)}"
  local ports_file="${PORTS_FILE:-$root_dir/apps/service-ports.conf}"

  if [ ! -f "$ports_file" ]; then
    echo "Missing service config: $ports_file" >&2
    return 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ports_file"
  set +a
}

taku_service_value() {
  local service="$1"
  local suffix="$2"
  local var_name="${service}_${suffix}"

  printf '%s' "${!var_name:-}"
}

taku_service_site_file() {
  local service="$1"

  printf '%s_SITE.conf' "$service"
}

taku_service_repo_path() {
  local root_dir="$1"
  local service="$2"
  local service_path

  service_path="$(taku_service_value "$service" "PATH")"
  if [ -z "$service_path" ]; then
    return 1
  fi

  printf '%s/%s' "$root_dir" "${service_path#/}"
}
