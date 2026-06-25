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
```

The same values are also present in `apps/taku-wa-web-service/.env` for local
production-like testing.

## Backend Variables

After Vercel gives the final web URL, set these on `apps/wa-service`:

```bash
TAKU_WA_WEB_BASE_URL=https://<vercel-domain>
MERCADOPAGO_ACCESS_TOKEN=<mercado-pago-access-token>
MERCADOPAGO_CURRENCY_ID=MXN
MERCADOPAGO_NOTIFICATION_URL=https://api.wa.lamojarreria.com/v1/public/mercadopago/webhook
```

`TAKU_WA_WEB_BASE_URL` is used by the WA service to send Mercado Pago users back
to the billing page after starting a subscription.

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
