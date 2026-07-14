# TAKU Bot Web

Admin web app for the TAKU BOT-solution.

This app talks to `bot-service` through same-origin Next API routes so the
browser does not receive `TAKU_BOT_API_KEY`.

## Routes

- `/` public product page.
- `/signup` local MVP onboarding.
- `/login` local MVP login.
- `/payment` Mercado Pago card payment through bot-service.
- `/admin` connected bot console.
- `/admin/superadmin` superadmin platform dashboard.
- `/status` bot-service runtime status.

## Client API

The public client API should use only `/v1` endpoints:

- `GET /v1/health`
- `GET /v1/models`
- `POST /v1/chat/completions`

Legacy root endpoints are internal/backward-compatible service endpoints and
should not be documented as client APIs.

## Scripts

```bash
pnpm --filter @taku/bot-web dev
pnpm --filter @taku/bot-web build
pnpm --filter @taku/bot-web typecheck
```

Local URL:

```text
http://localhost:3005
```

## Environment

```env
TAKU_BOT_API_BASE_URL=http://localhost:3002
TAKU_BOT_API_KEY=replace-with-bot-service-api-key
TAKU_BOT_SUPERADMIN_EMAIL=replace-with-superadmin-email
TAKU_BOT_SUPERADMIN_PASSWORD=replace-with-superadmin-password
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=replace-with-mercadopago-public-key
```

`MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_CURRENCY_ID` are configured on
`apps/bot-service`, not in the web app.

`TAKU_BOT_SUPERADMIN_EMAIL` and `TAKU_BOT_SUPERADMIN_PASSWORD` seed the mock
superadmin login when needed. They are server-side env vars and must not use a
`NEXT_PUBLIC_` prefix.
