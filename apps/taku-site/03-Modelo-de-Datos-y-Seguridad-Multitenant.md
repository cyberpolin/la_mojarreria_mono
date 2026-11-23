# 03 - Modelo de Datos y Seguridad Multi-Tenant

## Plataforma SaaS de Administración de WhatsApp Business

---

# Contexto

La plataforma será un SaaS multiempresa donde una sola instalación del sistema atiende a múltiples empresas independientes.

Cada empresa podrá tener:

- Uno o varios usuarios.
- Uno o varios números de WhatsApp conectados.
- Sus propias conversaciones.
- Sus propios contactos.
- Sus propios mensajes.
- Sus propios horarios.
- Sus propias reglas de automatización.
- Su propia configuración de bot.

La plataforma consumirá dos servicios existentes:

- **WhatsApp Service API**
- **Bot Service API**

La plataforma no debe reconstruir esos servicios. Sólo debe administrarlos y orquestarlos.

---

# Objetivo del punto 3

Implementar correctamente el soporte multiempresa.

Esto implica dos cosas:

1. **Modelo de datos multi-tenant**
2. **Seguridad y aislamiento por workspace**

---

# Concepto principal

La entidad central será:

```text
Workspace
```

Un `Workspace` representa una empresa cliente.

Ejemplo:

```text
Workspace: La Mojarrería
Workspace: Clínica Santa Fe
Workspace: Ferretería López
```

Todos los datos operativos importantes deben pertenecer a un `workspace_id`.

---

# Regla de oro

Toda consulta sensible debe estar filtrada por `workspace_id`.

Nunca hacer:

```sql
SELECT * FROM conversations;
```

Siempre hacer:

```sql
SELECT *
FROM conversations
WHERE workspace_id = :workspace_id;
```

El `workspace_id` nunca debe confiarse al frontend.

Debe obtenerse desde la sesión autenticada del usuario.

---

# Modelo general

```text
User
  |
  | many-to-many
  |
Membership
  |
  v
Workspace
  |
  +-- WhatsAppAccount
  |
  +-- Contact
  |
  +-- Conversation
  |
  +-- Message
  |
  +-- BusinessHours
  |
  +-- AutomationRule
  |
  +-- BotSettings
```

---

# Entidades principales

## 1. workspaces

Representa una empresa cliente.

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,

  status TEXT NOT NULL DEFAULT 'trial',
  plan TEXT NOT NULL DEFAULT 'starter',

  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Estados sugeridos

```text
trial
active
suspended
cancelled
```

## Planes sugeridos

```text
starter
business
enterprise
```

---

## 2. users

Representa una cuenta de usuario.

Importante: el usuario no pertenece directamente a una empresa. La relación se maneja con `memberships`.

Esto permite que un mismo usuario pueda administrar varias empresas en el futuro.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Estados sugeridos

```text
active
disabled
invited
```

---

## 3. memberships

Relaciona usuarios con empresas.

Aquí vive el rol del usuario dentro de cada workspace.

```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, user_id)
);
```

## Roles iniciales

```text
owner
admin
agent
```

## Permisos por rol

| Permiso              | owner | admin |    agent |
| -------------------- | ----: | ----: | -------: |
| Ver conversaciones   |    Sí |    Sí |       Sí |
| Responder mensajes   |    Sí |    Sí |       Sí |
| Ver configuración    |    Sí |    Sí | Limitado |
| Administrar usuarios |    Sí |    Sí |       No |
| Conectar números     |    Sí |    Sí |       No |
| Configurar horarios  |    Sí |    Sí |       No |
| Configurar reglas    |    Sí |    Sí |       No |
| Cambiar plan         |    Sí |    No |       No |
| Suspender workspace  |    Sí |    No |       No |

---

## 4. whatsapp_accounts

Representa cada número conectado a WhatsApp.

Cada workspace puede tener N números.

```sql
CREATE TABLE whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  external_instance_id TEXT UNIQUE,
  phone_number TEXT,
  display_name TEXT,

  status TEXT NOT NULL DEFAULT 'pending',
  qr_code TEXT,

  last_connected_at TIMESTAMPTZ,
  last_disconnected_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Estados sugeridos

```text
pending
qr_required
connecting
connected
disconnected
failed
disabled
```

## Nota importante

`external_instance_id` es el identificador que regresa el **WhatsApp Service API**.

Ese campo permite mapear el registro local con la instancia externa.

---

## 5. contacts

Representa una persona que escribe por WhatsApp.

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  phone_number TEXT NOT NULL,
  name TEXT,
  profile_picture_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, phone_number)
);
```

