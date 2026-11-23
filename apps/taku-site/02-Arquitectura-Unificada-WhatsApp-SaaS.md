# Arquitectura Unificada - Plataforma SaaS de WhatsApp

## Contexto

La plataforma será un producto SaaS para administrar conversaciones de WhatsApp Business desde un dashboard web.

La solución **no reconstruye** el servicio de WhatsApp ni el servicio de bot. Ambos ya existen y serán consumidos como APIs por la nueva plataforma.

---

# Stack definido

## Frontend

- Next.js
- React
- Dashboard web
- Panel administrativo
- Chat en tiempo real

## Backend principal

- Express.js
- Node.js
- API central de la plataforma
- Orquestación entre frontend, base de datos y servicios externos

## Base de datos

- PostgreSQL

## Servicios consumidos

- WhatsApp Service API
- Bot Service API

---

# Principio arquitectónico

La plataforma SaaS será la capa de administración, operación y orquestación.

No debe encargarse directamente de:

- Mantener sesiones de WhatsApp.
- Ejecutar Baileys.
- Procesar internamente la lógica del bot.
- Ejecutar automatizaciones complejas dentro del dashboard.

Eso pertenece a los servicios existentes.

La plataforma sí debe encargarse de:

- Empresas / workspaces.
- Usuarios.
- Roles.
- Números conectados.
- Conversaciones.
- Mensajes.
- Configuración visible para el cliente.
- Historial.
- Permisos.
- Comunicación con APIs externas.
- Dashboard.

---

# Diagrama general

```text
Usuario / Agente
      |
      v
Next.js Dashboard
      |
      v
Express.js API Principal
      |
      +--------------------+
      |                    |
      v                    v
PostgreSQL          Servicios existentes
                          |
              +-----------+------------+
              |                        |
              v                        v
     WhatsApp Service API       Bot Service API
```

---

# Responsabilidad de cada componente

## 1. Next.js Dashboard

Responsabilidades:

- Login.
- Selección de empresa.
- Administración de usuarios.
- Administración de números de WhatsApp.
- Mostrar estado de conexión.
- Mostrar código QR para conectar número.
- Mostrar lista de conversaciones.
- Mostrar mensajes.
- Permitir responder desde el navegador.
- Configurar horarios de atención.
- Configurar respuestas fuera de horario.
- Configurar reglas simples por palabra clave.

El dashboard no debe hablar directamente con WhatsApp Service API ni con Bot Service API.

Toda comunicación debe pasar por Express.js.

---

## 2. Express.js API Principal

Responsabilidades:

- Autenticación.
- Autorización.
- Multiempresa / multi-tenant.
- Control de permisos.
- Persistencia en PostgreSQL.
- Exponer API para el dashboard.
- Consumir WhatsApp Service API.
- Consumir Bot Service API.
- Normalizar datos.
- Guardar conversaciones y mensajes.
- Emitir eventos en tiempo real al frontend.
- Recibir webhooks de los servicios externos.
- Centralizar reglas de negocio de la plataforma SaaS.

Express.js será el cerebro administrativo de la plataforma.

---

## 3. PostgreSQL

Responsabilidades:

- Guardar empresas.
- Guardar usuarios.
- Guardar roles.
- Guardar números conectados.
- Guardar contactos.
- Guardar conversaciones.
- Guardar mensajes.
- Guardar configuraciones.
- Guardar horarios.
- Guardar reglas.
- Guardar auditoría básica.

PostgreSQL será la fuente principal de verdad para la plataforma SaaS.

---

## 4. WhatsApp Service API

Servicio ya existente.

Responsabilidades:

- Conectar números de WhatsApp.
- Generar QR.
- Mantener sesiones.
- Enviar mensajes.
- Recibir mensajes.
- Reportar estado de conexión.
- Notificar eventos vía webhook.

La plataforma SaaS debe consumir este servicio, no duplicarlo.

---

## 5. Bot Service API

Servicio ya existente.

Responsabilidades:

- Procesar automatizaciones.
- Responder fuera de horario.
- Ejecutar reglas por palabra clave.
- Enviar respuestas automáticas.
- Prepararse para IA futura.

La plataforma SaaS debe configurar y consumir este servicio, no duplicarlo.

---

# Flujo de conexión de número

```text
Usuario solicita conectar número
      |
      v
Next.js Dashboard
      |
      v
Express.js API
      |
      v
WhatsApp Service API
      |
      v
Genera QR
      |
      v
Express.js recibe QR
      |
      v
Next.js muestra QR
      |
      v
Usuario escanea QR
      |
      v
WhatsApp Service notifica conexión
      |
      v
Express.js actualiza PostgreSQL
      |
      v
Dashboard muestra "Conectado"
```

