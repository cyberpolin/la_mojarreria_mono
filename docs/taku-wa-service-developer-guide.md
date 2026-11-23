# TAKU WhatsApp Bridge Developer Guide

TAKU WhatsApp Bridge is a standalone WhatsApp transport service for developers.
It lets an external application connect a WhatsApp phone, send messages, read
conversation history, and receive message webhooks without implementing a
WhatsApp socket runtime.

Runtime service: `apps/wa-service`

Commercial product: TAKU WhatsApp Bridge

## Who This Is For

This service is for developers who want to integrate WhatsApp into their own
solution.

Example buyers:

- SaaS products that need WhatsApp notifications.
- CRM or customer support tools that need WhatsApp inbox integration.
- Automation platforms that need WhatsApp as a channel.
- Internal business tools that need a simple WhatsApp API.

## Product Boundary

TAKU WhatsApp Bridge owns WhatsApp transport only.

It provides:

- Free developer signup.
- Account-scoped API keys.
- WhatsApp phone/session pairing.
- QR code generation.
- Connection status.
- Text message sending.
- Free-tier daily usage tracking.
- Basic conversation history.
- Inbound message webhooks.
- Runtime health and diagnostics.

It does not own:

- Full customer billing.
- Full subscription lifecycle management.
- Bot decision logic.
- CRM records.
- Campaign strategy.
- Business-specific workflows.

Those belong in the developer's application or in TAKU Control.

## Base URL

Production:

```text
https://api.wa.taku.lat
```

Local development:

```text
http://localhost:3001
```

All v1 endpoints are under:

```text
/v1
```

## Authentication

Standalone developer requests must include:

```http
x-api-key: <developer-api-key>
content-type: application/json
```

The public signup endpoint returns the API key once. Store it in your backend
environment, not in browser local storage.

Example:

```bash
curl https://api.wa.taku.lat/v1/account/me \
  -H "x-api-key: $TAKU_WA_API_KEY"
```

Internal service-key endpoints still exist for TAKU-owned deployments. External
developers should use the account-scoped endpoints under `/v1/account`.

## Quick Start

### 1. Create A Free Account

The free signup creates one developer account, one WhatsApp connection, and one
API key.

```bash
curl -X POST https://api.wa.taku.lat/v1/public/signup \
  -H "content-type: application/json" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "projectName": "Demo CRM",
    "password": "replace-with-a-long-password"
  }'
```

Response:

```json
{
  "ok": true,
  "apiKey": "taku_wa_...",
  "apiKeyNotice": "Store this API key now. It is only returned once.",
  "account": {
    "id": "acct_abc123",
    "email": "ada@example.com",
    "projectName": "Demo CRM",
    "plan": "free",
    "connectionIds": ["wa_abc123"]
  },
  "entitlements": {
    "connectionLimit": 1,
    "dailyMessageLimit": 100,
    "webhooksEnabled": true
  },
  "connection": {
    "connectionId": "wa_abc123",
    "state": "STARTING",
    "hasQr": true
  },
  "qrImage": "data:image/png;base64,..."
}
```

### 2. Scan The QR Code

Display the `qrImage` returned by signup. If you need to fetch it again, poll:

```bash
curl https://api.wa.taku.lat/v1/account/connections/wa_abc123/qr \
  -H "x-api-key: $TAKU_WA_API_KEY"
```

Response:

```json
{
  "ok": true,
  "connection": {
    "connectionId": "wa_abc123",
    "connected": false,
    "hasQr": true,
    "state": "STARTING"
  },
  "qr": "2@...",
  "qrImage": "data:image/png;base64,..."
}
```

The user scans the QR with WhatsApp. After pairing, the connection status moves
to connected.

### 3. Check Connection Status

```bash
curl https://api.wa.taku.lat/v1/account/connections/wa_abc123/status \
  -H "x-api-key: $TAKU_WA_API_KEY"
```

### 4. Send A Message

```bash
curl -X POST https://api.wa.taku.lat/v1/account/connections/wa_abc123/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $TAKU_WA_API_KEY" \
  -d '{
    "to": "5219931234567",
    "text": "Hola, your order is ready."
  }'
```

Response:

```json
{
  "ok": true,
  "connectionId": "wa_abc123",
  "to": "5219931234567",
  "messageId": "ABC123",
  "usage": {
    "date": "2026-06-25",
    "messagesSent": 1
  }
}
```

The free plan is limited to 100 messages per day.

### 5. Register A Webhook