---

## 6. conversations

Representa una conversación entre un contacto y un número conectado.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  whatsapp_account_id UUID NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'open',

  last_message_body TEXT,
  last_message_at TIMESTAMPTZ,

  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, whatsapp_account_id, contact_id)
);
```

## Estados sugeridos

```text
open
pending
closed
archived
```

---

## 7. messages

Representa mensajes entrantes, salientes, automáticos o del sistema.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_account_id UUID NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  external_message_id TEXT,

  direction TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',

  body TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,

  status TEXT NOT NULL DEFAULT 'created',

  sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## direction

```text
inbound
outbound
bot
system
```

## type

```text
text
image
audio
video
document
location
sticker
unknown
```

## status

```text
created
queued
sent
delivered
read
failed
received
```

---

## 8. business_hours

Horario de atención.

Puede aplicar a todo el workspace o a un número específico.

```sql
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,

  day_of_week INT NOT NULL,
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, whatsapp_account_id, day_of_week)
);
```

## day_of_week

```text
0 = domingo
1 = lunes
2 = martes
3 = miércoles
4 = jueves
5 = viernes
6 = sábado
```

Si `whatsapp_account_id` es `NULL`, el horario aplica al workspace completo.

---

## 9. bot_settings

Configuración general del bot.

Puede aplicar a todo el workspace o a un número específico.

```sql
CREATE TABLE bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,

  enabled BOOLEAN NOT NULL DEFAULT FALSE,

  after_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  after_hours_message TEXT,

  rules_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  external_bot_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, whatsapp_account_id)
);
```

## Nota

`external_bot_id` puede usarse para mapear la configuración local con el **Bot Service API**.

---

## 10. automation_rules

Reglas simples por palabra clave.

```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,

  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains',
  response_text TEXT NOT NULL,

  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## match_type

```text
exact
contains
starts_with
```

Si `whatsapp_account_id` es `NULL`, la regla aplica a todos los números del workspace.

---

## 11. audit_logs

Registro básico de acciones importantes.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,

  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Ejemplos de acciones:

```text
user.login
user.created
workspace.updated
whatsapp_account.connected
whatsapp_account.disconnected
message.sent
automation_rule.created
bot_settings.updated
```

---

# Índices recomendados

```sql
CREATE INDEX idx_memberships_user_id
ON memberships(user_id);

CREATE INDEX idx_memberships_workspace_id
ON memberships(workspace_id);

CREATE INDEX idx_whatsapp_accounts_workspace_id
ON whatsapp_accounts(workspace_id);

CREATE INDEX idx_contacts_workspace_id_phone
ON contacts(workspace_id, phone_number);

CREATE INDEX idx_conversations_workspace_id
ON conversations(workspace_id);

CREATE INDEX idx_conversations_workspace_last_message
ON conversations(workspace_id, last_message_at DESC);

CREATE INDEX idx_conversations_account
ON conversations(workspace_id, whatsapp_account_id);

CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at ASC);

CREATE INDEX idx_messages_workspace_created
ON messages(workspace_id, created_at DESC);

CREATE INDEX idx_business_hours_workspace
ON business_hours(workspace_id);

CREATE INDEX idx_bot_settings_workspace
ON bot_settings(workspace_id);

CREATE INDEX idx_automation_rules_workspace
ON automation_rules(workspace_id);

CREATE INDEX idx_audit_logs_workspace_created
ON audit_logs(workspace_id, created_at DESC);
```

---

# Restricciones multi-tenant recomendadas

PostgreSQL permite llaves foráneas compuestas para reforzar que entidades relacionadas pertenezcan al mismo workspace.

Para el MVP puede bastar con validación en backend, pero en una versión más robusta se recomienda agregar restricciones compuestas.

Ejemplo conceptual:

```sql
-- Evitar que un mensaje relacione una conversación de otro workspace.
-- Esto se puede reforzar con claves compuestas e índices únicos.
```

Recomendación práctica para MVP:

1. Todas las tablas operativas llevan `workspace_id`.
2. Todos los queries filtran por `workspace_id`.
3. El middleware inyecta `workspace_id` desde la sesión.
4. Los servicios validan que los IDs recibidos pertenezcan al mismo workspace.
5. Agregar tests automatizados de aislamiento.

