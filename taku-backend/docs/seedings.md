# TAKU Backend Seedings

Este documento define el comportamiento de seed inicial para `taku-backend`.

## 1. Superusuario obligatorio

Cada vez que el store se lee por primera vez, el backend valida que exista el usuario:

```txt
Email: TAKU_BACKEND_SUPERADMIN_EMAIL o SUPERADMIN_EMAIL
Password inicial: TAKU_BACKEND_SUPERADMIN_PASSWORD o SUPERADMIN_PASSWORD
```

Si no existe, se crea automaticamente.

El superusuario se representa como usuario interno en `admin_users`:

- `role`: `super_owner`
- `status`: `active`
- `requires2fa`: `false` en desarrollo inicial
- no tiene membership de cliente por defecto

Si el usuario ya existe, el seed no sobreescribe su password.

Variables soportadas:

```env
TAKU_BACKEND_SUPERADMIN_EMAIL=cyberpolin@gmail.com
TAKU_BACKEND_SUPERADMIN_PASSWORD=changeme

# Alias tambien soportado:
SUPERADMIN_EMAIL=cyberpolin@gmail.com
SUPERADMIN_PASSWORD=changeme
```

## 2. Datos ficticios en development y TEST

Si el ambiente es `development` o `TEST`, el backend crea datos ficticios de todo el sistema:

```bash
TAKU_BACKEND_ENV=development
```

Tambien funciona:

```bash
TAKU_BACKEND_ENV=TEST
```

Y se reconoce:

```bash
NODE_ENV=test
```

El dataset de prueba incluye:

- workspace demo
- usuarios owner/admin/agent
- memberships
- cuentas de WhatsApp conectada y desconectada
- contactos
- conversaciones ficticias para el inbox y la vista mobile
- mensajes
- horarios de negocio
- configuracion de bot
- reglas de automatizacion
- preferencias

Conversaciones demo (vista mobile, un numero por URL):

```txt
http://localhost:3006/conversation-mobile/5219931234567   Juan Perez
http://localhost:3006/conversation-mobile/5219987654321   Maria Lopez
http://localhost:3006/conversation-mobile/5215551234567   Pedro Sanchez
http://localhost:3006/conversation-mobile/5212223344556   Ana Ruiz
```

`addMissingById` agrega estos fixtures si faltan. No hace falta borrar el JSON si el backend ya existia; reinicia `pnpm dev:taku-backend`.

Credenciales test:

```txt
owner@owner.com / owner
admin@admin.com / admin
agent@agent.com / agent
```

## Pendientes recomendados

- Definir un rol global real `super_admin` separado de los roles por workspace.
- Forzar cambio de password en el primer login del superusuario.
- Activar 2FA obligatorio para `super_owner` antes de produccion.
- Cuando PostgreSQL reemplace el JSON store, convertir este seed en migracion/idempotent script.
