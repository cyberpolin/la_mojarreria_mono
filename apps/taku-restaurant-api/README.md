# TAKU Restaurant API

Production URL: `https://api.restaurant.taku.lat`

API for `restaurant.taku.lat` and the restaurant mobile app.

## Local

```bash
pnpm --filter @taku/restaurant-api dev
```

Default: `http://localhost:3160/api`

Copy `.env.example` to `.env` before running locally.

The mobile kiosk authenticates with `POST /api/session/device` using
`TAKU_RESTAURANT_DEVICE_KEY`. Local-first writes then sync to:

- `GET|POST /api/expenses`
- `GET /api/products`
- `GET|PUT /api/daily-closes`
- `POST /api/daily-closes/evidence` (Cloudinary; same `CLOUDINARY_*` vars as `apps/api`)

## Deploy

GitHub Action `.github/workflows/deploy-taku-restaurant-api-cloudcluster.yml`
deploys to CloudCluster behind nginx `api.restaurant.taku.lat`.

Required GitHub secrets:

- `TAKU_RESTAURANT_API_ENV_FILE`
- `CLOUDCLUSTER_TAKU_RESTAURANT_API_DEPLOY_PATH` (optional, default `/var/www/taku-restaurant-api`)
- existing CloudCluster SSH secrets used by other TAKU deploys