---

# Flujo de mensaje entrante

```text
Cliente escribe por WhatsApp
      |
      v
WhatsApp Service API recibe mensaje
      |
      v
Webhook hacia Express.js API
      |
      v
Express.js normaliza mensaje
      |
      v
Express.js guarda mensaje en PostgreSQL
      |
      v
Express.js actualiza conversación
      |
      v
Express.js notifica al dashboard en tiempo real
      |
      v
Dashboard muestra el nuevo mensaje
      |
      v
Express.js consulta configuración
      |
      v
Si aplica, envía evento al Bot Service API
      |
      v
Bot Service API decide si responde automáticamente
```

---

# Flujo de respuesta manual

```text
Agente escribe respuesta en dashboard
      |
      v
Next.js Dashboard
      |
      v
Express.js API
      |
      v
Express.js valida permisos
      |
      v
Express.js guarda mensaje pendiente
      |
      v
WhatsApp Service API envía mensaje
      |
      v
WhatsApp Service confirma envío
      |
      v
Express.js actualiza estado del mensaje
      |
      v
Dashboard muestra mensaje enviado
```

---

# Flujo de respuesta automática fuera de horario

```text
Cliente escribe por WhatsApp
      |
      v
WhatsApp Service API
      |
      v
Webhook hacia Express.js
      |
      v
Express.js guarda mensaje
      |
      v
Express.js revisa horario configurado
      |
      v
Si está fuera de horario:
      |
      v
Express.js envía contexto al Bot Service API
      |
      v
Bot Service genera respuesta
      |
      v
Express.js solicita envío a WhatsApp Service API
      |
      v
WhatsApp Service API envía respuesta
      |
      v
Express.js guarda respuesta en PostgreSQL
      |
      v
Dashboard muestra la respuesta automática
```

---

# Entidades principales

## Workspace

Representa a una empresa cliente.

Campos sugeridos:

```text
id
name
slug
status
timezone
plan
created_at
updated_at
```

---

## User

Usuario que entra al dashboard.

Campos sugeridos:

```text
id
workspace_id
name
email
password_hash
role
status
created_at
updated_at
```

Roles iniciales:

- owner
- admin
- agent

---

## WhatsAppAccount

Número de WhatsApp conectado a una empresa.

Campos sugeridos:

```text
id
workspace_id
external_instance_id
phone_number
display_name
status
qr_code
last_connected_at
created_at
updated_at
```

`external_instance_id` debe mapear el registro local con la instancia del WhatsApp Service API.

---

## Contact

Persona que escribe a alguno de los números conectados.

Campos sugeridos:

```text
id
workspace_id
phone_number
name
profile_picture_url
created_at
updated_at
```

---

## Conversation

Conversación entre un contacto y un número conectado.

Campos sugeridos:

```text
id
workspace_id
whatsapp_account_id
contact_id
status
last_message_body
last_message_at
assigned_user_id
created_at
updated_at
```

---

## Message

Mensaje enviado o recibido.

Campos sugeridos:

```text
id
workspace_id
conversation_id
whatsapp_account_id
contact_id
external_message_id
direction
type
body
media_url
status
sent_by_user_id
created_at
updated_at
```

Valores sugeridos para `direction`:

- inbound
- outbound
- system
- bot

Valores sugeridos para `type`:

- text
- image
- audio
- video
- document
- location
- sticker
- unknown

---

## BusinessHours

Horario de atención del workspace o de un número específico.

Campos sugeridos:

```text
id
workspace_id
whatsapp_account_id
day_of_week
opens_at
closes_at
is_closed
created_at
updated_at
```

`whatsapp_account_id` puede ser opcional si el horario aplica a toda la empresa.

---

## AutomationRule

Reglas simples por palabra clave.

Campos sugeridos:

```text
id
workspace_id
whatsapp_account_id
keyword
match_type
response_text
enabled
created_at
updated_at
```

Valores sugeridos para `match_type`:

- exact
- contains
- starts_with

---

## BotSettings

Configuración del bot por empresa o por número.

Campos sugeridos:

```text
id
workspace_id
whatsapp_account_id
enabled
after_hours_enabled
after_hours_message
rules_enabled
ai_enabled
created_at
updated_at
```

---

# API interna sugerida para el dashboard

## Autenticación

