# 06 - Super Admin: Panel Interno de Administración SaaS

## Plataforma SaaS de Administración de WhatsApp Business

---

# Objetivo

Este documento define el módulo de **Super Admin** para la plataforma SaaS.

El Super Admin es el panel interno que usará el equipo dueño de la plataforma para administrar, monitorear y dar soporte a todos los clientes del SaaS.

Este panel es diferente al dashboard que usan las empresas clientes.

---

# Diferencia entre Dashboard Cliente y Super Admin

## Dashboard Cliente

Lo usan las empresas que compran el servicio.

Sirve para:

- Atender conversaciones.
- Conectar números.
- Configurar horarios.
- Configurar automatizaciones.
- Invitar agentes.
- Operar WhatsApp.

## Super Admin

Lo usa el equipo interno dueño de la plataforma.

Sirve para:

- Ver todos los clientes.
- Ver todos los workspaces.
- Ver estado global del sistema.
- Ayudar a clientes con problemas.
- Revisar conexiones de WhatsApp.
- Revisar errores.
- Suspender cuentas.
- Cambiar planes.
- Revisar uso.
- Administrar límites.
- Dar soporte.
- Auditar actividad.
- Diagnosticar fallas.

---

# Principio de seguridad

El Super Admin debe ser extremadamente seguro.

Un usuario Super Admin puede ver y modificar información sensible de toda la plataforma.

Por eso:

- Debe tener autenticación separada o reforzada.
- Debe tener roles internos.
- Debe tener auditoría obligatoria.
- Debe registrar cada acción sensible.
- Debe evitar acceso innecesario a mensajes privados.
- Debe tener controles de soporte con justificación.
- Debe tener sesiones separadas del dashboard cliente.
- Debe usar 2FA en producción.

---

# Roles internos sugeridos

```text
super_owner
super_admin
support_admin
billing_admin
readonly_admin
```

## super_owner

Máximo nivel.

Puede:

- Crear usuarios internos.
- Editar roles internos.
- Suspender workspaces.
- Eliminar o desactivar cuentas.
- Cambiar planes.
- Ver métricas globales.
- Ver logs.
- Acceder a herramientas de soporte.
- Configurar parámetros globales.
- Administrar claves e integraciones.

Debe ser usado por muy pocas personas.

## super_admin

Administrador operativo general.

Puede:

- Ver todos los workspaces.
- Editar datos de workspace.
- Suspender/reactivar cuentas.
- Cambiar planes.
- Ver estado de conexiones.
- Revisar errores.
- Usar herramientas de soporte.
- Ver logs operativos.

No debería poder crear otros super admins ni tocar secretos críticos.

## support_admin

Soporte al cliente.

Puede:

- Buscar empresas.
- Ver configuración de clientes.
- Ver estado de números.
- Ver eventos y errores.
- Forzar sincronización.
- Regenerar QR si el cliente lo solicita.
- Ver metadatos de conversaciones.
- Entrar en modo soporte limitado.

No debería poder:

- Cambiar planes.
- Ver facturación completa.
- Eliminar workspaces.
- Acceder libremente al contenido de mensajes sin justificación.

## billing_admin

Administración comercial y pagos.

Puede:

- Ver clientes.
- Ver plan actual.
- Ver uso.
- Cambiar plan.
- Aplicar descuentos.
- Ver historial de facturación.
- Suspender por falta de pago.
- Reactivar por pago.

No debería poder:

- Leer conversaciones.
- Enviar mensajes.
- Cambiar configuración técnica.

## readonly_admin

Auditor o usuario interno de lectura.

Puede:

- Ver métricas.
- Ver workspaces.
- Ver estado general.
- Ver logs de sólo lectura.

No puede modificar nada.

---

# Regla de oro

Toda acción de Super Admin debe generar un audit log.

Ejemplos:

```text
super_admin.workspace.suspended
super_admin.workspace.reactivated
super_admin.plan.changed
super_admin.support_access.started
super_admin.whatsapp_account.synced
super_admin.whatsapp_account.qr_viewed
super_admin.user.disabled
super_admin.admin_user.role_changed
super_admin.webhook.reprocessed
```

---

# PARTE 1: FRONTEND SUPER ADMIN

---

# 1. Separación visual y de navegación

El Super Admin debe tener un layout diferente al dashboard cliente.

## Rutas recomendadas

```text
/admin/login
/admin
/admin/workspaces
/admin/workspaces/:workspaceId
/admin/whatsapp-accounts
/admin/whatsapp-accounts/:id
/admin/users
/admin/users/:id
/admin/conversations
/admin/webhooks
/admin/logs
/admin/usage
/admin/plans
/admin/billing
/admin/support
/admin/admin-users
/admin/settings
```

## Recomendación MVP

Para MVP puede vivir dentro del mismo proyecto Next.js, pero protegido bajo `/admin`.

Debe tener:

- Layout separado.
- Menú separado.
- Middleware separado.
- Roles internos separados.
- Guardas de permisos estrictas.
- Auditoría obligatoria en acciones sensibles.

---

# 2. Login Super Admin

## Ruta

```text
/admin/login
```

## Objetivo

