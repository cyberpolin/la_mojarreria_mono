#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
OUT_FILE="$ROOT_DIR/constants/config.ts"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

# Export all variables loaded from env file.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

to_bool() {
  local raw="${1:-false}"
  local lowered
  lowered="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$lowered" in
    1|true|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

quote_ts() {
  local raw="${1:-}"
  raw="${raw//\\/\\\\}"
  raw="${raw//\"/\\\"}"
  printf '"%s"' "$raw"
}

ENV_VALUE="${EXPO_PUBLIC_ENV:-development}"
DEVICE_ID="${EXPO_PUBLIC_DEVICE_ID:-Kiosk001}"
CLEAN_VALUE="$(to_bool "${EXPO_PUBLIC_CLEAN:-false}")"
SEED_VALUE="$(to_bool "${EXPO_PUBLIC_SEED:-false}")"
KEEP_AWAKE_VALUE="$(to_bool "${EXPO_PUBLIC_KEEP_AWAKE:-false}")"
KEEP_AWAKE_FROM_VALUE="${EXPO_PUBLIC_KEEP_AWAKE_FROM:-9:00}"
KEEP_AWAKE_TO_VALUE="${EXPO_PUBLIC_KEEP_AWAKE_TO:-18:00}"
DIM_SCREEN_VALUE="$(to_bool "${EXPO_PUBLIC_DIM_SCREEN:-false}")"
DIM_TIMEOUT_VALUE="${EXPO_PUBLIC_DIM_TIMEOUT:-1}"
DIM_TO_VALUE="${EXPO_PUBLIC_DIM_TO:-0.2}"
API_URL_VALUE="${EXPO_PUBLIC_API_URL:-}"
QR_URL_VALUE="${EXPO_PUBLIC_QR_URL:-}"
PIN_EMAIL_VALUE="${EXPO_PUBLIC_PIN_EMAIL:-}"
BOOTSTRAP_TEAM_USER_ID_VALUE="${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_ID:-11111111-1111-4111-8111-111111111111}"
BOOTSTRAP_TEAM_USER_NAME_VALUE="${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_NAME:-Super Admin}"
BOOTSTRAP_TEAM_USER_PHONE_VALUE="${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PHONE:-521999999999}"
BOOTSTRAP_TEAM_USER_PIN_VALUE="${EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PIN:-1234}"
TIMEOUT_VALUE="${EXPO_PUBLIC_TIMEOUT:-15000}"
SENTRY_DSN_VALUE="${EXPO_PUBLIC_SENTRY_DSN:-}"
SENTRY_ENABLED_VALUE="$(to_bool "${EXPO_PUBLIC_SENTRY_ENABLED:-true}")"
SENTRY_TRACES_SAMPLE_RATE_VALUE="${EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:-0.2}"

if ! [[ "$TIMEOUT_VALUE" =~ ^[0-9]+$ ]]; then
  echo "EXPO_PUBLIC_TIMEOUT must be an integer. Got: $TIMEOUT_VALUE" >&2
  exit 1
fi

if ! [[ "$DIM_TO_VALUE" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "EXPO_PUBLIC_DIM_TO must be a number. Got: $DIM_TO_VALUE" >&2
  exit 1
fi

if ! [[ "$SENTRY_TRACES_SAMPLE_RATE_VALUE" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE must be a number. Got: $SENTRY_TRACES_SAMPLE_RATE_VALUE" >&2
  exit 1
fi

cat > "$OUT_FILE" <<EOF
type AppConfig = {
  env: "development" | "prod" | "production";
  deviceId: string;
  clean: boolean;
  seed: boolean;
  keepAwake: {
    enabled: boolean;
    from: string;
    to: string;
  };
  dimScreen: {
    enabled: boolean;
    timeout: string;
    to: number;
  };
  apiUrl: string;
  qrUrl: string;
  pinEmail: string;
  bootstrapTeamUser: {
    userId: string;
    name: string;
    phone: string;
    pin: string;
  };
  timeoutMs: number;
  sentry: {
    dsn: string;
    enabled: boolean;
    tracesSampleRate: number;
  };
};

export const APP_CONFIG: AppConfig = {
  env: $(quote_ts "$ENV_VALUE"),
  deviceId: $(quote_ts "$DEVICE_ID"),
  clean: $CLEAN_VALUE,
  seed: $SEED_VALUE,
  keepAwake: {
    enabled: $KEEP_AWAKE_VALUE,
    from: $(quote_ts "$KEEP_AWAKE_FROM_VALUE"),
    to: $(quote_ts "$KEEP_AWAKE_TO_VALUE"),
  },
  dimScreen: {
    enabled: $DIM_SCREEN_VALUE,
    timeout: $(quote_ts "$DIM_TIMEOUT_VALUE"),
    to: $DIM_TO_VALUE,
  },
  apiUrl: $(quote_ts "$API_URL_VALUE"),
  qrUrl: $(quote_ts "$QR_URL_VALUE"),
  pinEmail: $(quote_ts "$PIN_EMAIL_VALUE"),
  bootstrapTeamUser: {
    userId: $(quote_ts "$BOOTSTRAP_TEAM_USER_ID_VALUE"),
    name: $(quote_ts "$BOOTSTRAP_TEAM_USER_NAME_VALUE"),
    phone: $(quote_ts "$BOOTSTRAP_TEAM_USER_PHONE_VALUE"),
    pin: $(quote_ts "$BOOTSTRAP_TEAM_USER_PIN_VALUE"),
  },
  timeoutMs: $TIMEOUT_VALUE,
  sentry: {
    dsn: $(quote_ts "$SENTRY_DSN_VALUE"),
    enabled: $SENTRY_ENABLED_VALUE,
    tracesSampleRate: $SENTRY_TRACES_SAMPLE_RATE_VALUE,
  },
};
EOF

echo "Generated $OUT_FILE from $ENV_FILE"
