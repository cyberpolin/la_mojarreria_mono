# TAKU Service Pair Env Status Standard

Every TAKU service pair must expose a complete environment status screen from
the web app and a protected runtime status endpoint from the backing service.

Current service pairs:

- WA solution: `wa-service` + `taku-wa-web-service`
- BOT solution: `bot-service` + `taku-web-bot`

## Required Web Route

Each web app must provide:

```text
/status
```

The status page must show:

- Public health check result.
- Backend runtime status result.
- Web app environment variables.
- Backing service environment variables.
- Expected production domains and API targets.
- Last check timestamp.
- Clear `OK` / `Missing` state per required variable.

Secrets must never be printed raw. Show only configured/missing or a masked
value such as `abcd...wxyz`.

## Required Web API Proxies

Each web app must provide same-origin API routes for status checks so browser
CORS and secret handling stay predictable.

Required shape:

```text
GET /api/status/env
GET /api/<service>/runtime
GET /api/<service>/health
```

Examples:

- `taku-wa-web-service`: `/api/taku/runtime`, `/api/wa/health`, or existing
  equivalent routes.
- `taku-web-bot`: `/api/status/env`, `/api/bot/runtime`, `/api/bot/health`.

The web runtime proxy must send the service API key from server-side env. The
browser must not receive service API keys.

## Required Service Endpoint

Each backing service must provide:

```text
GET /v1/runtime/status
```

This endpoint must be authenticated with that service's API key or a dedicated
status password. It must return:

```json
{
  "ok": true,
  "service": "service-name",
  "checkedAt": "2026-07-03T00:00:00.000Z",
  "runtime": {},
  "variables": [
    {
      "name": "VARIABLE_NAME",
      "configured": true,
      "required": true,
      "value": "non-secret-value",
      "maskedValue": "secr...alue"
    }
  ]
}
```

Use `value` only for non-secret values like URLs, ports, file paths, model
names, domains, and currency codes. Use `maskedValue` for API keys, passwords,
tokens, and secrets.

## Minimum WA Solution Variables

`taku-wa-web-service` should track:

- `NEXT_PUBLIC_TAKU_WA_API_BASE_URL`
- `NEXT_PUBLIC_TAKU_WA_HEALTH_URL`
- `NEXT_PUBLIC_TAKU_API_KEY`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- Any status password used to unlock protected runtime data.

`wa-service` should track:

- `SERVICE_API_KEY`
- `SERVICE_ALLOWED_DOMAINS`
- `WA_BROWSER_NAME`
- `WA_BROWSER_PLATFORM`
- `WA_BROWSER_VERSION`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_CURRENCY_ID`
- Data/session file paths used by standalone accounts and connections.

## Minimum BOT Solution Variables

`taku-web-bot` should track:

- `TAKU_BOT_API_BASE_URL`
- `TAKU_BOT_API_KEY`
- `TAKU_BOT_SUPERADMIN_EMAIL`
- `TAKU_BOT_SUPERADMIN_PASSWORD`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`

`bot-service` should track:

- `BOT_SERVICE_API_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `BOT_MODELS`
- `BOT_ASSISTANTS_FILE`
- `BOT_PAYMENT_INTENTS_FILE`
- `BOT_USAGE_FILE`
- `BOT_BILLING_ACCOUNTS_FILE`
- `DEEPSEEK_INPUT_CACHE_MISS_USD_PER_1M`
- `DEEPSEEK_OUTPUT_USD_PER_1M`
- `BOT_SERVICE_CHARGE_MARKUP_PERCENT`
- `BOT_FREE_MONTHLY_INCLUDED_USD`
- `BOT_FREE_MARKUP_PERCENT`
- `BOT_ON_DEMAND_MIN_PREPAID_USD`
- `BOT_ON_DEMAND_MARKUP_PERCENT`
- `BOT_HIGH_USAGE_MIN_PREPAID_USD`
- `BOT_HIGH_USAGE_MARKUP_PERCENT`
- `BOT_LOW_BALANCE_WARNING_THRESHOLD_PERCENT`
- `BOT_PROCESSED_MESSAGES_FILE`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_CURRENCY_ID`

## Acceptance Checklist

Before a service pair is considered deployable:

- `/status` loads without requiring browser-held secrets.
- `/status` identifies every missing required env var.
- `/status` masks all secrets.
- The web app can call the backing service runtime endpoint through its own API
  proxy.
- The backing service runtime endpoint rejects unauthenticated requests.
- Production domains shown on the status page match the deployment.
- The pair has been validated with build/typecheck commands.