Permitir que usuarios internos entren al panel administrativo global.

## Campos

### Email

- Tipo: email.
- Requerido: sí.
- Placeholder: `admin@empresa.com`

### Contraseña

- Tipo: password.
- Requerido: sí.

### Código 2FA

- Tipo: texto.
- Requerido: sí en producción.
- Placeholder: `Código de autenticación`

## Botones

```text
Entrar al panel
```

## Validaciones

- Email requerido.
- Email válido.
- Contraseña requerida.
- 2FA requerido si está activado.
- Error genérico:
  `Credenciales inválidas.`

## Seguridad UX

No mostrar:

```text
El usuario no existe.
La contraseña es incorrecta.
```

Mostrar siempre un error genérico.

---

# 3. Layout Super Admin

## Estructura

```text
+-------------------------------------------------------------+
| Super Admin Topbar                                          |
| Búsqueda global | Estado del sistema | Admin actual          |
+----------------------+--------------------------------------+
| Sidebar Admin        | Contenido                            |
|                      |                                      |
| Overview             |                                      |
| Workspaces           |                                      |
| WhatsApp Accounts    |                                      |
| Users                |                                      |
| Conversations        |                                      |
| Webhooks             |                                      |
| Errors & Logs        |                                      |
| Usage                |                                      |
| Plans                |                                      |
| Billing              |                                      |
| Support Tools        |                                      |
| Admin Users          |                                      |
| System Settings      |                                      |
+----------------------+--------------------------------------+
```

## Topbar

Debe incluir:

- Buscador global.
- Estado general del sistema.
- Nombre del admin interno.
- Rol interno.
- Menú de sesión.
- Indicador de modo soporte activo, si aplica.

## Sidebar

Debe ocultar secciones según rol.

Ejemplo:

- `billing_admin` ve Billing, Plans, Usage y Workspaces.
- `support_admin` ve Workspaces, WhatsApp Accounts, Webhooks, Logs y Support Tools.
- `readonly_admin` ve sólo lectura.
- `super_owner` ve todo.

---

# 4. Página: Overview

## Ruta

```text
/admin
```

o

```text
/admin/overview
```

## Objetivo

Ver el estado global de la plataforma.

## Métricas principales

Tarjetas:

```text
Workspaces activos
Workspaces trial
Workspaces suspendidos
Usuarios totales
Números conectados
Números desconectados
Mensajes enviados hoy
Mensajes recibidos hoy
Mensajes automáticos hoy
Errores últimos 60 minutos
Webhooks fallidos
```

## Estado de servicios

Bloque:

```text
PostgreSQL
WhatsApp Service API
Bot Service API
Realtime
Redis
Background Jobs
```

Estados:

```text
OK
Degradado
Caído
Desconocido
```

## Alertas críticas

Ejemplos:

```text
WhatsApp Service API no responde.
Hay 24 webhooks fallidos en la última hora.
El workspace "Clínica Santa Fe" superó su límite de mensajes.
El número "Ventas" de "La Mojarrería" está desconectado hace 3 horas.
```

## Actividad reciente global

Debe mostrar:

- Fecha.
- Tipo de evento.
- Workspace relacionado.
- Usuario relacionado.
- Severidad.
- Link al detalle.

Ejemplos:

```text
Workspace creado
Número conectado
Número desconectado
Plan cambiado
Usuario invitado
Cuenta suspendida
Webhook fallido
```

---

# 5. Página: Workspaces

## Ruta

```text
/admin/workspaces
```

## Objetivo

Administrar todas las empresas clientes.

## Tabla

Columnas:

```text
Nombre
Slug
Estado
Plan
Usuarios
Números
Números conectados
Mensajes hoy
Fecha de alta
Última actividad
Acciones
```

## Filtros

```text
Buscar por nombre
Buscar por slug
Estado
Plan
Fecha de alta
Última actividad
Tiene números desconectados
Tiene errores recientes
```

## Acciones

```text
Ver detalle
Editar
Suspender
Reactivar
Cambiar plan
Entrar en modo soporte
Ver uso
Ver logs
```

---

# 6. Página: Detalle de Workspace

## Ruta

```text
/admin/workspaces/:workspaceId
```

## Objetivo

Ver todo lo relevante de una empresa.

## Secciones

```text
Resumen
Usuarios
Números de WhatsApp
Conversaciones
Automatización
Uso
Facturación
Logs
Soporte
Configuración
```

## Resumen

Debe mostrar:

```text
Nombre
Slug
Estado
Plan
Zona horaria
Fecha de creación
Última actividad
Total usuarios
Total números
Números conectados
Números desconectados
Mensajes enviados hoy
Mensajes recibidos hoy
Automatización activa
```

## Estado comercial

```text
Plan actual
Estatus de pago
Fecha de renovación
Límite de números
Límite de usuarios
Límite de mensajes
Uso actual
```

## Alertas del workspace

Ejemplos:

```text
Este workspace tiene números desconectados.
Este workspace no ha configurado horario.
Este workspace tiene automatización activa pero no tiene mensaje fuera de horario.
Este workspace está suspendido.
```

## Acciones principales

