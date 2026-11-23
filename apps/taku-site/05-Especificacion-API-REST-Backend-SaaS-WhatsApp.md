# 05 - Especificación de API REST para Backend SaaS

## Plataforma SaaS de Administración de WhatsApp Business

---

# Objetivo del documento

Este documento define el contrato REST que usará el frontend **Next.js** para comunicarse con el backend principal **Express.js**.

También define cómo el backend principal debe integrarse con los servicios externos existentes:

- **WhatsApp Service API / TAKU WhatsApp Bridge**
- **Bot Service API**

Este documento será usado junto con:

- `01-Propuesta-de-Valor-MVP-WhatsApp-SaaS.md`
- `02-Arquitectura-Unificada-WhatsApp-SaaS.md`
- `03-Modelo-de-Datos-y-Seguridad-Multitenant.md`
- `03B-Especificacion-Dashboard-Web-Multitenant.md`

para construir el backend de la plataforma.

---

# Contexto técnico

## Stack definido

```text
Frontend: Next.js
Backend principal: Express.js
Base de datos: PostgreSQL
WhatsApp transport: TAKU WhatsApp Bridge / WhatsApp Service API
Bot/automatización: Bot Service API
```

---

# Principio central

El frontend **nunca** debe consumir directamente el WhatsApp Service API ni el Bot Service API.

La comunicación siempre debe ser:

```text
Next.js Dashboard
      |
      v
Express.js API principal
      |
      +----------------------+
      |                      |
      v                      v
WhatsApp Service API     Bot Service API
```

El backend Express.js será responsable de:

- Autenticación.
- Autorización.
- Multi-tenant.
- Validación de permisos.
- Normalización de datos.
- Persistencia en PostgreSQL.
- Comunicación con WhatsApp Service API.
- Comunicación con Bot Service API.
- Recepción de webhooks.
- Emisión de eventos en tiempo real.

---

# API externa disponible: TAKU WhatsApp Bridge

La API pública de TAKU WhatsApp Bridge expone una superficie para operar el ciclo de vida de conexiones de WhatsApp, pairing por QR, envío de mensajes y webhooks.

## Base URL pública

```text
https://api.wa.taku.lat
```

## Autenticación

La API pública usa header:

```text
x-api-key: <TAKU_WA_API_KEY>
```

## Endpoints documentados

```text
POST /v1/public/signup
GET  /v1/account/me
GET  /v1/account/connections
GET  /v1/account/connections/:id/qr
POST /v1/account/connections/:id/messages
POST /v1/account/webhooks/subscriptions
```

## Concepto de conexión

La documentación indica:

```text
Use one connection per WhatsApp phone.
Store the connectionId in your app.
```

En nuestra plataforma:

```text
whatsapp_accounts.external_instance_id = TAKU connectionId
```

---

# Responsabilidad del backend SaaS frente a TAKU

El backend SaaS debe:

1. Crear o registrar una conexión local.
2. Solicitar/leer QR al WhatsApp Service API.
3. Guardar el `connectionId` externo.
4. Asociarlo al `workspace_id`.
5. Enviar mensajes usando el endpoint externo.
6. Recibir eventos entrantes vía webhook.
7. Traducir esos eventos a `contacts`, `conversations` y `messages`.
8. Emitir eventos de tiempo real al dashboard.

---

# Convenciones generales de nuestra API

## Base URL interna

Durante desarrollo:

```text
http://localhost:4000/api
```

Producción:

```text
https://api.<dominio>/api
```

---

## Formato de respuesta exitosa

Todas las respuestas exitosas deben seguir este patrón:

```json
{
  "ok": true,
  "data": {}
}
```

Para listas paginadas:

```json
{
  "ok": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Formato de error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo email es requerido.",
    "details": {}
  }
}
```

---

## Códigos HTTP estándar

| Código | Uso                                       |
| -----: | ----------------------------------------- |
|    200 | Operación exitosa                         |
|    201 | Recurso creado                            |
|    204 | Operación exitosa sin body                |
|    400 | Error de validación                       |
|    401 | No autenticado                            |
|    403 | Sin permisos                              |
|    404 | Recurso no encontrado                     |
|    409 | Conflicto                                 |
|    422 | Entidad inválida                          |
|    429 | Rate limit                                |
|    500 | Error interno                             |
|    502 | Error al comunicarse con servicio externo |
|    503 | Servicio externo no disponible            |

---

## Headers requeridos desde frontend

Para endpoints autenticados:

```text
Authorization: Bearer <access_token>
X-Workspace-Id: <workspace_id>
Content-Type: application/json
```

## Nota sobre `X-Workspace-Id`

El frontend puede enviar el workspace activo mediante header.

Pero el backend debe validar:

1. Que el usuario esté autenticado.
2. Que el usuario tenga membresía activa en ese workspace.
3. Que su rol permita ejecutar la acción.

Nunca confiar sólo en el `X-Workspace-Id`.

---

# Roles iniciales

```text
owner
admin
agent
```

---

# Permisos generales por rol

| Recurso / Acción              | owner |    admin |             agent |
| ----------------------------- | ----: | -------: | ----------------: |
| Ver conversaciones            |    Sí |       Sí |                Sí |
| Responder mensajes            |    Sí |       Sí |                Sí |
| Cerrar conversaciones         |    Sí |       Sí |                Sí |
| Asignar conversaciones        |    Sí |       Sí | Según preferencia |
| Ver números                   |    Sí |       Sí |          Limitado |
| Crear números                 |    Sí |       Sí |                No |
| Conectar / reconectar números |    Sí |       Sí |                No |
| Desconectar números           |    Sí |       Sí |                No |
| Configurar automatización     |    Sí |       Sí |                No |
| Configurar horarios           |    Sí |       Sí |                No |
| Administrar usuarios          |    Sí |       Sí |                No |
| Editar empresa                |    Sí |       Sí |                No |
| Ver plan/facturación          |    Sí | Limitado |                No |

---

# Módulos de API

La API principal se divide en:

```text
1. Auth
2. Workspaces
3. Users / Memberships
4. WhatsApp Accounts
5. Contacts
6. Conversations
7. Messages
8. Business Hours
9. Bot Settings
10. Automation Rules
11. Dashboard / Overview
12. Webhooks
13. Realtime
14. Health
```

---

# 1. Auth API

## 1.1 Login

```http
POST /api/auth/login
```

### Descripción

Autentica un usuario y devuelve tokens de sesión, datos del usuario y workspaces disponibles.

### Auth

No requiere.

### Request

```json
{
  "email": "ana@empresa.com",
  "password": "password123"
}
```

### Validaciones

- `email` requerido.
- `email` debe tener formato válido.
- `password` requerido.

### Response 200

```json
{
  "ok": true,
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "user": {
      "id": "user_uuid",
      "name": "Ana Pérez",
      "email": "ana@empresa.com",
      "status": "active"
    },
    "workspaces": [
      {
        "id": "workspace_uuid",
        "name": "La Mojarrería",
        "slug": "la-mojarreria",
        "status": "active",
        "plan": "starter",
        "role": "admin"
      }
    ],
    "defaultWorkspaceId": "workspace_uuid"
  }
}
```

### Errores

```text
400 VALIDATION_ERROR
401 INVALID_CREDENTIALS
403 USER_DISABLED
```

---

## 1.2 Refresh token

```http
POST /api/auth/refresh
```

### Request

