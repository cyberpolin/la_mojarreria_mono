# Bot Service TODO

This service is part of the TAKU BOT solution.

## Production Readiness

- [ ] Keep service runtime env status aligned with `docs/taku-service-pair-env-status.md`.
- [ ] Attach paid payment intents to real bot accounts when bot account APIs are added.
- [ ] Add Mercado Pago webhook signature verification.
- [ ] Add Sentry for provider, billing, and runtime exceptions.
- [ ] Add production smoke tests for `/health`, `/v1/runtime/status`, assistants, completions, and billing.
