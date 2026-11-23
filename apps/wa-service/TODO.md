# WA Service TODO

This service is part of the TAKU WA solution.

## Production Readiness

- [ ] Keep service runtime env status aligned with `docs/taku-service-pair-env-status.md`.
- [ ] Test production Mercado Pago webhook handling with real payment events.
- [ ] Confirm production payments update standalone account billing state.
- [ ] Confirm paid accounts can create/use the expected number of WhatsApp connections.
- [ ] Confirm free accounts remain limited after payment features are enabled.
- [ ] Add Sentry for API/runtime exceptions.
- [ ] Add Sentry context for account id, connection id, and route where safe.
- [ ] Add a production smoke test for `/health`, signup, billing checkout, and webhook routes.

## Notes

- `SERVICE_API_KEY` must match callers that use authenticated WA Service routes.
- The public health endpoint is `/health`; `/v1/health` is under v1 auth.
- Linked-device display name is controlled by `WA_BROWSER_NAME`, `WA_BROWSER_PLATFORM`, and `WA_BROWSER_VERSION`.
