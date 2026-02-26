#!/usr/bin/env bash
set -euo pipefail

detect_lan_ip() {
  local ip=""
  local iface=""

  if [ -n "${NETWORK_INTERFACE:-}" ]; then
    ip="$(ipconfig getifaddr "${NETWORK_INTERFACE}" 2>/dev/null || true)"
    if [ -n "${ip}" ]; then
      echo "${ip}"
      return 0
    fi
  fi

  for iface in en0 en1; do
    ip="$(ipconfig getifaddr "${iface}" 2>/dev/null || true)"
    if [ -n "${ip}" ]; then
      echo "${ip}"
      return 0
    fi
  done

  iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}' | head -n 1)"
  if [ -n "${iface}" ]; then
    ip="$(ipconfig getifaddr "${iface}" 2>/dev/null || true)"
    if [ -n "${ip}" ]; then
      echo "${ip}"
      return 0
    fi
  fi

  return 1
}

LAN_IP="$(detect_lan_ip || true)"
if [ -z "${LAN_IP}" ]; then
  echo "[dev-lan] Could not detect LAN IP. Set NETWORK_INTERFACE=en0 (or en1) and retry." >&2
  exit 1
fi

API_BASE_URL="http://${LAN_IP}:3000"
GRAPHQL_URL="${API_BASE_URL}/api/graphql"
WEB_URL="http://${LAN_IP}:3001"

export HOST=0.0.0.0
export KEYSTONE_GRAPHQL_URL="${GRAPHQL_URL}"
export NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL="${GRAPHQL_URL}"
export NEXT_PUBLIC_WEB_URL="${WEB_URL}"
export EXPO_PUBLIC_API_URL="${API_BASE_URL}"
export EXPO_PUBLIC_QR_URL="http://${LAN_IP}:19000"

echo "[dev-lan] LAN IP: ${LAN_IP}"
echo "[dev-lan] KEYSTONE_GRAPHQL_URL=${KEYSTONE_GRAPHQL_URL}"
echo "[dev-lan] EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"

# Regenerate mobile runtime config from exported EXPO_PUBLIC_* variables.
TMP_ENV_FILE="$(mktemp)"
cat > "${TMP_ENV_FILE}" <<EOF
EXPO_PUBLIC_ENV=${EXPO_PUBLIC_ENV:-development}
EXPO_PUBLIC_DEVICE_ID=${EXPO_PUBLIC_DEVICE_ID:-Kiosk001}
EXPO_PUBLIC_CLEAN=${EXPO_PUBLIC_CLEAN:-false}
EXPO_PUBLIC_SEED=${EXPO_PUBLIC_SEED:-false}
EXPO_PUBLIC_KEEP_AWAKE=${EXPO_PUBLIC_KEEP_AWAKE:-false}
EXPO_PUBLIC_KEEP_AWAKE_FROM=${EXPO_PUBLIC_KEEP_AWAKE_FROM:-9:00}
EXPO_PUBLIC_KEEP_AWAKE_TO=${EXPO_PUBLIC_KEEP_AWAKE_TO:-18:00}
EXPO_PUBLIC_DIM_SCREEN=${EXPO_PUBLIC_DIM_SCREEN:-false}
EXPO_PUBLIC_DIM_TIMEOUT=${EXPO_PUBLIC_DIM_TIMEOUT:-1}
EXPO_PUBLIC_DIM_TO=${EXPO_PUBLIC_DIM_TO:-0.2}
EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
EXPO_PUBLIC_QR_URL=${EXPO_PUBLIC_QR_URL}
EXPO_PUBLIC_PIN_EMAIL=${EXPO_PUBLIC_PIN_EMAIL:-}
EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_ID=${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_ID:-11111111-1111-4111-8111-111111111111}
EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_NAME=${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_NAME:-Super Admin}
EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PHONE=${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PHONE:-521999999999}
EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PIN=${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PIN:-1234}
EXPO_PUBLIC_TIMEOUT=${EXPO_PUBLIC_TIMEOUT:-15000}
EXPO_PUBLIC_SENTRY_DSN=${EXPO_PUBLIC_SENTRY_DSN:-}
EXPO_PUBLIC_SENTRY_ENABLED=${EXPO_PUBLIC_SENTRY_ENABLED:-true}
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=${EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:-0.2}
EOF

bash ./apps/mobile/scripts/env-to-config.sh "${TMP_ENV_FILE}"
rm -f "${TMP_ENV_FILE}"

exec pnpm dev