```text
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

## Workspaces

```text
GET    /workspaces/current
PATCH  /workspaces/current
```

## Usuarios

```text
GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id
```

## Números de WhatsApp

```text
GET    /whatsapp-accounts
POST   /whatsapp-accounts
GET    /whatsapp-accounts/:id
POST   /whatsapp-accounts/:id/connect
POST   /whatsapp-accounts/:id/disconnect
GET    /whatsapp-accounts/:id/qr
```

## Conversaciones

```text
GET /conversations
GET /conversations/:id
```

## Mensajes

```text
GET  /conversations/:id/messages
POST /conversations/:id/messages
```

## Horarios

```text
GET   /business-hours
PUT   /business-hours
```

## Automatizaciones

```text
GET    /automation-rules
POST   /automation-rules
PATCH  /automation-rules/:id
DELETE /automation-rules/:id
```

## Configuración del bot

```text
GET   /bot-settings
PATCH /bot-settings
```

---

# Webhooks externos

## Desde WhatsApp Service API hacia Express.js

Endpoints sugeridos:

```text
POST /webhooks/whatsapp/message-received
POST /webhooks/whatsapp/message-status
POST /webhooks/whatsapp/connection-status
POST /webhooks/whatsapp/qr-updated
```

## Desde Bot Service API hacia Express.js

Endpoints sugeridos:

```text
POST /webhooks/bot/message-generated
POST /webhooks/bot/automation-executed
POST /webhooks/bot/error
```

---

# Tiempo real

Para el MVP se recomienda usar WebSockets.

Eventos sugeridos:

```text
conversation.created
conversation.updated
message.created
message.updated
whatsapp.status.updated
whatsapp.qr.updated
bot.reply.created
```

El dashboard debe suscribirse al workspace activo y recibir únicamente eventos autorizados para ese workspace.

---

# Seguridad

Requisitos mínimos:

- JWT o sesión segura.
- Refresh tokens.
- Password hashing con bcrypt o argon2.
- Validación de permisos por workspace.
- Validación estricta de webhooks.
- Secret por servicio externo.
- Rate limiting.
- Logs de eventos importantes.
- Nunca exponer credenciales del WhatsApp Service ni del Bot Service al frontend.

---

# Multi-tenant

Todo registro principal debe pertenecer a un `workspace_id`.

Regla general:

```text
Ninguna consulta debe regresar datos sin filtrar por workspace_id.
```

Esto aplica a:

- Usuarios.
- Números de WhatsApp.
- Contactos.
- Conversaciones.
- Mensajes.
- Configuraciones.
- Reglas.
- Horarios.

---

# Alcance técnico del MVP

## Incluido

- Login.
- Workspace único por usuario.
- Roles básicos.
- Múltiples números por workspace.
- Conexión por QR.
- Estado de conexión.
- Lista de conversaciones.
- Vista de mensajes.
- Respuesta manual desde dashboard.
- WebSockets para nuevos mensajes.
- Configuración de horario.
- Mensaje automático fuera de horario.
- Reglas simples por palabra clave.
- Consumo de WhatsApp Service API.
- Consumo de Bot Service API.

## Fuera del MVP

- CRM avanzado.
- Campañas masivas.
- IA avanzada.
- Embudos.
- Reportes complejos.
- Facturación.
- Integraciones con terceros.
- Aplicación móvil.
- Marketplace de bots.
- API pública para clientes.

---

# Recomendación de estructura de proyectos

```text
whatsapp-saas/
  apps/
    web/                # Next.js dashboard
    api/                # Express.js API principal

  packages/
    shared/             # Tipos compartidos
    ui/                 # Componentes compartidos opcionales
    config/             # Configuración común opcional

  docs/
    01-propuesta-valor.md
    02-arquitectura.md
```

---

# Recomendación de carpetas para Express.js

```text
api/
  src/
    app.ts
    server.ts

    config/
    db/
    middleware/

    modules/
      auth/
      workspaces/
      users/
      whatsapp-accounts/
      contacts/
      conversations/
      messages/
      business-hours/
      automation-rules/
      bot-settings/
      webhooks/

    services/
      whatsapp-service-client/
      bot-service-client/

    realtime/
    utils/
```

---

# Recomendación de carpetas para Next.js

```text
web/
  src/
    app/
      login/
      dashboard/
      conversations/
      settings/
      whatsapp-accounts/

    components/
      layout/
      chat/
      forms/
      tables/

    lib/
      api-client.ts
      auth.ts
      realtime.ts

    hooks/
    types/
```

---

# Decisión clave

La plataforma debe mantenerse como una capa SaaS de administración y operación.

El WhatsApp Service API y el Bot Service API deben seguir siendo servicios separados y consumidos mediante contratos claros.

Esto permitirá:

- Reutilizar infraestructura existente.
- Evitar duplicar lógica.
- Escalar servicios por separado.
- Cambiar internamente WhatsApp Service o Bot Service sin rediseñar el dashboard.
- Convertir el producto en una plataforma modular.
