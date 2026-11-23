# Facebook service

Channel adapter for Facebook Messenger and comments on Page publications.
It sends and receives through the Graph API. It does not decide workspace,
hours, or which assistant should answer. That stays in `taku-backend` once
the two are connected.

Production port, when deployed: `3170` (`api.fb.taku.lat`). Local default: `3011`.

The service is not registered in `scripts/taku-service-helpers.sh` yet, so the
current CloudCluster deploy does not request a certificate for it.

## Modes

`REPLY_MODE=local` (default)

- Messenger: if the page has `messengerEnabled` and `messengerReplyText`, send that text.
- Publications: reply when a saved rule matches the post. A rule names one or more post ids, or explicitly sets `matchAllPosts`. Keywords are optional. Nested replies are ignored unless `topLevelOnly` is false.
- Comments written by the Page itself are ignored, so a reply does not answer itself.

`REPLY_MODE=backend`

- Do not answer locally.
- Forward each Messenger message and publication comment to `TAKU_BACKEND_URL`.
- `taku-backend` answers later by calling the send endpoints below.

The backend webhook is signed the same way `taku-backend` already checks WhatsApp webhooks:

```http
X-Timestamp: 1767225600
X-Signature: hmac_sha256(timestamp + "." + jsonBody, TAKU_BACKEND_WEBHOOK_SECRET)
x-fb-service-secret: TAKU_BACKEND_WEBHOOK_SECRET
```

`POST /api/webhooks/facebook` is not implemented in `taku-backend` yet.

## Setup

```bash
pnpm install
cp apps/fb-service/.env.example apps/fb-service/.env
pnpm dev:taku-fb
```

Meta app webhook:

- Callback URL: `https://api.fb.taku.lat/webhooks/facebook`
- Verify token: `FACEBOOK_VERIFY_TOKEN`
- Subscribe the Page to `messages` and `feed`
- Page token permissions: `pages_messaging`, `pages_read_engagement`, `pages_manage_engagement`, `pages_manage_metadata`

Set `FACEBOOK_APP_SECRET` so `POST` webhooks must carry `X-Hub-Signature-256`. `FACEBOOK_SKIP_SIGNATURE_CHECK=true` is only for local fixtures.

## Service API

All `/v1` routes require `x-api-key: SERVICE_API_KEY`. Page tokens are stored locally and are not returned by the API.

```bash
curl -X PUT http://127.0.0.1:3011/v1/pages/123456 \
  -H 'content-type: application/json' \
  -H 'x-api-key: replace-with-a-long-random-api-key' \
  -d '{"label":"TAKU","accessToken":"PAGE_TOKEN","messengerEnabled":true,"messengerReplyText":"Hola, te leemos."}'

curl -X POST http://127.0.0.1:3011/v1/publication-rules \
  -H 'content-type: application/json' \
  -H 'x-api-key: replace-with-a-long-random-api-key' \
  -d '{"pageId":"123456","postIds":["123456_789"],"keywords":["precio"],"replyText":"Te pasamos el precio por Messenger."}'
```

Send endpoints for `taku-backend`:

- `POST /v1/messenger/messages` with `{ "pageId", "recipientId", "text" }`
- `POST /v1/comments/replies` with `{ "pageId", "commentId", "text" }`

`GET /health` and `GET /v1/status` report `replyMode` and whether the backend webhook is configured.
