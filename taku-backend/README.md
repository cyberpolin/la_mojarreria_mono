# TAKU Backend

Backend central para la plataforma SaaS de WhatsApp descrita en `apps/taku-site`.

## Alcance

- API REST versionada bajo `/api`.
- Autenticacion con access token y refresh token.
- Autenticacion Super Admin separada bajo `/api/admin`.
- Multi-tenant por `X-Workspace-Id`.
- Roles `owner`, `admin` y `agent`.
- Persistencia local JSON para MVP y `db/schema.sql` listo como base PostgreSQL.
- Adaptadores hacia TAKU WA Service y Bot Service.
- Webhooks firmados para eventos de WhatsApp y bot.
- Socket.IO por workspace para eventos en tiempo real.

## Ejecutar

```bash
pnpm install
pnpm dev:taku-backend
```

El servicio corre por defecto en `http://localhost:4000/api`.

Credenciales seed:

- siempre:

- `cyberpolin@gmail.com` / `changeme`

  Este usuario es interno Super Admin (`admin_users.role = super_owner`), no un usuario cliente.

- con `TAKU_BACKEND_ENV=development` o `TAKU_BACKEND_ENV=TEST`:

- `owner@owner.com` / `owner`
- `admin@admin.com` / `admin`
- `agent@agent.com` / `agent`

La politica completa esta documentada en `docs/seedings.md`.

## Variables

Copia `.env.example` a `.env` o exporta las variables necesarias.

Las variables criticas son:

- `TAKU_BACKEND_JWT_SECRET`
- `TAKU_BACKEND_REFRESH_SECRET`
- `TAKU_BACKEND_ALLOWED_ORIGINS`
- `TAKU_WA_BASE_URL`
- `TAKU_WA_API_KEY`
- `TAKU_WA_WEBHOOK_SECRET`
- `BOT_SERVICE_BASE_URL`
- `BOT_SERVICE_API_KEY`
- `BOT_SERVICE_WEBHOOK_SECRET`

## Seguridad multi-tenant

Despues de login, cada request privada debe incluir:

```http
Authorization: Bearer ACCESS_TOKEN
X-Workspace-Id: workspace_demo
```

Todas las consultas sensibles se filtran por `workspaceId`.

## Webhooks

Los webhooks no usan token de usuario. Deben enviar:

```http
X-Timestamp: 1780000000
X-Signature: hmac_sha256(timestamp + "." + jsonBody, webhookSecret)
```

Endpoints:

- `POST /api/webhooks/whatsapp`
- `POST /api/webhooks/bot`

## Endpoints principales

- `/api/auth/*`
- `/api/workspaces/*`
- `/api/users/*`
- `/api/whatsapp-accounts/*`
- `/api/contacts/*`
- `/api/conversations/*`
- `/api/messages/*`
- `/api/business-hours/*`
- `/api/bot-settings/*`
- `/api/automation-rules/*`
- `/api/dashboard/overview`
- `/api/profile`
- `/api/preferences`
- `/api/health`
- `/api/health/ready`