```text
Editar workspace
Cambiar plan
Suspender workspace
Reactivar workspace
Forzar sincronización
Entrar en modo soporte
Ver logs
```

---

# Formulario: Editar Workspace

## Campos

### Nombre

- Tipo: texto.
- Requerido: sí.

### Slug

- Tipo: texto.
- Requerido: sí.
- Puede ser bloqueado si ya está en producción.

### Estado

- Tipo: select.
- Opciones:
  - trial
  - active
  - suspended
  - cancelled

### Plan

- Tipo: select.
- Opciones:
  - starter
  - business
  - enterprise

### Zona horaria

- Tipo: select.
- Requerido: sí.

### Notas internas

- Tipo: textarea.
- Requerido: no.
- Visible sólo para Super Admin.

## Botones

```text
Guardar cambios
Cancelar
```

## Validaciones

- No permitir slug duplicado.
- Confirmar cambios de estado sensibles.
- Confirmar suspensión.
- Registrar audit log.

---

# Acción: Suspender Workspace

## Modal

Título:

```text
Suspender workspace
```

## Campos

### Motivo

- Tipo: select.
- Requerido: sí.
- Opciones:
  - Falta de pago
  - Solicitud del cliente
  - Abuso
  - Riesgo de seguridad
  - Otro

### Comentario interno

- Tipo: textarea.
- Requerido: sí.

### Notificar al cliente

- Tipo: switch.
- Requerido: no.

### Confirmación

- Tipo: texto.
- Requerido: sí para acciones críticas.
- Placeholder: `Escribe SUSPENDER para confirmar`

## Efecto esperado

Al suspender:

- Usuarios del workspace no pueden operar normalmente.
- Dashboard puede quedar en sólo lectura.
- No se deben enviar mensajes automáticos.
- Puede bloquearse el envío manual.
- Se mantiene historial.
- Se registra audit log.

---

# Acción: Reactivar Workspace

## Campos

### Comentario interno

- Tipo: textarea.
- Requerido: no.

## Efecto esperado

- Workspace vuelve a `active`.
- Se habilita operación normal.
- Se registra audit log.

---

# Acción: Cambiar Plan

## Campos

### Plan nuevo

- Tipo: select.
- Requerido: sí.
- Opciones:
  - starter
  - business
  - enterprise

### Aplicar inmediatamente

- Tipo: switch.
- Valor por defecto: sí.

### Comentario interno

- Tipo: textarea.
- Requerido: recomendado.

## Validaciones

- Sólo billing_admin, super_admin o super_owner.
- Confirmar si el nuevo plan tiene límites menores que el uso actual.
- Registrar audit log.

---

# 7. Página: WhatsApp Accounts Global

## Ruta

```text
/admin/whatsapp-accounts
```

## Objetivo

Monitorear todos los números conectados en todos los workspaces.

## Tabla

Columnas:

```text
Workspace
Nombre del número
Teléfono
Estado
Connection ID externo
Última conexión
Última desconexión
Mensajes hoy
Errores recientes
Acciones
```

## Filtros

```text
Workspace
Estado
Número telefónico
Connection ID
Última conexión
Desconectados
Con errores
```

## Acciones

```text
Ver detalle
Sincronizar estado
Ver QR
Regenerar QR
Marcar como desconectado
Deshabilitar
Ver eventos
Ver logs
```

---

# 8. Página: Detalle de WhatsApp Account

## Ruta

```text
/admin/whatsapp-accounts/:id
```

## Información visible

```text
Workspace
Nombre interno
Teléfono
Estado interno
Connection ID externo
Última conexión
Última desconexión
Fecha de creación
Automatización activa
Horario aplicado
Mensajes enviados hoy
Mensajes recibidos hoy
Errores recientes
```

## Diagnóstico técnico

Mostrar:

```text
Estado local
Estado reportado por WhatsApp Service API
Coinciden / No coinciden
Última sincronización
Último webhook recibido
Último mensaje enviado
Último mensaje recibido
```

## Acciones de soporte

```text
Sincronizar con WhatsApp Service
Obtener QR
Regenerar QR
Forzar desconexión local
Reintentar conexión
Ver eventos webhook
Ver logs de este número
```

## Importante sobre QR

Super Admin puede ver QR únicamente para soporte.

Debe registrar:

```text
super_admin.whatsapp_account.qr_viewed
```

y pedir justificación.

---

# Modal: Ver QR como Super Admin

## Campos

### Motivo de soporte

- Tipo: textarea.
- Requerido: sí.

## Advertencia

```text
Estás a punto de ver un QR de conexión de un cliente. Esta acción quedará registrada.
```

## Botones

```text
Ver QR
Cancelar
```

---

# 9. Página: Usuarios Global

## Ruta

```text
/admin/users
```

## Objetivo

Ver usuarios finales de todos los workspaces.

## Tabla

Columnas:

```text
Nombre
Email
Workspace
Rol en workspace
Estado
Fecha de alta
Último acceso
Acciones
```

## Filtros

```text
Email
Nombre
Workspace
Rol
Estado
Último acceso
```

## Acciones

```text
Ver usuario
Ver workspace
Deshabilitar acceso
Reenviar invitación
Forzar reset de contraseña
```