```json
{
  "refreshToken": "jwt_refresh_token"
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

---

## 1.3 Logout

```http
POST /api/auth/logout
```

### Auth

Requiere usuario autenticado.

### Request

```json
{
  "refreshToken": "jwt_refresh_token"
}
```

### Response 204

Sin body.

---

## 1.4 Usuario actual

```http
GET /api/auth/me
```

### Auth

Requiere usuario autenticado.

### Response 200

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "user_uuid",
      "name": "Ana Pérez",
      "email": "ana@empresa.com",
      "status": "active"
    },
    "currentWorkspace": {
      "id": "workspace_uuid",
      "name": "La Mojarrería",
      "slug": "la-mojarreria",
      "role": "admin",
      "status": "active",
      "plan": "starter"
    },
    "workspaces": [
      {
        "id": "workspace_uuid",
        "name": "La Mojarrería",
        "slug": "la-mojarreria",
        "role": "admin",
        "status": "active"
      }
    ]
  }
}
```

---

## 1.5 Recuperar contraseña

```http
POST /api/auth/forgot-password
```

### Request

```json
{
  "email": "ana@empresa.com"
}
```

### Response 200

Siempre responder igual para no revelar si el correo existe.

```json
{
  "ok": true,
  "data": {
    "message": "Si el correo existe, enviaremos instrucciones para restablecer la contraseña."
  }
}
```

---

## 1.6 Restablecer contraseña

```http
POST /api/auth/reset-password
```

### Request

```json
{
  "token": "reset_token",
  "password": "newPassword123",
  "passwordConfirmation": "newPassword123"
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "message": "Contraseña actualizada correctamente."
  }
}
```

---

# 2. Workspaces API

## 2.1 Obtener workspace actual

```http
GET /api/workspaces/current
```

### Auth

Requiere usuario autenticado y workspace activo.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "workspace_uuid",
    "name": "La Mojarrería",
    "slug": "la-mojarreria",
    "status": "active",
    "plan": "starter",
    "timezone": "America/Mexico_City",
    "createdAt": "2026-07-04T10:00:00.000Z",
    "updatedAt": "2026-07-04T10:00:00.000Z"
  }
}
```

---

## 2.2 Actualizar workspace actual

```http
PATCH /api/workspaces/current
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "name": "La Mojarrería",
  "slug": "la-mojarreria",
  "timezone": "America/Mexico_City"
}
```

### Validaciones

- `name` requerido si se envía.
- `slug` sólo minúsculas, números y guiones.
- `timezone` debe ser una zona horaria válida.
- No permitir slug duplicado.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "workspace_uuid",
    "name": "La Mojarrería",
    "slug": "la-mojarreria",
    "timezone": "America/Mexico_City",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 2.3 Listar workspaces del usuario

```http
GET /api/workspaces
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "workspace_uuid",
      "name": "La Mojarrería",
      "slug": "la-mojarreria",
      "status": "active",
      "plan": "starter",
      "role": "owner"
    }
  ]
}
```

---

# 3. Users / Memberships API

## 3.1 Listar usuarios del workspace

```http
GET /api/users
```

### Roles

```text
owner
admin
```

### Query params

```text
status=active|invited|disabled
role=owner|admin|agent
search=ana
page=1
pageSize=20
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "user_uuid",
      "name": "Ana Pérez",
      "email": "ana@empresa.com",
      "status": "active",
      "role": "admin",
      "lastLoginAt": "2026-07-04T10:00:00.000Z",
      "createdAt": "2026-07-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 3.2 Invitar usuario

```http
POST /api/users/invitations
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "name": "Juan López",
  "email": "juan@empresa.com",
  "role": "agent",
  "message": "Hola, te invito a usar el panel de WhatsApp de la empresa."
}
```

### Validaciones

- `name` requerido.
- `email` requerido y válido.
- `role` requerido.
- `role` permitido: `admin`, `agent`.
- Admin no puede invitar owner.
- No permitir duplicar email dentro del workspace.
- Validar límite de usuarios por plan si aplica.

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "name": "Juan López",
    "email": "juan@empresa.com",
    "role": "agent",
    "status": "invited",
    "invitationSentAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 3.3 Obtener usuario del workspace

```http
GET /api/users/:id
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "name": "Juan López",
    "email": "juan@empresa.com",
    "role": "agent",
    "status": "active",
    "createdAt": "2026-07-04T12:00:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 3.4 Actualizar usuario del workspace

```http
PATCH /api/users/:id
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "name": "Juan Carlos López",
  "role": "agent",
  "status": "active"
}
```

### Validaciones

- No permitir que admin edite owner.
- No permitir deshabilitar al último owner.
- No permitir que un usuario se quite a sí mismo como último owner.
- `role` permitido según rol del usuario actual.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "name": "Juan Carlos López",
    "email": "juan@empresa.com",
    "role": "agent",
    "status": "active",
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 3.5 Reenviar invitación

```http
POST /api/users/:id/resend-invitation
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "message": "Invitación reenviada correctamente."
  }
}
```

---

## 3.6 Deshabilitar usuario

```http
POST /api/users/:id/disable
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "status": "disabled"
  }
}
```

---

## 3.7 Habilitar usuario

```http
POST /api/users/:id/enable
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "status": "active"
  }
}
```

---

# 4. WhatsApp Accounts API

Esta sección es crítica porque aquí se integra el backend SaaS con el **WhatsApp Service API / TAKU WhatsApp Bridge**.

---

## Relación con TAKU

En nuestra plataforma:

```text
whatsapp_accounts.id = ID interno de nuestra plataforma
whatsapp_accounts.external_instance_id = connectionId en TAKU
```

El frontend sólo debe conocer nuestro `whatsappAccount.id`.

El `external_instance_id` no debe ser usado directamente por el frontend salvo que se decida mostrarlo como dato técnico sólo para admins.

---

## 4.1 Listar números de WhatsApp

```http
GET /api/whatsapp-accounts
```

### Roles

```text
owner
admin
agent (lectura limitada opcional)
```

### Query params

```text
status=pending|qr_required|connecting|connected|disconnected|failed|disabled
search=ventas
page=1
pageSize=20
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "whatsapp_account_uuid",
      "displayName": "Ventas",
      "phoneNumber": "5219931234567",
      "status": "connected",
      "automationEnabled": true,
      "lastConnectedAt": "2026-07-04T11:00:00.000Z",
      "lastDisconnectedAt": null,
      "createdAt": "2026-07-01T10:00:00.000Z",
      "updatedAt": "2026-07-04T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 4.2 Crear número local

```http
POST /api/whatsapp-accounts
```

### Descripción

Crea un registro local de número de WhatsApp y, si aplica, provisiona una conexión en el WhatsApp Service API.

### Roles

```text
owner
admin
```

### Request

```json
{
  "displayName": "Ventas",
  "description": "Número principal para ventas y cotizaciones",
  "timezone": "America/Mexico_City",
  "useWorkspaceBusinessHours": true,
  "useWorkspaceBotSettings": true
}
```

### Validaciones

- `displayName` requerido.
- `displayName` máximo 80 caracteres.
- No duplicar nombre dentro del workspace, o permitirlo con advertencia.
- Validar límite de números por plan si aplica.

### Integración externa sugerida

La documentación pública de TAKU indica que se puede crear/provisionar una conexión con un `connectionId` definido por el desarrollador.

Si el WhatsApp Service API interno ya tiene endpoint de creación de conexión, Express debe llamarlo aquí.

Como el endpoint exacto de creación de conexión no aparece listado públicamente, se proponen dos alternativas:

### Alternativa A: connectionId creado por nuestra plataforma

```text
connectionId = wa_<workspace_short_id>_<random_suffix>
```

La plataforma guarda ese ID como `external_instance_id`.

### Alternativa B: connectionId creado por WhatsApp Service API

El backend llama al servicio externo y guarda el ID devuelto.

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "displayName": "Ventas",
    "phoneNumber": null,
    "status": "pending",
    "qrAvailable": false,
    "createdAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 4.3 Obtener detalle de número