---

# Seguridad multi-tenant

## Principios

1. El usuario sólo puede acceder a workspaces donde tiene membresía activa.
2. El rol se obtiene desde la tabla `memberships`.
3. El frontend nunca decide el `workspace_id`.
4. El backend filtra siempre por `workspace_id`.
5. Los webhooks externos deben validarse con firma o secret.
6. Ningún token del WhatsApp Service API o Bot Service API debe exponerse al navegador.

---

# Flujo de autenticación

```text
Usuario hace login
      |
      v
Express.js valida email y password
      |
      v
Express.js obtiene memberships activas
      |
      v
Express.js crea sesión / JWT
      |
      v
Frontend recibe token seguro
      |
      v
Usuario selecciona workspace activo
      |
      v
Todas las peticiones posteriores operan dentro de ese workspace
```

---

# JWT sugerido

El token puede contener:

```json
{
  "sub": "user_id",
  "activeWorkspaceId": "workspace_id",
  "role": "admin"
}
```

Sin embargo, el backend debe validar periódicamente contra base de datos que esa membresía sigue activa.

No confiar permanentemente sólo en el JWT.

---

# Middleware requerido

## 1. requireAuth

Valida que el usuario esté autenticado.

Pseudo-código:

```ts
async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = verifyToken(token);

  const user = await db.users.findById(payload.sub);

  if (!user || user.status !== "active") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;

  next();
}
```

---

## 2. requireWorkspace

Valida que el usuario tenga acceso al workspace activo.

Pseudo-código:

```ts
async function requireWorkspace(req, res, next) {
  const workspaceId = getWorkspaceIdFromHeaderOrSession(req);

  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace required" });
  }

  const membership = await db.memberships.findFirst({
    where: {
      user_id: req.user.id,
      workspace_id: workspaceId,
      status: "active",
    },
  });

  if (!membership) {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.workspace = {
    id: workspaceId,
    role: membership.role,
  };

  next();
}
```

Header sugerido:

```text
X-Workspace-Id: <workspace_id>
```

Alternativa:

- Guardar el workspace activo en sesión.
- Cambiarlo mediante endpoint `/workspaces/switch`.

---

## 3. requireRole

Valida permisos mínimos por rol.

Pseudo-código:

```ts
function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!allowedRoles.includes(req.workspace.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
```

Ejemplo:

```ts
router.post(
  "/whatsapp-accounts",
  requireAuth,
  requireWorkspace,
  requireRole(["owner", "admin"]),
  createWhatsAppAccount,
);
```

---

# Patrón obligatorio para queries

Todo repositorio o servicio debe recibir `workspaceId`.

Ejemplo correcto:

```ts
async function listConversations(workspaceId: string) {
  return db.conversations.findMany({
    where: {
      workspace_id: workspaceId,
    },
    orderBy: {
      last_message_at: "desc",
    },
  });
}
```

Ejemplo incorrecto:

```ts
async function listConversations() {
  return db.conversations.findMany();
}
```

---

# Validación de IDs relacionados

Cuando se reciba un ID desde el frontend, validar que pertenezca al workspace activo.

Ejemplo:

```ts
async function getConversationOrFail(
  workspaceId: string,
  conversationId: string,
) {
  const conversation = await db.conversations.findFirst({
    where: {
      id: conversationId,
      workspace_id: workspaceId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return conversation;
}
```

Nunca buscar sólo por `id`.

Incorrecto:

```ts
db.conversations.findUnique({
  where: { id: conversationId },
});
```

---

# Seguridad de webhooks

Los webhooks desde WhatsApp Service API y Bot Service API deben tener validación.

## Recomendado

Cada servicio externo debe enviar:

```text
X-Service-Name
X-Signature
X-Timestamp
```

El backend debe validar:

1. Que el servicio sea conocido.
2. Que el timestamp no sea viejo.
3. Que la firma coincida.
4. Que el evento apunte a un `external_instance_id` o `external_bot_id` válido.
5. Que ese ID mapee a un workspace existente.

---

# Flujo webhook WhatsApp

```text
WhatsApp Service API envía evento
      |
      v
Express.js valida firma
      |
      v
Busca whatsapp_accounts.external_instance_id
      |
      v
Obtiene workspace_id
      |
      v
Guarda mensaje usando ese workspace_id
      |
      v
Emite evento al dashboard del workspace correcto
```

---