---

# 10. Detalle de Usuario Cliente

## Ruta

```text
/admin/users/:userId
```

## Información

```text
Nombre
Email
Estado
Workspaces a los que pertenece
Roles por workspace
Último acceso
Fecha de creación
Actividad reciente
```

## Acciones

```text
Deshabilitar usuario
Habilitar usuario
Reenviar invitación
Forzar reset de contraseña
Ver audit logs relacionados
```

## Acción: Deshabilitar usuario cliente

Debe pedir:

- Motivo.
- Comentario interno.

Debe registrar audit log.

---

# 11. Página: Conversations Global

## Ruta

```text
/admin/conversations
```

## Objetivo

Permitir soporte y diagnóstico.

## Regla de privacidad

Por defecto, el Super Admin no debe leer libremente el contenido de conversaciones.

Debe ver primero metadatos:

```text
Workspace
Número
Contacto
Estado
Última actividad
Cantidad de mensajes
Asignado a
Tiene errores
```

Para ver contenido, debe activar un modo de soporte con justificación.

## Tabla

Columnas:

```text
Workspace
Contacto
Teléfono
Número de WhatsApp
Estado
Último mensaje enmascarado
Última actividad
Mensajes
Asignado a
Acciones
```

## Último mensaje enmascarado

Ejemplo:

```text
"Hola, necesito..."
```

o:

```text
Contenido oculto por privacidad
```

La decisión depende del nivel de privacidad deseado.

---

# Acción: Ver contenido de conversación

Debe requerir:

- Rol permitido.
- Justificación.
- Registro de auditoría.
- Opcionalmente expiración de acceso.

## Modal: Acceso a conversación

### Motivo

- Tipo: select.
- Requerido: sí.
- Opciones:
  - Soporte solicitado por cliente
  - Investigación de error
  - Revisión de abuso
  - Auditoría interna
  - Otro

### Comentario

- Tipo: textarea.
- Requerido: sí.

### Duración del acceso

- Tipo: select.
- Opciones:
  - 15 minutos
  - 1 hora
  - Sólo esta conversación

## Botones

```text
Acceder
Cancelar
```

---

# 12. Página: Automation / Bot Global

## Ruta

```text
/admin/automation
```

## Objetivo

Ver estado de automatizaciones por workspace.

## Tabla

Columnas:

```text
Workspace
Bot activo
Fuera de horario activo
Reglas activas
IA activa
Número asociado
Última respuesta automática
Errores recientes
Acciones
```

## Acciones

```text
Ver configuración
Desactivar automatización
Sincronizar con Bot Service
Ver logs del bot
```

## Detalle de configuración de bot

Mostrar:

```text
Workspace
Número específico o general
Bot activo
Mensaje fuera de horario
Reglas activas
Última sincronización
External Bot ID
Errores recientes
```

## Acción sensible: desactivar automatización

Debe pedir confirmación y motivo.

---

# 13. Página: Webhooks

## Ruta

```text
/admin/webhooks
```

## Objetivo

Monitorear eventos recibidos de servicios externos.

## Tabla de eventos webhook

Columnas:

```text
Fecha
Servicio
Evento
Workspace
Connection ID / Bot ID
Estado
Intentos
Error
Acciones
```

## Filtros

```text
Servicio
Evento
Workspace
Estado
Fecha
Connection ID
Sólo fallidos
```

## Estados

```text
received
processed
failed
ignored
retrying
```

## Acciones

```text
Ver payload
Reprocesar evento
Marcar como ignorado
Ver recurso relacionado
```

## Modal: Ver payload

Debe ocultar datos sensibles cuando sea posible.

Mostrar:

```text
Headers recibidos
Payload
Resultado de procesamiento
Errores
```

## Acción: Reprocesar webhook

Debe:

- Pedir confirmación.
- Registrar audit log.
- Evitar duplicados usando idempotencia.

---

# 14. Página: Errors & Logs

## Ruta

```text
/admin/logs
```

## Objetivo

Ver errores y eventos internos de la plataforma.

## Tipos de logs

```text
Application logs
Audit logs
Webhook logs
WhatsApp service errors
Bot service errors
Auth logs
Realtime logs
```

## Tabla

Columnas:

```text
Fecha
Nivel
Módulo
Workspace
Usuario
Mensaje
Trace ID
Acciones
```

## Niveles

```text
debug
info
warning
error
critical
```

## Filtros

```text
Nivel
Módulo
Workspace
Usuario
Trace ID
Fecha
Sólo errores
```

## Detalle de log

Mostrar:

```text
Timestamp
Nivel
Módulo
Mensaje
Workspace
Usuario
Request ID
Trace ID
Metadata JSON
Stack trace
```

---

# 15. Página: Usage

## Ruta

```text
/admin/usage
```

## Objetivo

Monitorear uso de la plataforma.

## Métricas globales

```text
Mensajes enviados por día
Mensajes recibidos por día
Mensajes automáticos por día
Conexiones activas
Usuarios activos
Workspaces activos
Errores por día
```

## Métricas por workspace

Tabla:

```text
Workspace
Plan
Usuarios
Números
Mensajes enviados
Mensajes recibidos
Automáticos
Uso del límite
Última actividad
```

