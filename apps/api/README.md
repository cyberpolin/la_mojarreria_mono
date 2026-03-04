# CRM Backend

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

# Notes

## Prisma note

`npm run migrate:dev` relies on Prisma v6. Prisma v7 rejects datasource `url`/`shadowDatabaseUrl` in `schema.prisma`, and Keystone regenerates that file. Keep Prisma pinned to v6 to avoid migration errors.
