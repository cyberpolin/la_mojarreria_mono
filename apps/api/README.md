# CRM Backend

Production base URL: `https://api.lamojarreria.com`

## Automatic user creation

On startup, the app can create a first admin user when no users exist. The credentials come from environment variables, read from env files in this inverse order of precedence:

1. `.env.local`
2. `.env.dev`
3. `.env`

Set the following variables:

- `EMAIL`
- `PASSWORD`

The user creation only runs when the environment is **not** production.

## Entry points

- `keystone.ts` wires the startup flow and calls `createFirstUser`.
- `lib/utils.ts` implements the first-user creation logic.

## WhatsApp service control

The API is the control plane for `wa-service`. Web/mobile clients should call the API, not `wa-service` directly.

Set these API environment variables when enabling WhatsApp service control:

- `WA_SERVICE_BASE_URL`: internal/base URL for `wa-service`
- `WA_SERVICE_API_KEY`: API key used by API to call `wa-service`
- `WA_SERVICE_CLIENT_DOMAIN`: request domain sent to `wa-service` (defaults to `lamojarreria.com`)
- `WA_SERVICE_CONTROL_API_KEY`: API key required to call `/rest/wa-service/activate` and `/rest/wa-service/deactivate`
- `WA_SERVICE_WEBHOOK_SECRET`: secret used by `wa-service` when posting status changes to `/rest/wa-service/status`

The public control endpoints are:

- `GET /rest/wa-service/status`
- `POST /rest/wa-service/activate`
- `POST /rest/wa-service/deactivate`

# Notes

## Prisma note

`npm run migrate:dev` relies on Prisma v6. Prisma v7 rejects datasource `url`/`shadowDatabaseUrl` in `schema.prisma`, and Keystone regenerates that file. Keep Prisma pinned to v6 to avoid migration errors.
