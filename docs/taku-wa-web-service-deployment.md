# TAKU WA Web Deployment

This document covers the environment needed to publish
`apps/taku-wa-web-service`, the developer-facing TAKU WhatsApp Bridge UI.

## Vercel Project

Use these settings for the Vercel project:

- Root directory: `apps/taku-wa-web-service`
- Framework preset: Next.js
- Build command: `pnpm --filter @taku/wa-web-service build`
- Install command: `pnpm install`

## Frontend Environment

Set these variables in Vercel:

```bash
NEXT_PUBLIC_TAKU_WA_API_BASE_URL=https://api.wa.lamojarreria.com
NEXT_PUBLIC_TAKU_WA_HEALTH_URL=https://api.wa.lamojarreria.com/v1/health
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=<mercado-pago-public-key>
```

For local development, `apps/taku-wa-web-service/.env` should point to the local
WA backend:

```bash
NEXT_PUBLIC_TAKU_WA_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_TAKU_WA_HEALTH_URL=http://localhost:3001/v1/health
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=<mercado-pago-test-public-key>
```

For production-like local builds, `apps/taku-wa-web-service/.env.production`
can hold the production API values. These env files are ignored and should not
be committed.

## Backend Variables

After Vercel gives the final web URL, set these on `apps/wa-service`:

```bash
TAKU_WA_WEB_BASE_URL=https://<vercel-domain>
MERCADOPAGO_ACCESS_TOKEN=<mercado-pago-access-token>
MERCADOPAGO_CURRENCY_ID=MXN
MERCADOPAGO_NOTIFICATION_URL=https://api.wa.lamojarreria.com/v1/public/mercadopago/webhook
```

`TAKU_WA_WEB_BASE_URL` is used by the legacy Mercado Pago Checkout Pro fallback
and webhook context. The primary payment flow renders Mercado Pago Card Payment
Brick in TAKU WA Web and sends only the tokenized payment payload to WA Service.

For local development, the UI can still point to the local WA API. The embedded
card form requires `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` on the web app and
`MERCADOPAGO_ACCESS_TOKEN` on WA Service.

To test the full real Mercado Pago payment and return flow locally, expose the
web app with a tunnel or use a deployed Vercel preview URL, then set this on
`apps/wa-service`:

```bash
TAKU_WA_WEB_BASE_URL=https://<public-web-url>
```

Restart `pnpm dev:taku-wa` after changing it.

## Publish Checklist

1. Deploy the Vercel UI.
2. Confirm `/status` can reach `https://api.wa.lamojarreria.com/v1/health`.
3. Set `TAKU_WA_WEB_BASE_URL` on the WA service to the final Vercel URL.
4. Configure the Mercado Pago webhook URL:
   `https://api.wa.lamojarreria.com/v1/public/mercadopago/webhook`.
5. Test signup, QR pairing, login, admin billing, and one subscription upgrade.

## Notes

- Card data is handled by Mercado Pago, not the TAKU WA web UI.
- TAKU stores local billing history and provider ids for dashboard visibility.
- Add Mercado Pago webhook signature validation before a public paid launch.