```http
GET /api/whatsapp-accounts/:id
```

### Roles

```text
owner
admin
agent (lectura limitada opcional)
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "displayName": "Ventas",
    "description": "Número principal para ventas y cotizaciones",
    "phoneNumber": "5219931234567",
    "status": "connected",
    "automationEnabled": true,
    "useWorkspaceBusinessHours": true,
    "useWorkspaceBotSettings": true,
    "lastConnectedAt": "2026-07-04T11:00:00.000Z",
    "lastDisconnectedAt": null,
    "recentConversations": [
      {
        "id": "conversation_uuid",
        "contactName": "Juan Pérez",
        "lastMessageBody": "Necesito una cotización",
        "lastMessageAt": "2026-07-04T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 4.4 Actualizar número

```http
PATCH /api/whatsapp-accounts/:id
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "displayName": "Ventas Tabasco",
  "description": "Número de ventas para la sucursal principal",
  "enabled": true,
  "timezone": "America/Mexico_City",
  "useWorkspaceBusinessHours": true,
  "useWorkspaceBotSettings": true
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "displayName": "Ventas Tabasco",
    "description": "Número de ventas para la sucursal principal",
    "enabled": true,
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 4.5 Solicitar conexión / iniciar pairing

```http
POST /api/whatsapp-accounts/:id/connect
```

### Descripción

Inicia o reinicia el proceso de conexión del número.

El backend debe solicitar el QR al WhatsApp Service API y actualizar el estado local.

### Roles

```text
owner
admin
```

### Request

```json
{}
```

### Uso de TAKU

Endpoint público relacionado:

```http
GET https://api.wa.taku.lat/v1/account/connections/:id/qr
```

Header:

```text
x-api-key: <TAKU_WA_API_KEY>
```

Donde `:id` es el `external_instance_id`.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "status": "qr_required",
    "qr": {
      "payload": "qr_payload_string",
      "imageUrl": "data:image/png;base64,...",
      "expiresAt": "2026-07-04T12:05:00.000Z"
    }
  }
}
```

### Nota

La respuesta exacta del endpoint externo de QR debe adaptarse al contrato real del WhatsApp Service API.

El frontend debe estar preparado para:

```text
Generando QR
QR listo
QR expirado
Conectando
Conectado
Error
```

---

## 4.6 Obtener QR actual

```http
GET /api/whatsapp-accounts/:id/qr
```

### Roles

```text
owner
admin
```

### Descripción

Obtiene el QR actual para conectar el número.

### Uso de TAKU

```http
GET /v1/account/connections/:id/qr
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "status": "qr_required",
    "qr": {
      "payload": "qr_payload_string",
      "imageUrl": "data:image/png;base64,...",
      "expiresAt": "2026-07-04T12:05:00.000Z"
    }
  }
}
```

### Errores

```text
404 WHATSAPP_ACCOUNT_NOT_FOUND
409 WHATSAPP_ALREADY_CONNECTED
502 WHATSAPP_SERVICE_ERROR
```

---

## 4.7 Regenerar QR

```http
POST /api/whatsapp-accounts/:id/qr/regenerate
```

### Roles

```text
owner
admin
```

### Descripción

Solicita un nuevo QR al WhatsApp Service API.

### Response 200

```json
{
  "ok": true,
  "data": {
    "status": "qr_required",
    "qr": {
      "payload": "new_qr_payload",
      "imageUrl": "data:image/png;base64,...",
      "expiresAt": "2026-07-04T12:10:00.000Z"
    }
  }
}
```

---

## 4.8 Desconectar número

```http
POST /api/whatsapp-accounts/:id/disconnect
```

### Roles

```text
owner
admin
```

### Descripción

Desconecta el número de la plataforma.

### Request

```json
{
  "reason": "Desconectado manualmente por administrador"
}
```

### Integración externa

La API pública listada no muestra un endpoint explícito para desconexión.

Por tanto:

- Si el WhatsApp Service API interno tiene endpoint de desconexión, usarlo.
- Si no existe, marcar localmente como `disabled` o `disconnected` según la intención.
- Registrar audit log.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "status": "disconnected",
    "lastDisconnectedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 4.9 Sincronizar estado desde WhatsApp Service

```http
POST /api/whatsapp-accounts/:id/sync
```

### Roles

```text
owner
admin
```

### Descripción

Consulta el estado actual de la conexión en el WhatsApp Service API y actualiza el registro local.

### Uso de TAKU

Endpoint público relacionado:

```http
GET /v1/account/connections
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "status": "connected",
    "phoneNumber": "5219931234567",
    "lastConnectedAt": "2026-07-04T12:35:00.000Z"
  }
}
```

---

## 4.10 Eliminar / deshabilitar número

```http
DELETE /api/whatsapp-accounts/:id
```

### Roles

```text
owner
admin
```

### Recomendación

Para MVP se recomienda hacer soft delete o deshabilitar, no borrar conversaciones.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "whatsapp_account_uuid",
    "status": "disabled"
  }
}
```

---

# 5. Contacts API

## 5.1 Listar contactos

```http
GET /api/contacts
```

### Roles

```text
owner
admin
agent
```

### Query params

```text
search=juan
phone=521993
page=1
pageSize=20
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "contact_uuid",
      "name": "Juan Pérez",
      "phoneNumber": "5219931234567",
      "profilePictureUrl": null,
      "lastConversationAt": "2026-07-04T12:00:00.000Z",
      "createdAt": "2026-07-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 5.2 Obtener contacto

```http
GET /api/contacts/:id
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "contact_uuid",
    "name": "Juan Pérez",
    "phoneNumber": "5219931234567",
    "profilePictureUrl": null,
    "createdAt": "2026-07-01T10:00:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 5.3 Actualizar contacto

```http
PATCH /api/contacts/:id
```

### Roles

```text
owner
admin
agent
```

### Request

```json
{
  "name": "Juan Pérez",
  "notes": "Cliente frecuente. Prefiere atención por la tarde."
}
```

### Validaciones

- `name` máximo 120 caracteres.
- `notes` máximo 2,000 caracteres, si se implementa.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "contact_uuid",
    "name": "Juan Pérez",
    "phoneNumber": "5219931234567",
    "updatedAt": "2026-07-04T12:20:00.000Z"
  }
}
```

---

# 6. Conversations API

## 6.1 Listar conversaciones

```http
GET /api/conversations
```

### Roles

```text
owner
admin
agent
```

### Query params

```text
status=open|pending|closed|archived
assignedTo=me|unassigned|user_uuid
whatsappAccountId=whatsapp_account_uuid
search=juan
unread=true
page=1
pageSize=20
sort=lastMessageAt:desc
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "conversation_uuid",
      "status": "open",
      "contact": {
        "id": "contact_uuid",
        "name": "Juan Pérez",
        "phoneNumber": "5219931234567",
        "profilePictureUrl": null
      },
      "whatsappAccount": {
        "id": "whatsapp_account_uuid",
        "displayName": "Ventas",
        "phoneNumber": "5219930000000",
        "status": "connected"
      },
      "assignedUser": {
        "id": "user_uuid",
        "name": "Ana Pérez"
      },
      "lastMessage": {
        "body": "Necesito una cotización",
        "direction": "inbound",
        "createdAt": "2026-07-04T12:00:00.000Z"
      },
      "unreadCount": 2,
      "lastMessageAt": "2026-07-04T12:00:00.000Z",
      "createdAt": "2026-07-04T11:50:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 6.2 Obtener conversación

