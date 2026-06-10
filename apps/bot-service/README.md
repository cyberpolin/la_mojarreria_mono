# La Mojarreria Bot Service

Small bot runtime service. It stores one persistent instruction text in JSON and uses DeepSeek to generate replies for inbound messages.

## Setup

```bash
pnpm install
cp apps/bot-service/.env.example apps/bot-service/.env
pnpm --filter @mojarreria/bot-service dev
```

## Endpoints

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