## Filtros

```text
Workspace
Plan
Fecha
Sólo alto uso
Sólo sin actividad
```

---

# 16. Página: Plans

## Ruta

```text
/admin/plans
```

## Objetivo

Administrar planes comerciales.

## Tabla de planes

Columnas:

```text
Nombre
Precio
Máximo usuarios
Máximo números
Máximo mensajes
Estado
Acciones
```

## Formulario: Crear / Editar Plan

### Nombre

- Tipo: texto.
- Requerido: sí.
- Ejemplo: `Starter`

### Código

- Tipo: texto.
- Requerido: sí.
- Ejemplo: `starter`

### Precio mensual

- Tipo: número.
- Requerido: sí.

### Moneda

- Tipo: select.
- Opciones:
  - MXN
  - USD

### Máximo usuarios

- Tipo: número.
- Requerido: sí.

### Máximo números WhatsApp

- Tipo: número.
- Requerido: sí.

### Máximo mensajes mensuales

- Tipo: número.
- Requerido: no.

### Permite automatización

- Tipo: switch.

### Permite IA

- Tipo: switch.

### Estado

- Tipo: select.
- Opciones:
  - active
  - hidden
  - deprecated

## Botones

```text
Guardar plan
Cancelar
```

---

# 17. Página: Billing

## Ruta

```text
/admin/billing
```

## Objetivo

Administrar estado comercial de clientes.

Para MVP puede ser manual.

## Tabla

Columnas:

```text
Workspace
Plan
Estado de pago
Renovación
Monto
Moneda
Método
Acciones
```

## Estados

```text
trial
active
past_due
suspended
cancelled
manual
```

## Acciones

```text
Cambiar estado de pago
Registrar pago manual
Aplicar descuento
Suspender por falta de pago
Reactivar
```

## Formulario: registrar pago manual

### Workspace

- Tipo: select.
- Requerido: sí.

### Monto

- Tipo: número.
- Requerido: sí.

### Moneda

- Tipo: select.
- Requerido: sí.

### Fecha de pago

- Tipo: date.
- Requerido: sí.

### Referencia

- Tipo: texto.
- Requerido: no.

### Comentario interno

- Tipo: textarea.
- Requerido: no.

---

# 18. Página: Support Tools

## Ruta

```text
/admin/support
```

## Objetivo

Dar herramientas al equipo interno para resolver problemas sin tocar producción manualmente.

## Herramientas sugeridas

```text
Buscar workspace
Buscar número
Buscar usuario
Buscar connectionId
Sincronizar conexión
Reprocesar webhook
Enviar evento de prueba
Probar WhatsApp Service API
Probar Bot Service API
Ver estado de servicios
Entrar en modo soporte
```

## Herramienta: Búsqueda global

Debe permitir buscar por:

```text
Workspace name
Workspace slug
User email
Phone number
Connection ID
Conversation ID
Message ID
```

Resultado:

```text
Tipo
Nombre
Workspace
Estado
Acción
```

## Herramienta: Sincronizar conexión

### WhatsApp Account

- Tipo: select/búsqueda.
- Requerido: sí.

### Motivo

- Tipo: textarea.
- Requerido: sí.

Acción:

- Llama al WhatsApp Service API.
- Actualiza estado local.
- Registra audit log.

## Herramienta: Reprocesar webhook

### Webhook Event ID

- Tipo: texto.
- Requerido: sí.

### Motivo

- Tipo: textarea.
- Requerido: sí.

Acción:

- Reprocesa evento.
- Respeta idempotencia.
- Registra audit log.

## Herramienta: Probar servicios externos

Debe mostrar:

```text
WhatsApp Service API: OK / Error
Bot Service API: OK / Error
Última latencia
Último error
```

Botones:

```text
Probar WhatsApp Service
Probar Bot Service
```

---

# 19. Página: Admin Users

## Ruta

```text
/admin/admin-users
```

## Objetivo

Administrar usuarios internos del panel Super Admin.

Sólo `super_owner` debería tener acceso completo.

## Tabla

Columnas:

```text
Nombre
Email
Rol interno
Estado
2FA
Último acceso
Fecha de creación
Acciones
```

## Formulario: Crear usuario interno

### Nombre

- Tipo: texto.
- Requerido: sí.

### Email

- Tipo: email.
- Requerido: sí.

### Rol interno

- Tipo: select.
- Requerido: sí.
- Opciones:
  - super_admin
  - support_admin
  - billing_admin
  - readonly_admin

### Requiere 2FA

- Tipo: switch.
- Valor recomendado: sí.

### Estado

- Tipo: select.
- Opciones:
  - active
  - disabled
  - invited

## Botones

```text
Crear usuario interno
Cancelar
```

## Formulario: Editar usuario interno

Campos:

```text
Nombre
Rol interno
Estado
Requiere 2FA
```

Validaciones:

- No permitir deshabilitar al último super_owner.
- No permitir que un super_admin cree super_owner.
- Todo cambio genera audit log.

---

# 20. Página: System Settings

## Ruta

```text
/admin/settings
```

## Objetivo

Configurar parámetros globales del SaaS.

