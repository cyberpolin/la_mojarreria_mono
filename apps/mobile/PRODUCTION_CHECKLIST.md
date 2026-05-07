# Mobile Production Checklist

Use this list before shipping a production build. Keep it updated as we add requirements.

## 1) Environment + config

- Regenerate config from production env:
  - `cp .env.production .env`
  - `npm run env:generate`
- Verify `apps/mobile/constants/config.ts` contains production values:
  - `APP_CONFIG.env` is `production`
  - `apiUrl` and `qrUrl` are production domains
  - `clean` and `seed` are `false` for prod
- Confirm `EXPO_PUBLIC_SENTRY_DSN` is set and `EXPO_PUBLIC_SENTRY_ENABLED=true`
- Validate `EXPO_PUBLIC_DEVICE_ID` is unique per device
- Remove any test credentials or default PINs from `.env.production`

## 2) Build + release configuration

- Add `eas.json` with `production` and `preview` profiles
- Confirm `app.json` includes correct `ios.bundleIdentifier` and `android.package`
- Ensure app icons and splash assets are final
- Confirm `orientation` and `expo-screen-orientation` match desired UX

## 3) Backend + network

- Verify `EXPO_PUBLIC_API_URL` points to production API
- Confirm API health and auth flows work with the mobile app
- Validate required GraphQL/REST endpoints are available in prod
- Confirm CORS and auth settings allow mobile traffic

## 4) Observability

- Sentry configured and receiving events in production project
- Release/version tagged in Sentry (if used)
- Verify logs do not contain PII

## 5) QA + smoke tests (device)

- Login / PIN flow
- Sync flows (create/update/delete) with offline + recovery
- Payment / receipt / QR workflows
- Backgrounding / resume behavior
- Keep-awake and dim screen behavior
- Permission prompts (camera, storage, etc.)
- Performance check on lowest supported device

## 6) App store readiness

- Set production version and build numbers
- Store listing metadata and screenshots ready
- Privacy policy and support contact updated
- TestFlight / internal testing ready

## 7) Release sign-off

- Confirm no `EXPO_PUBLIC_*` secrets are missing
- Verify `constants/config.ts` is regenerated from production env
- Tag release in git
- Record build details in release notes
