# TAKU Restaurant

Public product: `https://restaurant.taku.lat`

Landing, plans, login and client backoffice. Hosted on **Vercel**.

API: `https://api.restaurant.taku.lat` (`apps/taku-restaurant-api`).

## Local

```bash
pnpm --filter @taku/restaurant-api dev
pnpm --filter @taku/restaurant-site dev
```

Site: `http://localhost:3007`

## Vercel

1. New project from this repo.
2. Root directory: `apps/taku-restaurant-site`
3. Framework: Next.js
4. Domain: `restaurant.taku.lat`
5. Env:

```
NEXT_PUBLIC_TAKU_RESTAURANT_API_BASE_URL=https://api.restaurant.taku.lat/api
NEXT_PUBLIC_TAKU_RESTAURANT_SITE_URL=https://restaurant.taku.lat
```