## Secciones

```text
General
Límites globales
Servicios externos
Webhooks
Seguridad
Mantenimiento
```

## General

Campos:

```text
Nombre de plataforma
Dominio principal
Email de soporte
Zona horaria por defecto
```

## Límites globales

Campos:

```text
Límite default de usuarios por workspace
Límite default de números
Límite default de mensajes por minuto
Límite de solicitudes de QR
```

## Servicios externos

Mostrar configuración enmascarada:

```text
WhatsApp Service Base URL
Bot Service Base URL
Estado de conexión
```

No mostrar secretos completos.

## Seguridad

Campos:

```text
Requerir 2FA para admins internos
Duración de sesión admin
Permitir modo soporte
Duración máxima de modo soporte
IPs permitidas, opcional
```

## Mantenimiento

Acciones:

```text
Activar modo mantenimiento
Desactivar modo mantenimiento
Mostrar banner global
```

---

# PARTE 2: BACKEND SUPER ADMIN

---

# 21. Separación de rutas backend

Todas las rutas de Super Admin deben vivir bajo:

```text
/api/admin/*
```

Ejemplo:

```text
/api/admin/auth/login
/api/admin/workspaces
/api/admin/whatsapp-accounts
```

Esto evita mezclarlas con rutas del dashboard cliente.

---

# 22. Middlewares específicos

## requireAdminAuth

Valida autenticación de usuario interno.

Debe ser independiente de `requireAuth` del dashboard cliente.

## requireAdminRole

Valida rol interno.

Ejemplo:

```ts
requireAdminRole(["super_owner", "super_admin"]);
```

## requireSupportReason

Para acciones sensibles, obliga a mandar motivo.

Acciones que deben requerir motivo:

```text
Ver QR
Ver contenido de conversación
Entrar en modo soporte
Suspender workspace
Reactivar workspace
Cambiar plan
Reprocesar webhook
Deshabilitar usuario
```

## adminAuditLog

Todo endpoint admin sensible debe generar audit log.

Debe guardar:

```text
admin_user_id
action
target_type
target_id
workspace_id
reason
metadata
ip
user_agent
created_at
```

---

# 23. Modelo conceptual adicional

Este documento no define la base de datos en detalle, pero el backend necesitará nuevas entidades conceptuales:

```text
admin_users
admin_sessions
admin_audit_logs
support_access_sessions
plans
billing_accounts
manual_payments
webhook_events
system_settings
usage_counters
```

Estas entidades deberán modelarse formalmente en una actualización del documento de datos.

---

# 24. API Auth Super Admin

## Login admin

```http
POST /api/admin/auth/login
```

### Request

```json
{
  "email": "admin@empresa.com",
  "password": "password123",
  "totpCode": "123456"
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "accessToken": "admin_jwt",
    "refreshToken": "admin_refresh_token",
    "adminUser": {
      "id": "admin_user_uuid",
      "name": "Carlos",
      "email": "admin@empresa.com",
      "role": "super_admin"
    }
  }
}
```

## Admin actual

```http
GET /api/admin/auth/me
```

## Logout admin

```http
POST /api/admin/auth/logout
```

---

# 25. API Workspaces Admin

## Listar workspaces

```http
GET /api/admin/workspaces
```

### Query params

```text
search
status
plan
hasDisconnectedNumbers
hasRecentErrors
createdFrom
createdTo
page
pageSize
```

## Obtener workspace

```http
GET /api/admin/workspaces/:workspaceId
```

## Actualizar workspace

```http
PATCH /api/admin/workspaces/:workspaceId
```

### Roles

```text
super_owner
super_admin
```

### Request

```json
{
  "name": "La Mojarrería",
  "slug": "la-mojarreria",
  "status": "active",
  "plan": "business",
  "timezone": "America/Mexico_City",
  "internalNotes": "Cliente importante."
}
```

## Suspender workspace

```http
POST /api/admin/workspaces/:workspaceId/suspend
```

### Request

```json
{
  "reason": "past_due",
  "comment": "Cliente con 15 días de atraso.",
  "notifyCustomer": true
}
```

## Reactivar workspace

```http
POST /api/admin/workspaces/:workspaceId/reactivate
```

### Request

```json
{
  "comment": "Pago confirmado."
}
```

## Cambiar plan

```http
POST /api/admin/workspaces/:workspaceId/change-plan
```

### Request

```json
{
  "plan": "business",
  "applyImmediately": true,
  "comment": "Upgrade solicitado por cliente."
}
```

---

# 26. API WhatsApp Accounts Admin

## Listar números globales

```http
GET /api/admin/whatsapp-accounts
```

### Query params

```text
workspaceId
search
phoneNumber
connectionId
status
hasErrors
page
pageSize
```

## Obtener número

```http
GET /api/admin/whatsapp-accounts/:id
```

## Sincronizar número

```http
POST /api/admin/whatsapp-accounts/:id/sync
```

### Request

```json
{
  "reason": "Cliente reporta estado incorrecto."
}
```

## Ver QR como soporte

```http
POST /api/admin/whatsapp-accounts/:id/view-qr
```

### Request

