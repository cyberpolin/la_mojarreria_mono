# TAKU Bot Service

Small bot runtime service. It stores reusable assistants in JSON and uses
DeepSeek to generate customer-relation replies.

## Setup

```bash
pnpm install
cp apps/bot-service/.env.example apps/bot-service/.env
pnpm --filter @mojarreria/bot-service dev
```

Required payment env vars for BOT billing:

```env
BOT_PAYMENT_INTENTS_FILE=./data/payment-intents.json
BOT_USAGE_FILE=./data/usage.json
BOT_BILLING_ACCOUNTS_FILE=./data/billing-accounts.json
DEEPSEEK_INPUT_CACHE_MISS_USD_PER_1M=0.14
DEEPSEEK_OUTPUT_USD_PER_1M=0.28
BOT_SERVICE_CHARGE_MARKUP_PERCENT=20
BOT_FREE_MONTHLY_INCLUDED_USD=2
BOT_FREE_MARKUP_PERCENT=20
BOT_ON_DEMAND_MIN_PREPAID_USD=5
BOT_ON_DEMAND_MARKUP_PERCENT=20
BOT_HIGH_USAGE_MIN_PREPAID_USD=20
BOT_HIGH_USAGE_MARKUP_PERCENT=10
BOT_LOW_BALANCE_WARNING_THRESHOLD_PERCENT=10
MERCADOPAGO_ACCESS_TOKEN=replace-with-mercadopago-access-token
MERCADOPAGO_CURRENCY_ID=USD
```

Usage cost estimates use DeepSeek cache-miss input pricing plus output pricing.
The TAKU charge estimate applies the account tier markup on top of that
provider estimate. New `client_id` values default to the `free` tier, receive
`BOT_FREE_MONTHLY_INCLUDED_USD` in monthly included usage, and are blocked from
chat completions when the monthly allowance is exhausted. The free allowance
resets on the first day of each UTC month.

Client-facing screens should show TAKU charge estimates only. Provider cost is
internal margin data and should only be visible to superadmin users.

## Client API

Clients should use the `/v1` API. All `/v1` endpoints except `/v1/health`
require:

```http
x-api-key: BOT_SERVICE_API_KEY
```

They also accept DeepSeek/OpenAI-style bearer auth:

```http
authorization: Bearer BOT_SERVICE_API_KEY
```

### `GET /health`

```json
{ "ok": true }
```

### `GET /v1/health`

```json
{ "ok": true, "service": "bot-service", "version": "v1" }
```

### `GET /v1/models`

Returns the configured TAKU public model list in an OpenAI-compatible shape.
At this point only one model is available: `taku-cr`. More customer relations
models will be added later.

```bash
curl http://localhost:3002/v1/models \
  -H "authorization: Bearer BOT_SERVICE_API_KEY"
```

### `GET /v1/usage/summary`

Returns system usage totals plus grouped usage by client and assistant,
including estimated provider cost and estimated TAKU charge. Optional filters:

- `client_id`
- `assistant_id`

```bash
curl http://localhost:3002/v1/usage/summary \
  -H "authorization: Bearer BOT_SERVICE_API_KEY"
```

### `GET /v1/usage/events`

Returns recent usage events with token counts, estimated provider cost, and
estimated TAKU charge. Optional filters:

- `client_id`
- `assistant_id`
- `limit`

```bash
curl 'http://localhost:3002/v1/usage/events?limit=50' \
  -H "authorization: Bearer BOT_SERVICE_API_KEY"
```

### `GET /v1/admin/overview`

Returns the superadmin platform overview used by `taku-web-bot`, including
billing accounts, tier counts, payment intent totals, provider cost, charge
estimate, and estimated margin. This endpoint is internal and should only be
called by trusted server-side web routes.

```bash
curl http://localhost:3002/v1/admin/overview \
  -H "authorization: Bearer BOT_SERVICE_API_KEY"
```

### `POST /v1/public/billing/card-payment`

Creates a Mercado Pago card payment, stores a BOT payment intent, and credits
the client prepaid balance when the payment is approved. Valid plans are
`on_demand` and `high_usage`. Amounts come from
`BOT_ON_DEMAND_MIN_PREPAID_USD` and `BOT_HIGH_USAGE_MIN_PREPAID_USD` (`$5` and
`$20` defaults); markups come from the matching tier env vars.

```bash
curl -X POST http://localhost:3002/v1/public/billing/card-payment \
  -H "content-type: application/json" \
  -d '{
    "plan": "on_demand",
    "client_id": "bot_account_abc123",
    "token": "CARD_TOKEN_FROM_MP_SDK",
    "payment_method_id": "visa",
    "installments": 1,
    "payer": {
      "email": "client@example.com"
    }
  }'
```

### `GET /v1/public/billing/intents/:paymentIntentId`

