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

- `TAKU_BACKEND_SUPERADMIN_EMAIL` / `TAKU_BACKEND_SUPERADMIN_PASSWORD`
- tambien acepta `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` como alias

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
- `TAKU_BACKEND_SUPERADMIN_EMAIL`
- `TAKU_BACKEND_SUPERADMIN_PASSWORD`
- `TAKU_BACKEND_ALLOWED_ORIGINS`
- `TAKU_BACKEND_PUBLIC_BASE_URL`
- `TAKU_WA_BASE_URL`
- `TAKU_WA_API_KEY`
- `TAKU_WA_CLIENT_DOMAIN`
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

## Orquestacion TAKU

`taku-backend` es quien decide la operacion del producto. `wa-service` solo
administra conexiones WhatsApp y envia/recibe mensajes. `bot-service` solo
administra asistentes y completions.

Flujo de auto-respuesta:

1. `wa-service` envia `POST /api/webhooks/whatsapp`.
2. `taku-backend` identifica workspace, numero, contacto y conversacion.
3. `taku-backend` evalua estado del workspace, horario, reglas y asignacion de bot.
4. Si corresponde, `taku-backend` llama a `bot-service` con `client_id` y `client_token`.
5. `taku-backend` envia la respuesta por `wa-service`.
6. La decision queda en `automationDecisionLogs`.

Si un numero no tiene horario configurado, se considera siempre activo.

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
- `/api/bots/*`
- `/api/bot-assignments/*`
- `/api/automation-rules/*`
- `/api/automation-decisions/*`
- `/api/dashboard/overview`
- `/api/profile`
- `/api/preferences`
- `/api/health`
- `/api/health/ready`