```json
{
  "reason": "Cliente solicitó ayuda para reconectar el número."
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "status": "qr_required",
    "qr": {
      "imageUrl": "data:image/png;base64,...",
      "expiresAt": "2026-07-04T12:05:00.000Z"
    }
  }
}
```

## Deshabilitar número

```http
POST /api/admin/whatsapp-accounts/:id/disable
```

### Request

```json
{
  "reason": "Abuso detectado.",
  "comment": "Se detectó envío no permitido."
}
```

---

# 27. API Users Admin

## Listar usuarios globales

```http
GET /api/admin/users
```

### Query params

```text
search
email
workspaceId
role
status
lastLoginFrom
lastLoginTo
page
pageSize
```

## Obtener usuario

```http
GET /api/admin/users/:userId
```

## Deshabilitar usuario cliente

```http
POST /api/admin/users/:userId/disable
```

### Request

```json
{
  "reason": "security_risk",
  "comment": "Actividad sospechosa."
}
```

## Habilitar usuario cliente

```http
POST /api/admin/users/:userId/enable
```

## Forzar reset de contraseña

```http
POST /api/admin/users/:userId/force-password-reset
```

### Request

```json
{
  "reason": "Cliente solicitó restablecimiento."
}
```

---

# 28. API Conversations Admin

## Listar conversaciones globales

```http
GET /api/admin/conversations
```

### Query params

```text
workspaceId
whatsappAccountId
contactPhone
status
assignedUserId
dateFrom
dateTo
page
pageSize
```

## Obtener metadatos de conversación

```http
GET /api/admin/conversations/:id
```

Debe devolver metadatos sin contenido sensible por defecto.

## Solicitar acceso a contenido

```http
POST /api/admin/conversations/:id/support-access
```

### Request

```json
{
  "reason": "customer_support_request",
  "comment": "El cliente pidió revisar por qué no llegó una respuesta.",
  "durationMinutes": 15
}
```

## Obtener mensajes con acceso de soporte

```http
GET /api/admin/conversations/:id/messages
```

Requiere sesión de soporte activa.

---

# 29. API Webhooks Admin

## Listar eventos webhook

```http
GET /api/admin/webhooks
```

### Query params

```text
service
event
workspaceId
status
connectionId
dateFrom
dateTo
failedOnly
page
pageSize
```

## Obtener evento webhook

```http
GET /api/admin/webhooks/:id
```

## Reprocesar evento

```http
POST /api/admin/webhooks/:id/reprocess
```

### Request

```json
{
  "reason": "Evento falló por error temporal del servicio."
}
```

## Marcar como ignorado

```http
POST /api/admin/webhooks/:id/ignore
```

### Request

```json
{
  "reason": "Evento duplicado sin impacto."
}
```

---

# 30. API Logs Admin

## Listar logs

```http
GET /api/admin/logs
```

### Query params

```text
level
module
workspaceId
userId
traceId
dateFrom
dateTo
page
pageSize
```

## Obtener log

```http
GET /api/admin/logs/:id
```

---

# 31. API Usage Admin

## Overview de uso

```http
GET /api/admin/usage/overview
```

### Query params

```text
dateFrom
dateTo
```

## Uso por workspace

```http
GET /api/admin/usage/workspaces
```

## Uso por número

```http
GET /api/admin/usage/whatsapp-accounts
```

---

# 32. API Plans Admin

## Listar planes

```http
GET /api/admin/plans
```

## Crear plan

```http
POST /api/admin/plans
```

## Actualizar plan

```http
PATCH /api/admin/plans/:id
```

## Desactivar plan

```http
POST /api/admin/plans/:id/deactivate
```

---

# 33. API Billing Admin

## Listar billing accounts

```http
GET /api/admin/billing
```

## Actualizar estado de pago

```http
PATCH /api/admin/billing/:workspaceId
```

### Request

```json
{
  "billingStatus": "active",
  "renewalDate": "2026-08-04",
  "comment": "Pago confirmado manualmente."
}
```

## Registrar pago manual

```http
POST /api/admin/billing/:workspaceId/manual-payment
```

### Request

```json
{
  "amount": 999,
  "currency": "MXN",
  "paidAt": "2026-07-04",
  "reference": "SPEI-123",
  "comment": "Pago mensual."
}
```

---

# 34. API Support Tools

## Búsqueda global

```http
GET /api/admin/search
```

### Query params

```text
q
types=workspace,user,phone,connection,conversation,message
```

## Probar WhatsApp Service

```http
POST /api/admin/support/test-whatsapp-service
```

## Probar Bot Service

```http
POST /api/admin/support/test-bot-service
```

## Reprocesar recurso

```http
POST /api/admin/support/reprocess
```

### Request

```json
{
  "type": "webhook",
  "id": "webhook_event_uuid",
  "reason": "Reproceso por falla temporal."
}
```

---

# 35. API Admin Users

## Listar usuarios internos

```http
GET /api/admin/admin-users
```

## Crear usuario interno

```http
POST /api/admin/admin-users
```

### Request

```json
{
  "name": "Soporte 1",
  "email": "soporte@empresa.com",
  "role": "support_admin",
  "requires2fa": true
}
```