# Reglas para tiempo real

Los WebSockets también deben ser multi-tenant.

Cuando un usuario se conecta:

1. Se autentica.
2. Selecciona workspace activo.
3. Se valida su membresía.
4. Se une a un room por workspace.

Room sugerido:

```text
workspace:{workspace_id}
```

Ejemplo:

```ts
socket.join(`workspace:${workspaceId}`);
```

Al emitir:

```ts
io.to(`workspace:${workspaceId}`).emit("message.created", message);
```

Nunca emitir globalmente eventos de mensajes.

Incorrecto:

```ts
io.emit("message.created", message);
```

---

# Auditoría mínima

Registrar acciones críticas:

- Login.
- Creación de usuario.
- Cambio de rol.
- Conexión de número.
- Desconexión de número.
- Envío manual de mensaje.
- Actualización de horario.
- Actualización de regla.
- Cambio de configuración del bot.

Esto ayuda a resolver disputas y errores operativos.

---

# Checklist de seguridad multi-tenant

Antes de considerar terminado el punto 3:

- [ ] Todas las tablas operativas tienen `workspace_id`.
- [ ] Existe tabla `memberships`.
- [ ] Ningún usuario pertenece directamente a un solo workspace.
- [ ] Todo endpoint requiere `requireAuth`.
- [ ] Todo endpoint operativo requiere `requireWorkspace`.
- [ ] Los endpoints administrativos usan `requireRole`.
- [ ] Ningún query sensible busca sólo por `id`.
- [ ] Todos los queries filtran por `workspace_id`.
- [ ] Webhooks validan firma.
- [ ] Webhooks mapean IDs externos a workspace interno.
- [ ] WebSockets emiten sólo al room del workspace.
- [ ] No se exponen tokens de servicios externos al frontend.
- [ ] Existen tests de aislamiento entre workspaces.
- [ ] Existe audit log básico.

---

# Tests mínimos recomendados

## Test 1: usuario no puede ver conversaciones de otro workspace

```text
Dado:
- User A pertenece a Workspace A.
- Workspace B tiene conversaciones.

Cuando:
- User A intenta consultar conversation_id de Workspace B.

Entonces:
- El backend responde 404 o 403.
```

Recomendación: usar 404 para no revelar que el recurso existe.

---

## Test 2: agente no puede conectar números

```text
Dado:
- User A tiene rol agent.

Cuando:
- Intenta crear whatsapp_account.

Entonces:
- El backend responde 403.
```

---

## Test 3: webhook no firmado es rechazado

```text
Dado:
- Un request entra a /webhooks/whatsapp/message-received sin firma válida.

Entonces:
- El backend responde 401.
```

---

## Test 4: evento de WebSocket sólo llega al workspace correcto

```text
Dado:
- Usuario A conectado al room Workspace A.
- Usuario B conectado al room Workspace B.

Cuando:
- Llega mensaje nuevo para Workspace A.

Entonces:
- Sólo Usuario A recibe el evento.
```

---

# Decisiones finales para el MVP

## Sí se implementa desde el inicio

- Workspaces.
- Users.
- Memberships.
- Roles.
- WhatsApp accounts por workspace.
- Contactos.
- Conversaciones.
- Mensajes.
- Horarios.
- Bot settings.
- Automation rules.
- Audit log básico.
- Middleware multi-tenant.
- Webhook security.
- WebSocket rooms por workspace.

## No se implementa todavía

- Permisos personalizados.
- Equipos/departamentos.
- Sucursales avanzadas.
- Facturación.
- Límites por plan.
- Row Level Security de PostgreSQL.
- Organizaciones padre con múltiples workspaces.
- API pública para clientes.

---

# Nota sobre Row Level Security

PostgreSQL soporta Row Level Security (RLS), lo cual puede reforzar el aislamiento multi-tenant desde la base de datos.

Para el MVP no es obligatorio, pero puede evaluarse después.

Primero se recomienda implementar bien:

- Middleware.
- Servicios con `workspace_id`.
- Validaciones.
- Tests.

Luego se puede agregar RLS como capa extra de seguridad.

---

# Siguiente paso

Después de este documento, el siguiente punto natural es:

## 4. Dashboard de administración

Debe cubrir:

- Login.
- Selector de workspace.
- Lista de números conectados.
- Estado de cada número.
- Botón para conectar número.
- Vista de QR.
- Desconectar número.
- Configuración básica por número.