```http
GET /api/conversations/:id
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "conversation_uuid",
    "status": "open",
    "contact": {
      "id": "contact_uuid",
      "name": "Juan Pérez",
      "phoneNumber": "5219931234567",
      "profilePictureUrl": null
    },
    "whatsappAccount": {
      "id": "whatsapp_account_uuid",
      "displayName": "Ventas",
      "phoneNumber": "5219930000000",
      "status": "connected"
    },
    "assignedUser": {
      "id": "user_uuid",
      "name": "Ana Pérez"
    },
    "lastMessageAt": "2026-07-04T12:00:00.000Z",
    "createdAt": "2026-07-04T11:50:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 6.3 Actualizar estado de conversación

```http
PATCH /api/conversations/:id/status
```

### Roles

```text
owner
admin
agent
```

### Request

```json
{
  "status": "closed"
}
```

### Valores

```text
open
pending
closed
archived
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "conversation_uuid",
    "status": "closed",
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 6.4 Asignar conversación

```http
PATCH /api/conversations/:id/assignment
```

### Roles

```text
owner
admin
agent opcional según preferencia
```

### Request

```json
{
  "assignedUserId": "user_uuid",
  "comment": "Favor de dar seguimiento."
}
```

### Para desasignar

```json
{
  "assignedUserId": null
}
```

### Validaciones

- El usuario asignado debe pertenecer al workspace.
- Debe estar activo.
- Debe tener rol `agent`, `admin` u `owner`.

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "conversation_uuid",
    "assignedUser": {
      "id": "user_uuid",
      "name": "Juan López"
    },
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 6.5 Marcar conversación como leída

```http
POST /api/conversations/:id/read
```

### Roles

```text
owner
admin
agent
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "conversation_uuid",
    "unreadCount": 0
  }
}
```

---

# 7. Messages API

## 7.1 Listar mensajes de conversación

```http
GET /api/conversations/:conversationId/messages
```

### Roles

```text
owner
admin
agent
```

### Query params

```text
before=2026-07-04T12:00:00.000Z
after=2026-07-04T10:00:00.000Z
page=1
pageSize=50
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "message_uuid",
      "externalMessageId": "wa_message_id",
      "direction": "inbound",
      "type": "text",
      "body": "Hola, necesito una cotización",
      "mediaUrl": null,
      "status": "received",
      "sentByUser": null,
      "createdAt": "2026-07-04T12:00:00.000Z"
    },
    {
      "id": "message_uuid_2",
      "externalMessageId": "wa_message_id_2",
      "direction": "outbound",
      "type": "text",
      "body": "Claro, te atiendo con gusto.",
      "mediaUrl": null,
      "status": "sent",
      "sentByUser": {
        "id": "user_uuid",
        "name": "Ana Pérez"
      },
      "createdAt": "2026-07-04T12:01:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## 7.2 Enviar mensaje manual

```http
POST /api/conversations/:conversationId/messages
```

### Roles

```text
owner
admin
agent
```

### Descripción

Envía un mensaje desde el dashboard usando el WhatsApp Service API.

### Request para texto

```json
{
  "type": "text",
  "body": "Hola, con gusto te atiendo."
}
```

### Validaciones

- Conversación debe pertenecer al workspace.
- Usuario debe tener permiso para responder.
- Número de WhatsApp debe estar conectado.
- `body` requerido si `type = text`.
- No permitir mensaje vacío.
- Validar longitud máxima.

### Uso de TAKU

Endpoint externo documentado:

```http
POST https://api.wa.taku.lat/v1/account/connections/:id/messages
```

Headers:

```text
content-type: application/json
x-api-key: <TAKU_WA_API_KEY>
```

Body externo documentado:

```json
{
  "to": "5219931234567",
  "text": "Your order is ready."
}
```

Mapeo:

```text
:id   = whatsapp_accounts.external_instance_id
to    = contacts.phone_number
text  = request.body
```

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "message_uuid",
    "externalMessageId": "wa_message_id",
    "direction": "outbound",
    "type": "text",
    "body": "Hola, con gusto te atiendo.",
    "status": "sent",
    "sentByUser": {
      "id": "user_uuid",
      "name": "Ana Pérez"
    },
    "createdAt": "2026-07-04T12:05:00.000Z"
  }
}
```

### Errores

```text
400 EMPTY_MESSAGE
403 INSUFFICIENT_PERMISSIONS
404 CONVERSATION_NOT_FOUND
409 WHATSAPP_ACCOUNT_DISCONNECTED
502 WHATSAPP_SERVICE_ERROR
```

---

## 7.3 Enviar archivo adjunto

```http
POST /api/conversations/:conversationId/messages/attachments
```

### Estado MVP

Opcional. Preparar endpoint, pero puede no implementarse al inicio si el WhatsApp Service API sólo soporta texto públicamente.

### Content-Type

```text
multipart/form-data
```

### Campos