Returns a BOT payment intent status.

### `POST /v1/public/billing/intents/:paymentIntentId/confirm`

Checks Mercado Pago by payment intent external reference. If Mercado Pago has
an approved payment, the BOT payment intent is marked as paid.

### `POST /v1/public/billing/mercadopago/webhook`

Receives Mercado Pago payment notifications and marks the matching BOT payment
intent as paid when the provider payment is approved.

### `GET /v1/assistants`

Lists assistants owned by the client account. Each assistant has a stable `id`,
a human-friendly `name`, and reusable `instructions`.

```bash
curl http://localhost:3002/v1/assistants \
  -H "authorization: Bearer BOT_SERVICE_API_KEY" \
  -H "x-taku-client-id: CLIENT_ID"
```

### `POST /v1/assistants`

Creates an assistant.

```bash
curl -X POST http://localhost:3002/v1/assistants \
  -H "content-type: application/json" \
  -H "authorization: Bearer BOT_SERVICE_API_KEY" \
  -H "x-taku-client-id: CLIENT_ID" \
  -d '{
    "name": "Customer assistant",
    "instructions": "Reply briefly, be helpful, and ask one useful follow-up question."
  }'
```

### `PATCH /v1/assistants/:assistantId`

Updates an assistant.

```bash
curl -X PATCH http://localhost:3002/v1/assistants/asst_123 \
  -H "content-type: application/json" \
  -H "authorization: Bearer BOT_SERVICE_API_KEY" \
  -H "x-taku-client-id: CLIENT_ID" \
  -d '{
    "name": "Sales assistant",
    "instructions": "Answer sales questions briefly and collect the customer name."
  }'
```

### `POST /v1/chat/completions`

OpenAI/DeepSeek-compatible chat completions endpoint. It proxies to the
configured DeepSeek provider. When `assistant_id` is present, bot-service
loads that assistant and prepends its instructions before the request messages.
`history` is optional and is inserted before `messages`. Requests must include
either `x-taku-client-id` or `client_id` through the TAKU web proxy so
bot-service can enforce tier billing.

```bash
curl -X POST http://localhost:3002/v1/chat/completions \
  -H "content-type: application/json" \
  -H "authorization: Bearer BOT_SERVICE_API_KEY" \
  -H "x-taku-client-id: CLIENT_ID" \
  -d '{
    "model": "taku-cr",
    "assistant_id": "asst_123",
    "history": [
      { "role": "user", "content": "Hola" },
      { "role": "assistant", "content": "Hola, en que puedo ayudarte?" }
    ],
    "messages": [
      { "role": "user", "content": "What can you do?" }
    ],
    "temperature": 0.2,
    "max_tokens": 120
  }'
```

Response:

```json
{
  "id": "chatcmpl_...",
  "object": "chat.completion",
  "created": 1760000000,
  "model": "taku-cr",
  "assistant_id": "asst_123",
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  },
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Internal / Backward-Compatible Endpoints

These endpoints are kept for existing service integrations and local tooling.
Do not document them as the client API.

All endpoints except `/health` require:

```http
x-api-key: BOT_SERVICE_API_KEY
```

### `GET /health`

```json
{ "ok": true }
```

### `PUT /instructions`

```bash
curl -X PUT http://localhost:3002/instructions \
  -H "content-type: application/json" \
  -H "x-api-key: BOT_SERVICE_API_KEY" \
  -d '{ "instructions": "En este momento estamos cerrados..." }'
```

### `GET /instructions`

Returns `404` with `No instructions configured` until instructions are saved.

### `POST /test/deepseek`

Calls DeepSeek directly without reading instructions or recording a processed message.

```bash
curl -X POST http://localhost:3002/test/deepseek \
  -H "content-type: application/json" \
  -H "x-api-key: BOT_SERVICE_API_KEY" \
  -d '{ "message": "Reply with exactly: deepseek-ok" }'
```

Response:

```json
{
  "ok": true,
  "model": "deepseek-chat",
  "reply": {
    "text": "deepseek-ok"
  }
}
```

### `POST /respond`

```bash
curl -X POST http://localhost:3002/respond \
  -H "content-type: application/json" \
  -H "x-api-key: BOT_SERVICE_API_KEY" \
  -d '{
    "message": {
      "id": "wamid.example",
      "text": "hola",
      "timestamp": "2026-06-09T00:00:00.000Z"
    },
    "history": [
      { "role": "user", "text": "hola", "timestamp": "2026-06-09T00:00:00.000Z" }
    ]
  }'
```

Response:

```json
{
  "ok": true,
  "duplicate": false,
  "reply": {
    "text": "En este momento estamos cerrados...",
    "shouldSend": true
  }
}
```

If instructions are not configured, `/respond` returns:

```json
{
  "ok": false,
  "error": "No instructions configured"
}
```