```bash
curl -X POST https://api.wa.taku.lat/v1/account/webhooks/subscriptions \
  -H "content-type: application/json" \
  -H "x-api-key: $TAKU_WA_API_KEY" \
  -d '{
    "url": "https://yourapp.com/webhooks/taku-wa",
    "events": ["message.received"],
    "secret": "replace-with-your-signing-secret"
  }'
```

Standalone webhook subscriptions are scoped to the account connection IDs. A
developer account only receives events for its own WhatsApp connections.

## Core Concepts

### Connection

A connection maps to one WhatsApp phone session.

Fields:

| Field          | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| `connectionId` | Developer-defined id for the WhatsApp session.                |
| `businessId`   | Optional external business/account id.                        |
| `label`        | Human-friendly name for display.                              |
| `autoStart`    | Whether the service should reconnect this session at startup. |
| `active`       | Whether the runtime is started.                               |
| `connected`    | Whether WhatsApp is currently connected.                      |
| `state`        | Runtime state such as inactive, starting, active, error.      |
| `hasQr`        | Whether a QR is currently available.                          |

Use one connection per WhatsApp phone.

### Phone Number Normalization

The service normalizes phone numbers before sending or reading messages.

For Mexican 10-digit numbers, it normalizes to the WhatsApp-compatible
`521...` format.

Recommended input format:

```text
5219931234567
```

### Webhooks

Webhooks let your application receive inbound WhatsApp messages.

Current event:

```text
message.received
```

## API Reference

### Health

```http
GET /v1/health
```

Response:

```json
{
  "ok": true,
  "version": "v1"
}
```

This endpoint does not require service auth.

### List Connections

```http
GET /v1/connections
```

Returns all registered connections.

### Create Connection

```http
POST /v1/connections
```

Body:

```json
{
  "connectionId": "client_001",
  "businessId": "business_123",
  "label": "Main phone",
  "autoStart": false
}
```

Rules:

- `connectionId` may contain letters, numbers, `_`, or `-`.
- `connectionId` max length is 120 characters.
- `businessId` and `label` are optional.
- `autoStart` is optional.

### Read Connection Status

```http
GET /v1/connections/:connectionId/status
```

Returns the current connection snapshot.

### Start Connection

```http
POST /v1/connections/:connectionId/start
```

Starts the WhatsApp runtime for the connection and enables `autoStart`.

### Stop Connection

```http
POST /v1/connections/:connectionId/stop
```

Stops the WhatsApp runtime for the connection and disables `autoStart`.

### Reset Session

```http
POST /v1/connections/:connectionId/reset-session
```

Clears the WhatsApp session for a connection. Use this when a phone must be
unlinked or re-paired.

After reset, start the connection again and fetch a new QR.

### Read QR

```http
GET /v1/connections/:connectionId/qr
```

Returns:

- `qr`: raw QR payload.
- `qrImage`: data URL image suitable for browser display.
- `connection`: current connection snapshot.

### Send Message Through Connection

```http
POST /v1/connections/:connectionId/messages
```

Body:

```json
{
  "to": "5219931234567",
  "text": "Message body"
}
```

Limits:

- `to`: 10 to 20 characters.
- `text`: 1 to 4000 characters.

### List Conversations

```http
GET /v1/conversations?limit=50
```

Returns recent conversations from the local conversation store.

`limit` defaults to 50 and maxes at 100.

### List Conversation Messages

```http
GET /v1/conversations/:phone/messages?limit=50
```

Returns recent messages for one normalized phone.

### Send Message To Conversation

```http
POST /v1/conversations/:phone/messages
```

Body:

```json
{
  "text": "Message body"
}
```

This sends through the default connection. For multi-tenant developer use,
prefer:

```http
POST /v1/connections/:connectionId/messages
```

### Last Conversation Message

```http
GET /v1/conversations/:phone/last-message
```

Returns the last stored message for a phone.

## Webhook Subscriptions

### List Subscriptions

```http
GET /v1/webhooks/subscriptions
```

### Create Subscription

```http
POST /v1/webhooks/subscriptions
```

Body:

```json
{
  "url": "https://yourapp.com/webhooks/taku-wa",
  "events": ["message.received"],
  "secret": "optional-shared-secret"
}
```

Response:

```json
{
  "ok": true,
  "subscription": {
    "id": "subscription-id",
    "url": "https://yourapp.com/webhooks/taku-wa",
    "events": ["message.received"],
    "secret": "optional-shared-secret",
    "active": true,
    "createdAt": "2026-06-25T00:00:00.000Z",
    "updatedAt": "2026-06-25T00:00:00.000Z"
  }
}
```

