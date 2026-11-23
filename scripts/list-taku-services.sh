#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/taku-service-helpers.sh
. "$ROOT_DIR/scripts/taku-service-helpers.sh"

taku_load_service_ports "$ROOT_DIR"

printf '%-18s %-24s %-8s %s\n' "SERVICE" "DOMAIN" "PORT" "PATH"
printf '%-18s %-24s %-8s %s\n' "-------" "------" "----" "----"

while IFS= read -r service; do
  printf '%-18s %-24s %-8s %s\n' \
    "$service" \
    "$(taku_service_value "$service" "DOMAIN")" \
    "$(taku_service_value "$service" "PORT")" \
    "$(taku_service_value "$service" "PATH")"
done < <(taku_selected_services)
