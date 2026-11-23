# TAKU Control API/Web Deployment

This document covers the deployment relationship between `apps/taku-api-service`
and `apps/taku-web`.

`taku-api-service` is the control API. `taku-web` is the customer/admin web UI
that talks to it.

## Production Domains

Use these domains for the control service:

- TAKU API: `https://api.taku.lat`
- TAKU Web: `https://app.taku.lat`
- WA runtime API: `https://api.wa.lamojarreria.com`

Adjust the web domain if the first Vercel deploy uses a temporary preview URL.

## `apps/taku-web` Environment

Set these variables in Vercel for the `apps/taku-web` project:

```bash
NEXT_PUBLIC_TAKU_API_BASE_URL=https://api.taku.lat
NEXT_PUBLIC_TAKU_API_KEY=<same-value-as-TAKU_API_KEY>
```

Because these variables are `NEXT_PUBLIC_`, they are visible in the browser.
The API key is an application allow-token, not a user secret. User scope is
still carried by the TAKU session token.

## `apps/taku-api-service` Environment

Set these variables on the server running `apps/taku-api-service`:

```bash
TAKU_API_PORT=3010
HOST=0.0.0.0
TAKU_DATA_FILE=./data/taku-api.json
TAKU_ALLOWED_ORIGINS=https://app.taku.lat
TAKU_API_KEY=<shared-api-allow-token>
TAKU_SESSION_SECRET=<long-random-session-secret>
TAKU_SUPEROWNER_EMAIL=<owner-email>
TAKU_SUPEROWNER_PASSWORD=<owner-password>
TAKU_CLIENT_PASSWORD=<initial-client-password>
WA_SERVICE_BASE_URL=https://api.wa.lamojarreria.com
WA_SERVICE_API_KEY=<wa-service-api-key>
WA_SERVICE_CLIENT_DOMAIN=taku.lat
TAKU_WEB_BASE_URL=https://app.taku.lat
MERCADOPAGO_ACCESS_TOKEN=<mercado-pago-access-token>
MERCADOPAGO_WEBHOOK_SECRET=<mercado-pago-webhook-secret>
MERCADOPAGO_USE_SANDBOX=false
```

## Mercado Pago

For TAKU Control billing, Mercado Pago should call:

```text
https://api.taku.lat/v1/billing/mercadopago/webhook
```

The API service already has a `MERCADOPAGO_WEBHOOK_SECRET` setting. Keep it
configured before accepting public payments.

## Publish Checklist

1. Deploy `apps/taku-api-service`.
2. Confirm `https://api.taku.lat/v1/health` or the deployed health route works.
3. Deploy `apps/taku-web` to Vercel.
4. Set `TAKU_ALLOWED_ORIGINS` to the final TAKU Web domain.
5. Confirm login works from `https://app.taku.lat`.
6. Confirm the WhatsApp console can create/start/read WA connections through
   TAKU API.
7. Test one Mercado Pago payment flow in sandbox or with a controlled account.

## Security Notes

- Do not store `TAKU_SESSION_SECRET`, owner passwords, Mercado Pago tokens, or
  WA service API keys in Vercel public variables.
- `NEXT_PUBLIC_TAKU_API_KEY` is browser-visible. It should only be used as an
  API allow-token; authorization must still depend on the logged-in TAKU
  session.
- Rotate `TAKU_API_KEY` if it leaks outside the intended web client.
