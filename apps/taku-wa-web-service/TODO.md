# TAKU WA Web TODO

This app is part of the TAKU WA solution.

## Production Readiness

- [ ] Keep `/status` aligned with `docs/taku-service-pair-env-status.md`.
- [ ] Test production Mercado Pago payment flow end to end.
- [ ] Confirm paid signup redirects back with a valid payment intent.
- [ ] Confirm paid payment intent attaches to the created account.
- [ ] Confirm free signup still works without `paidPaymentIntentId`.
- [ ] Add Sentry for frontend runtime errors.
- [ ] Add Sentry source maps for production builds.
- [ ] Add a production smoke test for `/signup`, `/payment`, `/admin`, and `/status`.

## Notes

- `TAKU_SUPEROWNER_PASSWORD` is required server-side for protected status checks.
- `NEXT_PUBLIC_TAKU_WA_HEALTH_URL` should point to the public WA service `/health` endpoint, not `/v1/health`.