```text
file
caption
type=image|document|audio|video
```

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "message_uuid",
    "direction": "outbound",
    "type": "document",
    "body": "Cotización adjunta",
    "mediaUrl": "https://...",
    "status": "sent"
  }
}
```

---

## 7.4 Reintentar mensaje fallido

```http
POST /api/messages/:id/retry
```

### Roles

```text
owner
admin
agent
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "message_uuid",
    "status": "queued"
  }
}
```

---

# 8. Business Hours API

## 8.1 Obtener horarios

```http
GET /api/business-hours
```

### Roles

```text
owner
admin
```

### Query params

```text
whatsappAccountId=whatsapp_account_uuid
```

Si no se envía `whatsappAccountId`, devolver horario general del workspace.

### Response 200

```json
{
  "ok": true,
  "data": {
    "scope": "workspace",
    "whatsappAccountId": null,
    "timezone": "America/Mexico_City",
    "currentStatus": {
      "isOpen": true,
      "label": "Abierto ahora",
      "nextChangeAt": "2026-07-04T18:00:00.000Z"
    },
    "days": [
      {
        "dayOfWeek": 1,
        "isClosed": false,
        "opensAt": "09:00",
        "closesAt": "18:00"
      },
      {
        "dayOfWeek": 2,
        "isClosed": false,
        "opensAt": "09:00",
        "closesAt": "18:00"
      }
    ]
  }
}
```

---

## 8.2 Guardar horarios

```http
PUT /api/business-hours
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "whatsappAccountId": null,
  "timezone": "America/Mexico_City",
  "days": [
    {
      "dayOfWeek": 1,
      "isClosed": false,
      "opensAt": "09:00",
      "closesAt": "18:00"
    },
    {
      "dayOfWeek": 2,
      "isClosed": false,
      "opensAt": "09:00",
      "closesAt": "18:00"
    },
    {
      "dayOfWeek": 0,
      "isClosed": true,
      "opensAt": null,
      "closesAt": null
    }
  ]
}
```

### Validaciones

- `dayOfWeek` entre 0 y 6.
- Si `isClosed = false`, `opensAt` y `closesAt` requeridos.
- `closesAt` debe ser posterior a `opensAt`.
- No permitir duplicar `dayOfWeek`.
- Si `whatsappAccountId` viene, debe pertenecer al workspace.

### Response 200

```json
{
  "ok": true,
  "data": {
    "message": "Horario actualizado correctamente."
  }
}
```

---

## 8.3 Obtener estado actual de horario

```http
GET /api/business-hours/status
```

### Query params

```text
whatsappAccountId=whatsapp_account_uuid
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "isOpen": false,
    "label": "Fuera de horario",
    "nextOpenAt": "2026-07-05T09:00:00.000Z",
    "timezone": "America/Mexico_City"
  }
}
```

---

# 9. Bot Settings API

La configuración visible al usuario vive en nuestra plataforma, pero la ejecución o procesamiento puede delegarse al **Bot Service API**.

---

## 9.1 Obtener configuración del bot

```http
GET /api/bot-settings
```

### Roles

```text
owner
admin
```

### Query params

```text
whatsappAccountId=whatsapp_account_uuid
```

Si no se envía, obtener configuración general del workspace.

### Response 200

```json
{
  "ok": true,
  "data": {
    "scope": "workspace",
    "whatsappAccountId": null,
    "enabled": true,
    "afterHoursEnabled": true,
    "afterHoursMessage": "Gracias por escribir. Estamos fuera de horario.",
    "rulesEnabled": true,
    "aiEnabled": false,
    "externalBotId": "bot_external_id",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 9.2 Actualizar configuración del bot

```http
PATCH /api/bot-settings
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "whatsappAccountId": null,
  "enabled": true,
  "afterHoursEnabled": true,
  "afterHoursMessage": "Gracias por escribir. Estamos fuera de horario. Te responderemos el siguiente día hábil.",
  "rulesEnabled": true,
  "aiEnabled": false
}
```

### Validaciones

- Si `afterHoursEnabled = true`, `afterHoursMessage` requerido.
- `afterHoursMessage` máximo 1,000 caracteres.
- Si `whatsappAccountId` viene, debe pertenecer al workspace.
- `aiEnabled` puede rechazarse si el plan no lo permite o si no está implementado.

### Integración con Bot Service API

Después de guardar localmente, Express puede sincronizar configuración con el Bot Service API.

### Response 200

```json
{
  "ok": true,
  "data": {
    "enabled": true,
    "afterHoursEnabled": true,
    "rulesEnabled": true,
    "aiEnabled": false,
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 9.3 Probar respuesta fuera de horario

```http
POST /api/bot-settings/test-after-hours
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "whatsappAccountId": "whatsapp_account_uuid",
  "incomingText": "Hola",
  "at": "2026-07-04T21:00:00.000Z"
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "wouldRespond": true,
    "reason": "Actualmente está fuera de horario.",
    "responseText": "Gracias por escribir. Estamos fuera de horario. Te responderemos mañana a partir de las 9:00 AM."
  }
}
```

---

# 10. Automation Rules API

## 10.1 Listar reglas

```http
GET /api/automation-rules
```

### Roles

```text
owner
admin
```

### Query params

```text
whatsappAccountId=whatsapp_account_uuid
enabled=true
search=horario
page=1
pageSize=20
```

### Response 200

```json
{
  "ok": true,
  "data": [
    {
      "id": "rule_uuid",
      "keyword": "horario",
      "matchType": "contains",
      "responseText": "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
      "enabled": true,
      "scope": "workspace",
      "whatsappAccount": null,
      "createdAt": "2026-07-04T12:00:00.000Z",
      "updatedAt": "2026-07-04T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 10.2 Crear regla

```http
POST /api/automation-rules
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "whatsappAccountId": null,
  "keyword": "horario",
  "matchType": "contains",
  "responseText": "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
  "enabled": true,
  "avoidIfAgentResponded": true
}
```

### Validaciones

- `keyword` requerido.
- `keyword` máximo 80 caracteres.
- `matchType` permitido: `exact`, `contains`, `starts_with`.
- `responseText` requerido.
- `responseText` máximo 1,000 caracteres.
- No duplicar palabra clave con mismo `matchType` y mismo scope.
- Si `whatsappAccountId` viene, debe pertenecer al workspace.

### Response 201

```json
{
  "ok": true,
  "data": {
    "id": "rule_uuid",
    "keyword": "horario",
    "matchType": "contains",
    "responseText": "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
    "enabled": true,
    "createdAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 10.3 Obtener regla

```http
GET /api/automation-rules/:id
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "rule_uuid",
    "keyword": "horario",
    "matchType": "contains",
    "responseText": "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
    "enabled": true,
    "whatsappAccountId": null,
    "createdAt": "2026-07-04T12:00:00.000Z",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 10.4 Actualizar regla

```http
PATCH /api/automation-rules/:id
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "keyword": "horarios",
  "matchType": "contains",
  "responseText": "Nuestro horario actualizado es de lunes a viernes de 9:00 AM a 6:00 PM.",
  "enabled": true
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "rule_uuid",
    "keyword": "horarios",
    "matchType": "contains",
    "responseText": "Nuestro horario actualizado es de lunes a viernes de 9:00 AM a 6:00 PM.",
    "enabled": true,
    "updatedAt": "2026-07-04T12:30:00.000Z"
  }
}
```

---

## 10.5 Eliminar regla

```http
DELETE /api/automation-rules/:id
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "rule_uuid",
    "deleted": true
  }
}
```

---

## 10.6 Probar regla

```http
POST /api/automation-rules/test
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "whatsappAccountId": null,
  "incomingText": "Hola, ¿cuál es su horario?"
}
```

### Response cuando coincide

```json
{
  "ok": true,
  "data": {
    "matched": true,
    "rule": {
      "id": "rule_uuid",
      "keyword": "horario",
      "matchType": "contains"
    },
    "responseText": "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM."
  }
}
```

### Response cuando no coincide

```json
{
  "ok": true,
  "data": {
    "matched": false,
    "rule": null,
    "responseText": null
  }
}
```

---

# 11. Dashboard / Overview API

## 11.1 Obtener resumen de inicio

```http
GET /api/dashboard/overview
```

### Roles

```text
owner
admin
agent
```

### Response para owner/admin

```json
{
  "ok": true,
  "data": {
    "metrics": {
      "openConversations": 12,
      "unansweredMessages": 5,
      "connectedWhatsappAccounts": 2,
      "disconnectedWhatsappAccounts": 1,
      "activeAutomationRules": 4
    },
    "alerts": [
      {
        "type": "warning",
        "code": "WHATSAPP_ACCOUNT_DISCONNECTED",
        "message": "El número Soporte está desconectado.",
        "action": {
          "label": "Reconectar",
          "href": "/whatsapp-accounts/whatsapp_account_uuid/connect"
        }
      }
    ],
    "recentActivity": [
      {
        "id": "activity_id",
        "type": "message.sent",
        "message": "Ana respondió una conversación.",
        "createdAt": "2026-07-04T12:00:00.000Z"
      }
    ]
  }
}
```

### Response para agent

```json
{
  "ok": true,
  "data": {
    "metrics": {
      "myOpenConversations": 3,
      "unassignedConversations": 5,
      "unansweredMessages": 4
    },
    "shortcuts": [
      {
        "label": "Ver mis conversaciones",
        "href": "/conversations?assignedTo=me"
      },
      {
        "label": "Ver sin responder",
        "href": "/conversations?unread=true"
      }
    ]
  }
}
```

---

# 12. Profile API

## 12.1 Obtener perfil personal

```http
GET /api/profile
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "name": "Ana Pérez",
    "email": "ana@empresa.com",
    "status": "active"
  }
}
```

---

## 12.2 Actualizar perfil personal

```http
PATCH /api/profile
```

### Request

```json
{
  "name": "Ana María Pérez"
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "id": "user_uuid",
    "name": "Ana María Pérez",
    "email": "ana@empresa.com",
    "updatedAt": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 12.3 Cambiar contraseña

```http
POST /api/profile/change-password
```

### Request

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123",
  "newPasswordConfirmation": "newPassword123"
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "message": "Contraseña actualizada correctamente."
  }
}
```

---

# 13. Preferences API

## 13.1 Obtener preferencias

```http
GET /api/preferences
```

### Roles

```text
owner
admin
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "defaultConversationStatus": "open",
    "autoCloseEnabled": false,
    "autoCloseAfterHours": null,
    "showBotMessages": true,
    "agentsCanCloseConversations": true,
    "agentsCanReassignConversations": false
  }
}
```

---

## 13.2 Actualizar preferencias

```http
PATCH /api/preferences
```

### Roles

```text
owner
admin
```

### Request

```json
{
  "defaultConversationStatus": "open",
  "autoCloseEnabled": false,
  "autoCloseAfterHours": null,
  "showBotMessages": true,
  "agentsCanCloseConversations": true,
  "agentsCanReassignConversations": false
}
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "message": "Preferencias actualizadas correctamente."
  }
}
```

---

# 14. Webhooks API

Los webhooks son endpoints del backend Express.js que reciben eventos de servicios externos.

No deben ser llamados por el frontend.

---

# 14.1 Webhook general de WhatsApp Service

```http
POST /api/webhooks/whatsapp
```

### Auth

No usa JWT de usuario.

Debe validar firma del servicio.

### Headers sugeridos

```text
X-Service-Name: taku-wa
X-Signature: <signature>
X-Timestamp: <unix_timestamp>
Content-Type: application/json
```

### Request genérico sugerido

```json
{
  "event": "message.received",
  "connectionId": "wa_abc123",
  "timestamp": "2026-07-04T12:00:00.000Z",
  "data": {}
}
```

### Validaciones

- Validar firma.
- Validar timestamp.
- Validar que `connectionId` exista como `external_instance_id`.
- Resolver `workspace_id` desde `connectionId`.
- Nunca confiar en un `workspaceId` recibido por webhook externo.

---

## Eventos esperados de WhatsApp Service

La documentación pública menciona eventos como:

```text
message.received
message.sent
status.changed
connection open
```

Para nuestra plataforma se recomienda soportar estos eventos normalizados:

```text
message.received
message.sent
message.delivered
message.read
message.failed
connection.status_changed
connection.qr_updated
connection.connected
connection.disconnected
```

---

## 14.2 Evento: mensaje recibido

```http
POST /api/webhooks/whatsapp
```

### Request sugerido

```json
{
  "event": "message.received",
  "connectionId": "wa_abc123",
  "timestamp": "2026-07-04T12:00:00.000Z",
  "data": {
    "messageId": "wa_message_id",
    "from": "5219931234567",
    "to": "5219930000000",
    "type": "text",
    "text": "Hola, necesito una cotización",
    "media": null,
    "profileName": "Juan Pérez"
  }
}
```

### Proceso interno

1. Validar firma.
2. Buscar `whatsapp_accounts.external_instance_id = connectionId`.
3. Obtener `workspace_id`.
4. Crear o actualizar contacto.
5. Crear o recuperar conversación.
6. Guardar mensaje inbound.
7. Actualizar `last_message` de conversación.
8. Emitir WebSocket `message.created`.
9. Evaluar automatización:
   - horario
   - reglas
   - bot settings
10. Si aplica, llamar Bot Service API.
11. Si Bot Service devuelve respuesta, enviar por WhatsApp Service API.
12. Guardar mensaje automático.

### Response 200

```json
{
  "ok": true,
  "data": {
    "received": true
  }
}
```

---

## 14.3 Evento: estado de mensaje

```http
POST /api/webhooks/whatsapp
```

### Request sugerido

```json
{
  "event": "message.delivered",
  "connectionId": "wa_abc123",
  "timestamp": "2026-07-04T12:01:00.000Z",
  "data": {
    "messageId": "wa_message_id",
    "status": "delivered"
  }
}
```

### Proceso

1. Validar firma.
2. Resolver workspace por `connectionId`.
3. Buscar mensaje por `external_message_id`.
4. Actualizar status.
5. Emitir `message.updated`.

---

## 14.4 Evento: cambio de estado de conexión

```http
POST /api/webhooks/whatsapp
```

### Request sugerido

```json
{
  "event": "connection.status_changed",
  "connectionId": "wa_abc123",
  "timestamp": "2026-07-04T12:01:00.000Z",
  "data": {
    "status": "connected",
    "phoneNumber": "5219930000000",
    "displayName": "Ventas"
  }
}
```

### Mapeo de estados

| Estado externo | Estado interno |
| -------------- | -------------- |
| open           | connected      |
| connected      | connected      |
| close          | disconnected   |
| disconnected   | disconnected   |
| connecting     | connecting     |
| qr             | qr_required    |
| failed         | failed         |

### Response 200

```json
{
  "ok": true,
  "data": {
    "received": true
  }
}
```

---

## 14.5 Webhook general de Bot Service

```http
POST /api/webhooks/bot
```

### Headers sugeridos

```text
X-Service-Name: bot-service
X-Signature: <signature>
X-Timestamp: <unix_timestamp>
Content-Type: application/json
```

### Request genérico

```json
{
  "event": "bot.message_generated",
  "externalBotId": "bot_external_id",
  "timestamp": "2026-07-04T12:00:00.000Z",
  "data": {}
}
```

---

## 14.6 Evento: mensaje generado por bot

```json
{
  "event": "bot.message_generated",
  "externalBotId": "bot_external_id",
  "timestamp": "2026-07-04T12:00:00.000Z",
  "data": {
    "conversationId": "conversation_uuid",
    "text": "Gracias por escribir. Estamos fuera de horario.",
    "reason": "after_hours"
  }
}
```

### Proceso

1. Validar firma.
2. Validar que `externalBotId` exista.
3. Resolver workspace.
4. Validar conversación.
5. Enviar mensaje usando WhatsApp Service API.
6. Guardar mensaje con direction `bot`.
7. Emitir `message.created`.

---

# 15. Internal Service Clients

Esta sección no es API pública del frontend, pero define cómo Express debe hablar con los servicios externos.

---

# 15.1 TAKU WhatsApp Service Client

## Configuración

```text
TAKU_WA_BASE_URL=https://api.wa.taku.lat
TAKU_WA_API_KEY=<secret>
```

## Métodos internos sugeridos

```ts
takuClient.getAccountMe();
takuClient.listConnections();
takuClient.getConnectionQr(connectionId);
takuClient.sendTextMessage(connectionId, to, text);
takuClient.createWebhookSubscription(url, events);
```

---

## getAccountMe

### TAKU endpoint

```http
GET /v1/account/me
```

### Uso

Leer límites y uso de cuenta.

### Response interno esperado

```ts
{
  accountId: string;
  plan: string;
  limits: {
    connections: number;
    messagesPerDay: number;
  }
  usage: {
    connections: number;
    messagesToday: number;
  }
}
```

---

## listConnections

### TAKU endpoint

```http
GET /v1/account/connections
```

### Uso

Sincronizar conexiones remotas con registros locales.

### Response interno esperado

```ts
{
  connections: Array<{
    id: string;
    status: string;
    phoneNumber?: string;
    displayName?: string;
    updatedAt?: string;
  }>;
}
```

---

## getConnectionQr

### TAKU endpoint

```http
GET /v1/account/connections/:id/qr
```

### Uso

Obtener QR para conectar número.

### Response interno esperado

```ts
{
  payload: string;
  imageUrl?: string;
  imageBase64?: string;
  expiresAt?: string;
}
```

---

## sendTextMessage

### TAKU endpoint

```http
POST /v1/account/connections/:id/messages
```

### Request externo documentado

```json
{
  "to": "5219931234567",
  "text": "Your order is ready."
}
```

### Response interno esperado

```ts
{
  messageId?: string;
  status: 'sent' | 'queued' | 'failed';
  raw?: unknown;
}
```

---

## createWebhookSubscription

### TAKU endpoint

```http
POST /v1/account/webhooks/subscriptions
```

### Request propuesto

La documentación pública sólo indica que este endpoint sirve para recibir inbound events.  
Se propone este contrato interno hasta confirmar payload real:

```json
{
  "url": "https://api.midominio.com/api/webhooks/whatsapp",
  "events": ["message.received", "message.sent", "status.changed"],
  "secret": "webhook_secret"
}
```

---

# 15.2 Bot Service Client

El Bot Service API no está documentado en la página pública.  
Se propone una interfaz interna mínima para el MVP.

## Configuración

```text
BOT_SERVICE_BASE_URL=https://bot.<dominio>
BOT_SERVICE_API_KEY=<secret>
```

---

## Métodos internos sugeridos

```ts
botClient.syncSettings(payload);
botClient.evaluateAfterHours(payload);
botClient.evaluateRules(payload);
botClient.generateReply(payload);
```

---

## syncSettings

```http
POST /bot/settings/sync
```

### Request propuesto

```json
{
  "workspaceId": "workspace_uuid",
  "whatsappAccountId": "whatsapp_account_uuid",
  "enabled": true,
  "afterHoursEnabled": true,
  "afterHoursMessage": "Gracias por escribir. Estamos fuera de horario.",
  "rulesEnabled": true,
  "aiEnabled": false
}
```

---

## evaluateAfterHours

```http
POST /bot/evaluate/after-hours
```

### Request propuesto

```json
{
  "workspaceId": "workspace_uuid",
  "whatsappAccountId": "whatsapp_account_uuid",
  "conversationId": "conversation_uuid",
  "contact": {
    "phoneNumber": "5219931234567",
    "name": "Juan Pérez"
  },
  "incomingMessage": {
    "text": "Hola",
    "createdAt": "2026-07-04T21:00:00.000Z"
  },
  "businessHours": {},
  "settings": {}
}
```

### Response propuesto

```json
{
  "shouldRespond": true,
  "responseText": "Gracias por escribir. Estamos fuera de horario.",
  "reason": "after_hours"
}
```

---

## evaluateRules

```http
POST /bot/evaluate/rules
```

### Request propuesto

```json
{
  "workspaceId": "workspace_uuid",
  "whatsappAccountId": "whatsapp_account_uuid",
  "conversationId": "conversation_uuid",
  "incomingText": "¿Cuál es su horario?",
  "rules": [
    {
      "id": "rule_uuid",
      "keyword": "horario",
      "matchType": "contains",
      "responseText": "Nuestro horario es..."
    }
  ]
}
```

### Response propuesto

```json
{
  "matched": true,
  "ruleId": "rule_uuid",
  "responseText": "Nuestro horario es..."
}
```

---

# 16. Realtime API

El backend debe emitir eventos de tiempo real al frontend.

Puede usarse:

```text
Socket.IO
```

o WebSocket nativo.

---

## Autenticación WebSocket

El cliente debe enviar:

```text
accessToken
workspaceId
```

El servidor debe validar:

- Token.
- Usuario activo.
- Membresía activa en workspace.
- Rol.

Luego une el socket al room:

```text
workspace:{workspaceId}
```

---

## Eventos servidor -> cliente

```text
conversation.created
conversation.updated
message.created
message.updated
whatsapp.status.updated
whatsapp.qr.updated
bot.reply.created
user.updated
```

---

## Evento: message.created

```json
{
  "event": "message.created",
  "data": {
    "conversationId": "conversation_uuid",
    "message": {
      "id": "message_uuid",
      "direction": "inbound",
      "type": "text",
      "body": "Hola",
      "status": "received",
      "createdAt": "2026-07-04T12:00:00.000Z"
    }
  }
}
```

---

## Evento: conversation.updated

```json
{
  "event": "conversation.updated",
  "data": {
    "id": "conversation_uuid",
    "status": "open",
    "lastMessageBody": "Hola",
    "lastMessageAt": "2026-07-04T12:00:00.000Z",
    "unreadCount": 1
  }
}
```

---

## Evento: whatsapp.status.updated

```json
{
  "event": "whatsapp.status.updated",
  "data": {
    "whatsappAccountId": "whatsapp_account_uuid",
    "status": "connected",
    "phoneNumber": "5219930000000"
  }
}
```

---

## Evento: whatsapp.qr.updated

```json
{
  "event": "whatsapp.qr.updated",
  "data": {
    "whatsappAccountId": "whatsapp_account_uuid",
    "status": "qr_required",
    "qr": {
      "imageUrl": "data:image/png;base64,...",
      "expiresAt": "2026-07-04T12:05:00.000Z"
    }
  }
}
```

---

# 17. Health API

## 17.1 Health general

```http
GET /api/health
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-04T12:00:00.000Z"
  }
}
```

---

## 17.2 Readiness

```http
GET /api/health/ready
```

### Debe revisar

- PostgreSQL.
- WhatsApp Service API.
- Bot Service API, si aplica.
- Redis, si se usa.

### Response 200

```json
{
  "ok": true,
  "data": {
    "status": "ready",
    "services": {
      "postgres": "ok",
      "whatsappService": "ok",
      "botService": "ok",
      "realtime": "ok"
    }
  }
}
```

### Response 503

```json
{
  "ok": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Uno o más servicios no están disponibles.",
    "details": {
      "postgres": "ok",
      "whatsappService": "down",
      "botService": "ok"
    }
  }
}
```

---

# 18. Errores estándar

## Auth

```text
INVALID_CREDENTIALS
UNAUTHORIZED
TOKEN_EXPIRED
FORBIDDEN
USER_DISABLED
WORKSPACE_REQUIRED
WORKSPACE_FORBIDDEN
```

## Validation

```text
VALIDATION_ERROR
INVALID_EMAIL
INVALID_ROLE
INVALID_STATUS
INVALID_TIMEZONE
INVALID_PHONE_NUMBER
```

## Workspace

```text
WORKSPACE_NOT_FOUND
WORKSPACE_SUSPENDED
WORKSPACE_CANCELLED
SLUG_ALREADY_EXISTS
```

## Users

```text
USER_NOT_FOUND
USER_ALREADY_EXISTS
LAST_OWNER_CANNOT_BE_REMOVED
INSUFFICIENT_ROLE
```

## WhatsApp

```text
WHATSAPP_ACCOUNT_NOT_FOUND
WHATSAPP_ACCOUNT_DISCONNECTED
WHATSAPP_ACCOUNT_ALREADY_CONNECTED
WHATSAPP_QR_EXPIRED
WHATSAPP_SERVICE_ERROR
WHATSAPP_SERVICE_UNAVAILABLE
WHATSAPP_SEND_FAILED
```

## Conversations

```text
CONVERSATION_NOT_FOUND
CONVERSATION_CLOSED
CONTACT_NOT_FOUND
MESSAGE_NOT_FOUND
EMPTY_MESSAGE
```

## Automation

```text
BOT_SETTINGS_NOT_FOUND
AFTER_HOURS_MESSAGE_REQUIRED
AUTOMATION_RULE_NOT_FOUND
DUPLICATED_AUTOMATION_RULE
BOT_SERVICE_ERROR
```

---

# 19. Seguridad obligatoria

## 19.1 Autenticación

Todos los endpoints privados deben usar:

```text
Authorization: Bearer <token>
```

Excepto:

- `/auth/login`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/webhooks/*`
- `/health`

---

## 19.2 Multi-tenant

Todo endpoint operativo debe:

1. Leer usuario desde token.
2. Leer workspace activo.
3. Validar membership.
4. Resolver rol.
5. Filtrar queries por `workspace_id`.

---

## 19.3 IDs recibidos por frontend

Nunca buscar recursos sólo por `id`.

Ejemplo incorrecto:

```ts
findConversationById(conversationId);
```

Ejemplo correcto:

```ts
findConversationByIdAndWorkspace(conversationId, workspaceId);
```

---

## 19.4 Webhooks

Los webhooks deben:

- Validar firma.
- Validar timestamp.
- Evitar replay attacks.
- Resolver workspace desde IDs externos.
- No aceptar `workspaceId` del payload como fuente de verdad.

---

## 19.5 Secretos

Nunca exponer al frontend:

```text
TAKU_WA_API_KEY
BOT_SERVICE_API_KEY
WEBHOOK_SECRET
JWT_SECRET
DATABASE_URL
```

---

# 20. Rate limits recomendados

## Login

```text
5 intentos por minuto por IP/email
```

## Envío de mensajes

```text
60 mensajes por minuto por workspace
```

Ajustable por plan.

## Webhooks

Rate limit más alto, pero validado con firma.

## QR

```text
10 solicitudes por minuto por número
```

---

# 21. Auditoría

Registrar audit logs para:

```text
auth.login
auth.logout
workspace.updated
user.invited
user.updated
user.disabled
whatsapp_account.created
whatsapp_account.connected
whatsapp_account.disconnected
whatsapp_account.qr_requested
message.sent
conversation.assigned
conversation.status_updated
business_hours.updated
bot_settings.updated
automation_rule.created
automation_rule.updated
automation_rule.deleted
webhook.invalid_signature
```

---

# 22. Orden recomendado de implementación backend

## Fase 1: Base operativa

1. Auth.
2. Workspaces.
3. Memberships.
4. Middleware multi-tenant.
5. Users.
6. Health.

## Fase 2: WhatsApp accounts

7. CRUD de números.
8. Cliente TAKU.
9. Obtener QR.
10. Sincronizar estado.
11. Webhook WhatsApp.

## Fase 3: Inbox

12. Contacts.
13. Conversations.
14. Messages.
15. Enviar mensaje manual.
16. WebSockets.

## Fase 4: Automatización

17. Business Hours.
18. Bot Settings.
19. Automation Rules.
20. Bot Service Client.
21. Respuesta fuera de horario.

## Fase 5: Pulido

22. Dashboard overview.
23. Audit logs.
24. Preferences.
25. Tests de aislamiento multi-tenant.
26. Rate limits.

---

# 23. Pruebas mínimas requeridas

## Auth

- Login correcto.
- Login incorrecto.
- Token expirado.
- Usuario disabled.

## Multi-tenant

- Usuario no puede ver conversaciones de otro workspace.
- Usuario no puede enviar mensaje en conversación de otro workspace.
- Usuario no puede editar número de otro workspace.
- Header `X-Workspace-Id` inválido responde 403.

## Roles

- Agent no puede crear número.
- Agent no puede editar automatización.
- Admin no puede remover último owner.
- Owner sí puede invitar admin.

## WhatsApp Service

- QR se obtiene correctamente.
- Error de WhatsApp Service regresa 502.
- Mensaje manual llama endpoint externo correcto.
- Número desconectado bloquea envío.

## Webhooks

- Firma inválida responde 401.
- Evento message.received crea contacto, conversación y mensaje.
- Evento status_changed actualiza número.
- Evento message.delivered actualiza mensaje.

## Realtime

- Nuevo mensaje emite sólo al workspace correcto.
- No se emite globalmente.
- Usuario sin membership no puede unirse al room.

## Automatización

- Fuera de horario responde si está activo.
- Dentro de horario no responde.
- Regla por palabra clave responde si coincide.
- Bot apagado no responde.

---

# 24. Criterio de aceptación del punto 5

Este documento estará implementado correctamente cuando:

1. El frontend Next.js pueda consumir todos los endpoints necesarios para el MVP.
2. El backend Express pueda conectar con TAKU WhatsApp Bridge.
3. El backend pueda obtener QR para conectar números.
4. El backend pueda enviar mensajes usando TAKU.
5. El backend pueda recibir eventos entrantes vía webhook.
6. Los mensajes entrantes se conviertan en contactos, conversaciones y mensajes.
7. El dashboard reciba eventos en tiempo real.
8. La automatización fuera de horario pueda responder usando el Bot Service.
9. Todos los recursos estén aislados por workspace.
10. Los roles limiten correctamente las acciones.

---

# 25. Resumen de endpoints internos

## Auth

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Workspaces

```text
GET   /api/workspaces
GET   /api/workspaces/current
PATCH /api/workspaces/current
```

## Users

```text
GET   /api/users
POST  /api/users/invitations
GET   /api/users/:id
PATCH /api/users/:id
POST  /api/users/:id/resend-invitation
POST  /api/users/:id/disable
POST  /api/users/:id/enable
```

## WhatsApp Accounts

```text
GET    /api/whatsapp-accounts
POST   /api/whatsapp-accounts
GET    /api/whatsapp-accounts/:id
PATCH  /api/whatsapp-accounts/:id
POST   /api/whatsapp-accounts/:id/connect
GET    /api/whatsapp-accounts/:id/qr
POST   /api/whatsapp-accounts/:id/qr/regenerate
POST   /api/whatsapp-accounts/:id/disconnect
POST   /api/whatsapp-accounts/:id/sync
DELETE /api/whatsapp-accounts/:id
```

## Contacts

```text
GET   /api/contacts
GET   /api/contacts/:id
PATCH /api/contacts/:id
```

## Conversations

```text
GET   /api/conversations
GET   /api/conversations/:id
PATCH /api/conversations/:id/status
PATCH /api/conversations/:id/assignment
POST  /api/conversations/:id/read
```

## Messages

```text
GET  /api/conversations/:conversationId/messages
POST /api/conversations/:conversationId/messages
POST /api/conversations/:conversationId/messages/attachments
POST /api/messages/:id/retry
```

## Business Hours

```text
GET /api/business-hours
PUT /api/business-hours
GET /api/business-hours/status
```

## Bot Settings

```text
GET   /api/bot-settings
PATCH /api/bot-settings
POST  /api/bot-settings/test-after-hours
```

## Automation Rules

```text
GET    /api/automation-rules
POST   /api/automation-rules
GET    /api/automation-rules/:id
PATCH  /api/automation-rules/:id
DELETE /api/automation-rules/:id
POST   /api/automation-rules/test
```

## Dashboard

```text
GET /api/dashboard/overview
```

## Profile

```text
GET   /api/profile
PATCH /api/profile
POST  /api/profile/change-password
```

## Preferences

```text
GET   /api/preferences
PATCH /api/preferences
```

## Webhooks

```text
POST /api/webhooks/whatsapp
POST /api/webhooks/bot
```

## Health

```text
GET /api/health
GET /api/health/ready
```

---

# 26. Resumen de endpoints externos TAKU

```text
POST /v1/public/signup
GET  /v1/account/me
GET  /v1/account/connections
GET  /v1/account/connections/:id/qr
POST /v1/account/connections/:id/messages
POST /v1/account/webhooks/subscriptions
```

## Ejemplo externo documentado para enviar mensaje

```bash
curl -X POST https://api.wa.taku.lat/v1/account/connections/wa_abc123/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $TAKU_WA_API_KEY" \
  -d '{
    "to": "5219931234567",
    "text": "Your order is ready."
  }'
```

---

# 27. Notas finales

Este documento define el contrato completo necesario para construir el backend del MVP.

Puntos a confirmar con la implementación real del WhatsApp Service API:

1. Payload exacto de QR.
2. Payload exacto de listado de conexiones.
3. Payload exacto de webhooks.
4. Existencia o no de endpoint externo para crear conexión.
5. Existencia o no de endpoint externo para desconectar conexión.
6. Payload exacto de respuesta al enviar mensaje.
7. Soporte de media/documentos además de texto.

Mientras esos detalles se confirman, el backend debe encapsular toda comunicación externa dentro de un cliente interno:

```text
services/whatsapp-service-client
```

Así, si la API externa cambia, el resto del backend y el frontend no tendrán que cambiar.