### Delete Subscription

```http
DELETE /v1/webhooks/subscriptions/:id
```

## Webhook Delivery

When a matching event occurs, TAKU WhatsApp Bridge sends a POST request to the
subscription URL.

Headers:

```http
content-type: application/json
x-wa-service-event: message.received
x-wa-service-secret: <subscription-secret>
```

`x-wa-service-secret` is included only when a secret was configured.

Payload:

```json
{
  "event": "message.received",
  "eventId": "evt_123",
  "provider": "baileys",
  "connectionId": "client_001",
  "businessId": "business_123",
  "occurredAt": "2026-06-25T12:00:00.000Z",
  "message": {
    "id": "msg_123",
    "phone": "5219931234567",
    "fromMe": false,
    "body": "Hola",
    "timestamp": "2026-06-25T12:00:00.000Z"
  }
}
```

Your application should:

- Verify `x-wa-service-secret` when configured.
- Treat `eventId` as idempotency key when present.
- Return a 2xx response quickly.
- Process longer work asynchronously.

## Recommended Integration Flow

```text
1. Developer creates a customer/business in their own system.
2. Developer creates a TAKU WA connection for that customer.
3. Developer starts the connection.
4. Developer displays QR in their app.
5. Customer scans QR with WhatsApp.
6. Developer stores the connectionId in their system.
7. Developer sends messages using /v1/connections/:connectionId/messages.
8. Developer subscribes to message.received webhooks.
9. Developer processes inbound messages in their own app.
```

## Error Format

Most errors use:

```json
{
  "ok": false,
  "error": "Human-readable error",
  "issues": {
    "field": ["Validation message"]
  }
}
```

Common statuses:

| Status | Meaning                                               |
| ------ | ----------------------------------------------------- |
| 400    | Invalid request body, query, phone, or connection id. |
| 401    | Missing or invalid `x-api-key`.                       |
| 403    | Request domain is not allowed.                        |
| 404    | Connection was not found.                             |
| 502    | WhatsApp provider operation failed.                   |

## Security Guidance

- Keep the service API key on your server.
- Do not call protected endpoints directly from an untrusted browser.
- Use `x-client-domain` for explicit domain validation.
- Rotate API keys if they are exposed.
- Verify webhook secrets.
- Store only the `connectionId` and business mapping needed by your app.

## Operational Notes

- WhatsApp auth/session files are stored on disk.
- Multi-connection auth files are stored under the configured auth root.
- Connection metadata is stored in the configured connection store file.
- `autoStart` controls whether a connection should reconnect on service boot.
- Resetting a session requires the customer to scan a new QR.

## Environment Variables

Core service variables:

```dotenv
PORT=3001
SERVICE_API_KEY=replace-with-a-long-random-key
SERVICE_ALLOWED_DOMAINS=yourapp.com,localhost,127.0.0.1
MAIN_BACKEND_URL=https://api.example.com
MAIN_BACKEND_WEBHOOK_SECRET=replace-with-a-long-random-secret
WA_SERVICE_AUTO_START=false
WHATSAPP_AUTH_ROOT=./data/auth
CONNECTION_STORE_FILE=./data/connections.json
CONNECTION_DATA_ROOT=./data/connections
WEBHOOK_SUBSCRIPTIONS_FILE=./data/webhook-subscriptions.json
```

TAKU platform variables, when the service is managed by TAKU Control:

```dotenv
TAKU_API_BASE_URL=https://api.taku.lat
TAKU_API_KEY=replace-with-control-service-key
TAKU_API_BUSINESS_ID=business_001
BOT_SERVICE_BASE_URL=https://api.bot.taku.lat
BOT_SERVICE_API_KEY=replace-with-bot-service-key
```

## Current Limitations

- Current documented send API is text-only.
- Webhook subscriptions currently support `message.received`.
- The service stores runtime data in local JSON/files for the current stage.
- Browser-facing public SDK semantics are not finalized.
- Production multi-tenant entitlement checks should be owned by TAKU Control.

## Positioning

TAKU WhatsApp Bridge should be sold as an API-first WhatsApp transport product:

```text
"Connect a WhatsApp phone, send messages, receive inbound webhooks,
and build your own customer workflows without running WhatsApp sockets."
```

It is the lowest-level sellable TAKU service. Developers can use it alone, or
combine it later with TAKU Bot Runtime for automation and TAKU Control for
subscription management.
