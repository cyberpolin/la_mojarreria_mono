#!/usr/bin/env bash
set -u

LINES="${LINES:-160}"
OUT_FILE="${OUT_FILE:-/tmp/taku-flow-logs-$(date +%Y%m%d-%H%M%S).log}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || pwd)"
PORTS_FILE="${PORTS_FILE:-$ROOT_DIR/apps/service-ports.conf}"

section() {
  printf '\n===== %s =====\n' "$1"
}

run() {
  printf '\n$ %s\n' "$*"
  "$@" 2>&1 || printf 'command failed with status %s\n' "$?"
}

http_get() {
  local label="$1"
  local url="$2"
  shift 2

  printf '\n--- %s ---\n%s\n' "$label" "$url"
  curl --max-time 8 -fsS "$@" "$url" 2>&1 || printf 'request failed\n'
  printf '\n'
}

load_dotenv_value() {
  local file="$1"
  local key="$2"

  if [ ! -f "$file" ]; then
    return
  fi

  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2-
}

resolve_path() {
  local base="$1"
  local value="$2"

  if [ -z "$value" ]; then
    return
  fi
  case "$value" in
    /*) printf '%s' "$value" ;;
    *) printf '%s/%s' "$base" "$value" ;;
  esac
}

first_existing_dir() {
  local path

  for path in "$@"; do
    if [ -d "$path" ]; then
      printf '%s' "$path"
      return
    fi
  done
}

pm2_cmd() {
  if command -v pm2 >/dev/null 2>&1; then
    printf 'pm2'
    return
  fi
  if command -v pnpm >/dev/null 2>&1; then
    printf 'pnpm dlx pm2@5.4.3'
    return
  fi
  if command -v npx >/dev/null 2>&1; then
    printf 'npx --yes pm2@5.4.3'
    return
  fi
}

print_json_summary() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf 'Data file not found: %s\n' "$file"
    return
  fi
  if ! command -v node >/dev/null 2>&1; then
    printf 'node not found; cannot summarize %s\n' "$file"
    return
  fi

  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const db = JSON.parse(fs.readFileSync(file, "utf8"));
    const pick = (value) => Array.isArray(value) ? value : [];
    const recent = (items, count = 12) =>
      pick(items).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, count);
    console.log(JSON.stringify({
      file,
      counts: {
        workspaces: pick(db.workspaces).length,
        whatsappAccounts: pick(db.whatsappAccounts).length,
        conversations: pick(db.conversations).length,
        messages: pick(db.messages).length,
        botSettings: pick(db.botSettings).length,
        botAssignments: pick(db.botAssignments).length,
        bots: pick(db.bots).length,
        automationDecisionLogs: pick(db.automationDecisionLogs).length,
        automationBlockedContacts: pick(db.automationBlockedContacts).length,
      },
      whatsappAccounts: pick(db.whatsappAccounts).map((item) => ({
        id: item.id,
        displayName: item.displayName,
        phoneNumber: item.phoneNumber,
        status: item.status,
        enabled: item.enabled,
        externalInstanceId: item.externalInstanceId,
        updatedAt: item.updatedAt
      })),
      botSettings: pick(db.botSettings).map((item) => ({
        id: item.id,
        whatsappAccountId: item.whatsappAccountId,
        enabled: item.enabled,
        rulesEnabled: item.rulesEnabled,
        aiEnabled: item.aiEnabled,
        afterHoursEnabled: item.afterHoursEnabled,
        afterHoursResponder: item.afterHoursResponder,
        updatedAt: item.updatedAt
      })),
      botAssignments: pick(db.botAssignments).map((item) => ({
        id: item.id,
        whatsappAccountId: item.whatsappAccountId,
        botId: item.botId,
        enabled: item.enabled,
        mode: item.mode,
        updatedAt: item.updatedAt
      })),
      automationBlockedContacts: pick(db.automationBlockedContacts).map((item) => ({
        id: item.id,
        phoneNumber: item.phoneNumber,
        label: item.label,
        enabled: item.enabled,
        reason: item.reason,
        updatedAt: item.updatedAt
      })),
      bots: pick(db.bots).map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        externalAssistantId: item.externalAssistantId,
        hasClientId: Boolean(item.clientId),
        hasClientToken: Boolean(item.clientToken),
        updatedAt: item.updatedAt
      })),
      recentAutomationDecisions: recent(db.automationDecisionLogs),
      recentMessages: recent(db.messages).map((item) => ({
        id: item.id,
        conversationId: item.conversationId,
        whatsappAccountId: item.whatsappAccountId,
        direction: item.direction,
        status: item.status,
        body: item.body,
        externalMessageId: item.externalMessageId,
        createdAt: item.createdAt
      }))
    }, null, 2));
  ' "$file" 2>&1 || printf 'Could not parse backend data file: %s\n' "$file"
}

main() {
  section "TAKU flow diagnostics"
  printf 'Generated at: %s\n' "$(date -Is)"
  printf 'Host: %s\n' "$(hostname 2>/dev/null || true)"
  printf 'User: %s\n' "$(whoami 2>/dev/null || true)"
  printf 'Root dir: %s\n' "$ROOT_DIR"
  printf 'Output file: %s\n' "$OUT_FILE"
  printf 'Log lines per process: %s\n' "$LINES"

  if [ -f "$PORTS_FILE" ]; then
    # shellcheck disable=SC1090
    . "$PORTS_FILE"
  fi

  local backend_dir wa_dir bot_dir
  backend_dir="$(first_existing_dir \
    "${ROOT_DIR}/taku-backend" \
    "/var/www/taku/taku-backend" \
    "/var/www/taku-backend")"
  wa_dir="$(first_existing_dir \
    "${ROOT_DIR}/apps/wa-service" \
    "/var/www/taku/apps/wa-service" \
    "/var/www/wa-service" \
    "/var/www/la_mojarreria_wa_service")"
  bot_dir="$(first_existing_dir \
    "${ROOT_DIR}/apps/bot-service" \
    "/var/www/taku/apps/bot-service" \
    "/var/www/bot-service")"

  local backend_port="${TAKU_BACKEND_PORT:-3110}"
  local wa_port="${TAKU_WA_SERVICE_PORT:-3130}"
  local bot_port="${TAKU_BOT_SERVICE_PORT:-3140}"
  local backend_domain="${TAKU_BACKEND_DOMAIN:-api.taku.lat}"
  local wa_domain="${TAKU_WA_SERVICE_DOMAIN:-api.wa.taku.lat}"
  local bot_domain="${TAKU_BOT_SERVICE_DOMAIN:-api.bot.taku.lat}"

  section "Service paths"
  printf 'backend_dir=%s\n' "${backend_dir:-missing}"
  printf 'wa_dir=%s\n' "${wa_dir:-missing}"
  printf 'bot_dir=%s\n' "${bot_dir:-missing}"

  section "Ports and listeners"
  run ss -ltnp

  section "PM2 status"
  local pm2
  pm2="$(pm2_cmd || true)"
  if [ -n "$pm2" ]; then
    run $pm2 status
  else
    printf 'pm2 command not available\n'
  fi

  section "Health checks"
  http_get "TAKU backend local health" "http://127.0.0.1:${backend_port}/api/health"
  http_get "TAKU backend local ready" "http://127.0.0.1:${backend_port}/api/health/ready"
  http_get "WA Service local health" "http://127.0.0.1:${wa_port}/health"
  http_get "Bot Service local health" "http://127.0.0.1:${bot_port}/health"
  http_get "TAKU backend public root" "https://${backend_domain}/"
  http_get "WA Service public health" "https://${wa_domain}/health"
  http_get "Bot Service public health" "https://${bot_domain}/health"

  section "Runtime debug endpoints"
  http_get "WA debug logs recent" "http://127.0.0.1:${wa_port}/debug/logs/recent"
  http_get "WA received messages recent" "http://127.0.0.1:${wa_port}/debug/received-messages/recent"
  http_get "Bot debug logs recent" "http://127.0.0.1:${bot_port}/debug/logs/recent"

  if [ -n "${TAKU_SESSION_TOKEN:-}" ]; then
    section "TAKU backend automation decisions by API"
    http_get "Automation decisions" \
      "http://127.0.0.1:${backend_port}/api/automation-decisions?limit=25" \
      -H "x-session-token: ${TAKU_SESSION_TOKEN}"
  else
    section "TAKU backend automation decisions by data file"
    local backend_env backend_data_file resolved_backend_data_file
    backend_env="${backend_dir:-}/.env"
    backend_data_file="$(load_dotenv_value "$backend_env" "TAKU_BACKEND_DATA_FILE")"
    resolved_backend_data_file="$(resolve_path "${backend_dir:-}" "${backend_data_file:-./data/taku-backend.json}")"
    print_json_summary "$resolved_backend_data_file"
    printf '\nTip: set TAKU_SESSION_TOKEN to query /api/automation-decisions through the API.\n'
  fi

  section "PM2 recent logs"
  if [ -n "$pm2" ]; then
    run $pm2 logs taku-backend --lines "$LINES" --nostream
    run $pm2 logs mojarreria-wa-service --lines "$LINES" --nostream
    run $pm2 logs mojarreria-bot-service --lines "$LINES" --nostream
  fi

  section "Log files on disk"
  run ls -lah "$HOME/.pm2/logs"
  run find "$HOME/.pm2/logs" -maxdepth 1 -type f -name '*taku*' -o -name '*mojarreria*'

  section "Nginx quick check"
  run nginx -t
  run ls -lah /etc/nginx/sites-enabled
}

main 2>&1 | tee "$OUT_FILE"