## Actualizar usuario interno

```http
PATCH /api/admin/admin-users/:id
```

## Deshabilitar usuario interno

```http
POST /api/admin/admin-users/:id/disable
```

## Habilitar usuario interno

```http
POST /api/admin/admin-users/:id/enable
```

---

# 36. API System Settings

## Obtener settings

```http
GET /api/admin/settings
```

## Actualizar settings

```http
PATCH /api/admin/settings
```

### Request

```json
{
  "platformName": "Taku WhatsApp SaaS",
  "supportEmail": "soporte@taku.lat",
  "defaultTimezone": "America/Mexico_City",
  "requireAdmin2fa": true,
  "adminSessionMinutes": 60,
  "supportAccessMaxMinutes": 60
}
```

---

# 37. Seguridad backend obligatoria

## Super Admin no debe reutilizar permisos de cliente

No basta con que un usuario sea owner de un workspace.

Para entrar a `/api/admin/*` debe existir como usuario interno admin.

## Sesiones separadas

Recomendado:

```text
Cliente token != Admin token
```

## 2FA

Debe ser obligatorio para:

```text
super_owner
super_admin
support_admin
billing_admin
```

## Auditoría obligatoria

Acciones sensibles:

```text
Ver QR
Suspender workspace
Reactivar workspace
Cambiar plan
Cambiar estado de pago
Ver contenido de conversación
Reprocesar webhook
Deshabilitar usuario
Crear admin interno
Cambiar rol admin interno
Cambiar settings globales
```

## Privacidad de conversaciones

Regla recomendada:

```text
Super Admin no ve contenido de mensajes por defecto.
```

Sólo puede verlo bajo:

- Rol permitido.
- Motivo obligatorio.
- Audit log.
- Tiempo limitado.
- Preferentemente solicitud del cliente.

## Protección contra errores operativos

Acciones destructivas deben pedir confirmación.

Ejemplo:

```text
Escribe SUSPENDER para confirmar.
```

---

# 38. Estados y errores específicos

```text
ADMIN_UNAUTHORIZED
ADMIN_FORBIDDEN
ADMIN_2FA_REQUIRED
ADMIN_ROLE_REQUIRED
SUPPORT_REASON_REQUIRED
SUPPORT_ACCESS_REQUIRED
SUPPORT_ACCESS_EXPIRED
WORKSPACE_ALREADY_SUSPENDED
WORKSPACE_NOT_SUSPENDED
PLAN_LIMIT_EXCEEDED
ADMIN_ACTION_NOT_ALLOWED
```

---

# 39. Orden recomendado de implementación

## Fase 1: Seguridad admin

1. Modelo de admin users.
2. Login admin.
3. Roles internos.
4. Middleware `/api/admin`.
5. Audit log admin.
6. Layout Super Admin frontend.

## Fase 2: Workspaces

7. Listar workspaces.
8. Detalle workspace.
9. Editar workspace.
10. Suspender/reactivar.
11. Cambiar plan.

## Fase 3: Soporte WhatsApp

12. Listar números globales.
13. Detalle de número.
14. Sincronizar estado.
15. Ver QR con justificación.
16. Ver eventos por número.

## Fase 4: Logs y webhooks

17. Webhook events.
18. Reprocesar webhook.
19. Logs.
20. Errors dashboard.

## Fase 5: Usuarios y soporte

21. Usuarios globales.
22. Deshabilitar usuario.
23. Force password reset.
24. Modo soporte conversación.

## Fase 6: Comercial

25. Usage.
26. Plans.
27. Billing.
28. Pagos manuales.

## Fase 7: Configuración global

29. Admin users.
30. System settings.
31. Modo mantenimiento.
32. Seguridad avanzada.

---

# 40. MVP mínimo del Super Admin

Para lanzar el SaaS de forma segura, el mínimo recomendable es:

```text
1. Login admin separado.
2. Roles internos básicos.
3. Overview global.
4. Lista de workspaces.
5. Detalle de workspace.
6. Suspender/reactivar workspace.
7. Lista global de números WhatsApp.
8. Ver estado de número.
9. Sincronizar número.
10. Ver QR con justificación.
11. Lista de usuarios cliente.
12. Webhook logs.
13. Error logs.
14. Audit logs.
15. Admin users básico.
```

---

# 41. Criterio de éxito

El módulo Super Admin estará listo cuando el equipo interno pueda:

1. Ver todos los clientes.
2. Diagnosticar problemas de conexión.
3. Identificar números desconectados.
4. Revisar errores de webhook.
5. Reprocesar eventos fallidos.
6. Suspender y reactivar cuentas.
7. Cambiar planes manualmente.
8. Dar soporte sin entrar directamente a la base de datos.
9. Registrar toda acción sensible.
10. Operar el SaaS sin depender de herramientas improvisadas.

---

# 42. Conclusión

El Super Admin no es una sección secundaria.

Es una pieza vital para operar el SaaS de forma profesional.

Sin Super Admin, cualquier problema de cliente obligaría a revisar manualmente base de datos, logs o servicios externos.

Con Super Admin, el equipo interno puede operar, soportar y escalar la plataforma con control, trazabilidad y seguridad.
