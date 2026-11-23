# 03B - Especificación del Dashboard Web por Usuario y Secciones

## Plataforma SaaS de Administración de WhatsApp Business

---

# Objetivo del documento

Este documento describe la experiencia web del dashboard para la plataforma SaaS de administración de WhatsApp Business.

El enfoque está en:

- Qué verá cada tipo de usuario.
- Qué podrá hacer cada usuario.
- Qué secciones tendrá el dashboard.
- Qué información mostrará cada sección.
- Qué formularios existirán.
- Qué campos tendrá cada formulario.
- Qué validaciones y estados deberá considerar el frontend.

Este documento **no define la base de datos**.  
Sin embargo, los formularios están pensados para ser compatibles con el modelo funcional definido en el documento de modelo de datos multi-tenant.

---

# Contexto del producto

La plataforma permite que una empresa administre uno o varios números de WhatsApp Business desde un dashboard web.

La empresa podrá:

- Conectar números de WhatsApp.
- Ver el estado de conexión de cada número.
- Ver conversaciones.
- Responder mensajes desde el navegador.
- Configurar horarios de atención.
- Configurar respuestas automáticas fuera de horario.
- Configurar reglas simples por palabra clave.
- Administrar usuarios internos.
- Controlar permisos básicos por rol.

La atención principal seguirá siendo humana.  
La automatización servirá para apoyar al equipo, no para reemplazarlo.

---

# Tipos de usuario

Para el MVP existirán tres roles principales:

```text
Owner
Admin
Agent
```

---

# Resumen de permisos por rol

| Sección / Acción                      | Owner |             Admin |    Agent |
| ------------------------------------- | ----: | ----------------: | -------: |
| Iniciar sesión                        |    Sí |                Sí |       Sí |
| Ver dashboard principal               |    Sí |                Sí |       Sí |
| Ver conversaciones                    |    Sí |                Sí |       Sí |
| Responder conversaciones              |    Sí |                Sí |       Sí |
| Ver números conectados                |    Sí |                Sí | Limitado |
| Conectar números                      |    Sí |                Sí |       No |
| Desconectar números                   |    Sí |                Sí |       No |
| Ver QR de conexión                    |    Sí |                Sí |       No |
| Configurar horarios                   |    Sí |                Sí |       No |
| Configurar respuesta fuera de horario |    Sí |                Sí |       No |
| Crear reglas por palabra clave        |    Sí |                Sí |       No |
| Editar reglas por palabra clave       |    Sí |                Sí |       No |
| Activar/desactivar bot                |    Sí |                Sí |       No |
| Administrar usuarios                  |    Sí |                Sí |       No |
| Cambiar roles                         |    Sí | Sí, excepto owner |       No |
| Eliminar usuarios                     |    Sí | Sí, excepto owner |       No |
| Ver configuración de empresa          |    Sí |                Sí |       No |
| Editar configuración de empresa       |    Sí |                Sí |       No |
| Ver plan / facturación                |    Sí |          Limitado |       No |
| Suspender o eliminar workspace        |    Sí |                No |       No |

---

# Principios de experiencia de usuario

## 1. El dashboard debe ser operativo

La pantalla más importante es la de conversaciones.  
El usuario debe poder entrar y trabajar sin necesidad de configurar muchas cosas.

---

## 2. La plataforma debe parecer un centro de atención

No debe sentirse como "un bot".  
Debe sentirse como una consola profesional para manejar WhatsApp Business.

---

## 3. La automatización debe ser fácil de entender

No usar términos técnicos como:

- Webhook
- Instancia
- Payload
- Endpoint
- Token
- Middleware

Usar lenguaje de negocio:

- Número conectado
- Horario de atención
- Respuesta automática
- Palabra clave
- Mensaje fuera de horario

---

## 4. El rol Agent debe ver sólo lo necesario

El agente necesita:

- Ver conversaciones.
- Responder mensajes.
- Identificar el número por el que llegó el mensaje.
- Saber si una conversación está abierta, pendiente o cerrada.
- Ver historial.

No necesita ver configuración técnica.

---

## 5. Owner y Admin necesitan control

Owner y Admin necesitan:

- Conectar números.
- Invitar usuarios.
- Configurar horarios.
- Configurar reglas.
- Ver estado de la plataforma.
- Corregir problemas de conexión.

---

# Estructura general del dashboard

La plataforma web debe tener una navegación lateral principal.

Secciones sugeridas:

```text
1. Inicio
2. Conversaciones
3. Números de WhatsApp
4. Automatización
5. Horarios
6. Usuarios
7. Configuración
8. Plan y facturación
```

Para el MVP, las secciones mínimas son:

```text
1. Inicio
2. Conversaciones
3. Números de WhatsApp
4. Automatización
5. Horarios
6. Usuarios
7. Configuración
```

La sección de plan y facturación puede aparecer bloqueada o básica en el MVP.

---

# Layout general

## Escritorio

Estructura recomendada:

```text
+--------------------------------------------------------------+
| Topbar                                                       |
| Workspace activo | Buscador | Usuario | Notificaciones       |
+----------------------+---------------------------------------+
| Sidebar              | Contenido principal                   |
|                      |                                       |
| Inicio               |                                       |
| Conversaciones       |                                       |
| Números WhatsApp     |                                       |
| Automatización       |                                       |
| Horarios             |                                       |
| Usuarios             |                                       |
| Configuración        |                                       |
+----------------------+---------------------------------------+
```

---

## Móvil / tablet

En móvil el dashboard debe priorizar conversaciones.

La navegación lateral puede convertirse en menú hamburguesa.

El chat debe funcionar en tres niveles:

```text
Lista de conversaciones
  -> Detalle de conversación
    -> Información del contacto / acciones
```

---

# Selector de workspace

Aunque para el MVP un usuario probablemente sólo tendrá una empresa, conviene prever selector de workspace.

Ubicación sugerida:

- Parte superior izquierda del sidebar.
- Debajo del logo.
- Antes del menú principal.

Debe mostrar:

- Nombre del workspace.
- Estado del workspace.
- Opción para cambiar de workspace si el usuario pertenece a varios.

Ejemplo:

```text
La Mojarrería
Activo
⌄
```

Si el usuario sólo tiene un workspace, no debe sentirse como una función compleja.  
Sólo se muestra el nombre de la empresa.

---

# Topbar

La barra superior debe mostrar información contextual.

Elementos sugeridos:

## Para todos los roles

- Nombre de la sección actual.
- Buscador global, opcional.
- Indicador de conexión general.
- Nombre del usuario.
- Menú de usuario.

## Para Owner/Admin

- Alertas de números desconectados.
- Acceso rápido para conectar número.
- Notificaciones de sistema.

## Para Agent

- Filtros rápidos de conversaciones.
- Estado personal, opcional.
- Menú de usuario.

---

# Menú de usuario

Debe estar en la esquina superior derecha.

Opciones:

```text
Mi perfil
Cambiar contraseña
Cerrar sesión
```

Para Owner/Admin puede incluir:

```text
Configuración de empresa
Usuarios
```

---

# 1. Sección Inicio

## Objetivo

Dar una vista rápida del estado operativo de la empresa.

No debe ser un dashboard analítico complejo.  
Debe responder:

- ¿Mis números están conectados?
- ¿Tengo conversaciones pendientes?
- ¿Hay mensajes sin responder?
- ¿Está activo el bot fuera de horario?
- ¿Hay algún problema que deba atender?

---

## Acceso por rol

| Rol   | Acceso             |
| ----- | ------------------ |
| Owner | Completo           |
| Admin | Completo           |
| Agent | Operativo limitado |

---

## Vista para Owner

El Owner debe ver un resumen ejecutivo y operativo.

### Componentes sugeridos

#### Tarjetas principales

```text
Conversaciones abiertas
Mensajes sin responder
Números conectados
Números desconectados
Automatizaciones activas
```

#### Estado de números

Tabla breve:

| Número | Nombre  | Estado       | Último evento | Acción     |
| ------ | ------- | ------------ | ------------- | ---------- |
| +52... | Ventas  | Conectado    | Hace 5 min    | Ver        |
| +52... | Soporte | Desconectado | Hace 2 h      | Reconectar |

#### Alertas

Ejemplos:

```text
El número "Ventas" está desconectado.
Hay 12 conversaciones sin responder.
El horario de atención no está configurado.
La respuesta fuera de horario está desactivada.
```

#### Actividad reciente

Lista de eventos:

```text
Juan respondió una conversación.
Se conectó el número Ventas.
Se actualizó el horario de atención.
El bot respondió fuera de horario.
```

---

## Vista para Admin

Muy similar a Owner, pero sin información sensible de plan o facturación.

Debe ver:

- Estado de números.
- Conversaciones pendientes.
- Automatizaciones.
- Alertas de configuración.
- Actividad reciente.

No necesita ver:

- Cambios de plan.
- Suspensión de cuenta.
- Eliminación de workspace.

---

## Vista para Agent

El Agent debe ver una vista orientada al trabajo diario.

### Componentes sugeridos

```text
Mis conversaciones abiertas
Conversaciones sin asignar
Mensajes sin responder
Últimas conversaciones
```

Botones rápidos:

```text
Ir a conversaciones
Ver sin responder
Ver asignadas a mí
```

El Agent no debe ver:

- Configuración de bot.
- Usuarios.
- Plan.
- Conexión de números.
- Webhooks.
- QR.

---

# 2. Sección Conversaciones

## Objetivo

Permitir que el equipo vea, filtre, atienda y responda conversaciones de WhatsApp.

Esta es la sección más importante del producto.

Debe sentirse como una bandeja de entrada compartida de WhatsApp.

---

## Acceso por rol

| Rol   | Acceso             |
| ----- | ------------------ |
| Owner | Completo           |
| Admin | Completo           |
| Agent | Completo operativo |

Todos los roles pueden ver y responder conversaciones.

---

## Layout recomendado en escritorio

```text
+--------------------------------------------------------------+
| Filtros / búsqueda                                           |
+--------------------+---------------------------+-------------+
| Lista              | Chat                      | Detalles    |
| conversaciones     | conversación activa        | contacto    |
|                    |                           |             |
+--------------------+---------------------------+-------------+
```

---

## Panel izquierdo: lista de conversaciones

Debe mostrar:

- Nombre del contacto.
- Teléfono del contacto.
- Último mensaje.
- Hora del último mensaje.
- Número de WhatsApp por el que llegó.
- Estado de la conversación.
- Indicador de mensajes no leídos.
- Agente asignado, si existe.
- Etiqueta visual si fue respondido por bot.

Ejemplo:

```text
Juan Pérez
Necesito una cotización...
Ventas · hace 3 min · Sin responder

María López
Gracias, mañana paso.
Soporte · hace 15 min · Cerrada
```

---

## Filtros de conversaciones

Filtros mínimos:

```text
Todas
Abiertas
Sin responder
Asignadas a mí
Sin asignar
Cerradas
Archivadas
```

Filtros adicionales recomendados:

```text
Por número de WhatsApp
Por agente
Por fecha
Por estado
Por texto
```

---

## Buscador de conversaciones

Debe permitir buscar por:

- Nombre del contacto.
- Teléfono.
- Texto del último mensaje.
- Contenido del historial, si el backend lo permite.
- Número de WhatsApp conectado.

Placeholder sugerido:

```text
Buscar por nombre, teléfono o mensaje...
```

---

## Estados de conversación

Estados visibles para el usuario:

```text
Abierta
Pendiente
Cerrada
Archivada
```

Descripción:

### Abierta

Conversación activa que requiere seguimiento.

### Pendiente

Conversación que espera respuesta del cliente o está en espera.

### Cerrada

Conversación resuelta.

### Archivada

Conversación oculta de la operación diaria.

---

## Panel central: chat

Debe mostrar el historial de mensajes.

Cada mensaje debe distinguir:

- Mensaje entrante del cliente.
- Mensaje saliente del agente.
- Mensaje automático del bot.
- Mensaje de sistema.

---

## Tipos de mensajes visibles

El chat debe prever:

```text
Texto
Imagen
Audio
Video
Documento
Ubicación
Sticker
Mensaje no soportado
```

Para el MVP, se puede iniciar con texto, imagen y documento, pero el diseño debe prever otros tipos.

---

## Mensaje entrante

Debe mostrar:

- Texto o contenido.
- Hora.
- Remitente.
- Estado si aplica.
- Indicador si contiene media.

Ejemplo:

```text
Cliente · 12:34 PM
Hola, ¿tienen servicio a domicilio?
```

---

## Mensaje saliente manual

Debe mostrar:

- Texto.
- Usuario que lo envió.
- Hora.
- Estado de envío.

Estados:

```text
Enviando
Enviado
Entregado
Leído
Fallido
```

Ejemplo:

```text
Ana · 12:35 PM
Sí, tenemos servicio a domicilio.

Entregado
```

---

## Mensaje automático del bot

Debe verse claramente como automático.

Ejemplo:

```text
Bot · 8:15 PM
Gracias por escribir. Estamos fuera de horario. Te responderemos mañana a partir de las 9:00 AM.
```

Debe tener etiqueta:

```text
Automático
```

---

## Mensaje de sistema

Ejemplos:

```text
Conversación asignada a Ana.
Conversación cerrada por Roberto.
El bot respondió fuera de horario.
Número desconectado.
```

Los mensajes de sistema deben ser discretos.

---

## Caja para responder

Debe incluir:

- Campo de texto.
- Botón enviar.
- Adjuntar archivo, si está disponible.
- Indicador del número desde el que se enviará.
- Estado de conexión del número.
- Mensaje de error si el número está desconectado.

Placeholder:

```text
Escribe un mensaje...
```

Si el número está desconectado:

```text
No puedes responder porque el número "Ventas" está desconectado.
```

---

## Acciones de conversación

Acciones disponibles:

```text
Asignar conversación
Cambiar estado
Cerrar conversación
Reabrir conversación
Archivar conversación
Marcar como pendiente
```

Para MVP se recomienda incluir:

- Cambiar estado.
- Asignar agente.
- Cerrar conversación.

---

## Panel derecho: detalles del contacto

Debe mostrar:

```text
Nombre
Teléfono
Número de WhatsApp receptor
Estado de conversación
Agente asignado
Fecha de primera conversación
Última actividad
```

Acciones:

```text
Editar nombre del contacto
Asignar agente
Cambiar estado
Ver conversaciones previas
```

En el MVP, editar nombre del contacto es útil.

---

# Formulario: editar contacto

## Ubicación

Panel derecho de conversación.

## Campos

### Nombre del contacto

- Tipo: texto.
- Requerido: no.
- Placeholder: `Nombre del cliente`
- Ejemplo: `Juan Pérez`

### Teléfono

- Tipo: texto.
- Sólo lectura en MVP.
- Motivo: el teléfono viene desde WhatsApp y no debe modificarse manualmente sin una razón fuerte.

### Notas internas

- Tipo: textarea.
- Requerido: no.
- Opcional para MVP.
- Placeholder: `Notas visibles sólo para el equipo`

## Botones

```text
Guardar cambios
Cancelar
```

## Validaciones

- Nombre máximo: 120 caracteres.
- Notas máximo: 2,000 caracteres.

---

# Formulario: enviar mensaje

## Ubicación

Caja inferior del chat.

## Campos

### Mensaje

- Tipo: textarea.
- Requerido: sí, salvo que se adjunte archivo.
- Placeholder: `Escribe un mensaje...`

### Archivo adjunto

- Tipo: file.
- Requerido: no.
- Tipos futuros:
  - Imagen.
  - PDF.
  - Audio.
  - Video.

Para MVP puede dejarse visualmente preparado aunque sólo texto esté habilitado.

## Botones

```text
Enviar
Adjuntar
```

## Validaciones

- No permitir enviar mensaje vacío.
- No permitir enviar si el número está desconectado.
- No permitir enviar si el usuario no tiene permiso.
- Mostrar error si WhatsApp Service API falla.
- Mostrar estado "Enviando..." mientras se procesa.

---

# Formulario: asignar conversación

## Campos

### Agente

- Tipo: select.
- Opciones: usuarios activos del workspace.
- Requerido: no.
- Placeholder: `Seleccionar agente`

### Comentario interno

- Tipo: textarea.
- Requerido: no.
- Placeholder: `Comentario opcional para el agente`

## Botones

```text
Asignar
Cancelar
```

## Validaciones

- El agente debe pertenecer al workspace.
- El agente debe estar activo.
- Los roles permitidos deben ser agent, admin u owner.

---

# 3. Sección Números de WhatsApp

## Objetivo

Permitir que Owner y Admin administren los números conectados a la empresa.

Aquí se conectan, reconectan y monitorean los números de WhatsApp.

---

## Acceso por rol

| Rol   | Acceso                             |
| ----- | ---------------------------------- |
| Owner | Completo                           |
| Admin | Completo                           |
| Agent | Sólo lectura limitada o sin acceso |

Recomendación para MVP:

- Owner/Admin: acceso completo.
- Agent: no mostrar esta sección en el menú.

---

## Vista principal

Debe mostrar una tabla de números conectados.

Columnas sugeridas:

```text
Nombre
Número
Estado
Última conexión
Última desconexión
Automatización
Acciones
```

Ejemplo:

| Nombre  | Número     | Estado       | Última conexión | Automatización | Acción     |
| ------- | ---------- | ------------ | --------------- | -------------- | ---------- |
| Ventas  | +52 993... | Conectado    | Hoy 10:31       | Activa         | Ver        |
| Soporte | +52 993... | Desconectado | Ayer 18:02      | Inactiva       | Reconectar |

---

## Estados visibles

```text
Pendiente
Esperando QR
Conectando
Conectado
Desconectado
Fallido
Deshabilitado
```

Descripción:

### Pendiente

El número fue creado pero aún no se inicia conexión.

### Esperando QR

El sistema generó un QR y espera que el usuario lo escanee.

### Conectando

El número está en proceso de conexión.

### Conectado

El número está listo para enviar y recibir mensajes.

### Desconectado

La sesión se perdió o el teléfono se desconectó.

### Fallido

Ocurrió un error al conectar.

### Deshabilitado

El número fue desactivado manualmente.

---

## Acciones por número

Acciones sugeridas:

```text
Ver detalle
Conectar
Ver QR
Reconectar
Desconectar
Editar nombre
Deshabilitar
Eliminar
```

Para MVP:

- Ver detalle.
- Conectar / reconectar.
- Ver QR.
- Desconectar.
- Editar nombre.

Eliminar puede dejarse para después o protegerse mucho.

---

# Vista detalle de número

Debe mostrar:

```text
Nombre del número
Número telefónico
Estado actual
QR actual si aplica
Última conexión
Última desconexión
Automatización asociada
Horario asociado
Conversaciones recientes
```

---

# Formulario: agregar número de WhatsApp

## Objetivo

Crear un nuevo número dentro del workspace e iniciar el proceso de conexión.

## Ubicación

Botón:

```text
Agregar número
```

En sección Números de WhatsApp.

## Campos

### Nombre del número

- Tipo: texto.
- Requerido: sí.
- Placeholder: `Ej. Ventas, Soporte, Sucursal Centro`
- Ejemplo: `Ventas`

Este nombre es interno y ayuda al equipo a identificar por dónde llegó una conversación.

### Descripción interna

- Tipo: textarea.
- Requerido: no.
- Placeholder: `Ej. Número principal para pedidos y cotizaciones`

### Zona horaria

- Tipo: select.
- Requerido: sí.
- Valor por defecto: zona horaria del workspace.
- Ejemplo: `America/Mexico_City`

### Usar horario general de la empresa

- Tipo: switch.
- Valor por defecto: sí.

### Usar configuración general del bot

- Tipo: switch.
- Valor por defecto: sí.

## Botones

```text
Crear número
Cancelar
```

## Validaciones

- Nombre requerido.
- Nombre máximo: 80 caracteres.
- No permitir nombres duplicados dentro del mismo workspace, o advertir al usuario.
- La zona horaria debe ser válida.
- Si se alcanza el límite del plan, bloquear creación.

## Después de crear

El sistema debe llevar al usuario al flujo de conexión por QR.

---

# Flujo visual: conectar número

## Paso 1: crear número

El usuario llena el formulario.

## Paso 2: solicitar QR

La plataforma solicita QR al WhatsApp Service API.

## Paso 3: mostrar QR

Pantalla:

```text
Escanea este código QR con WhatsApp
```

Instrucciones:

```text
1. Abre WhatsApp en tu teléfono.
2. Ve a Dispositivos vinculados.
3. Toca Vincular dispositivo.
4. Escanea el código QR.
```

## Paso 4: esperar conexión

Mostrar estado:

```text
Esperando conexión...
```

## Paso 5: conectado

Mostrar éxito:

```text
Número conectado correctamente.
```

Botón:

```text
Ir a conversaciones
```

---

# Pantalla QR

Debe mostrar:

- QR grande.
- Nombre del número.
- Estado.
- Temporizador o indicación de expiración, si aplica.
- Botón para regenerar QR.
- Botón cancelar.

Estados:

```text
Generando QR...
QR listo
QR expirado
Conectando...
Conectado
Error al conectar
```

Mensajes:

```text
El QR expiró. Genera uno nuevo para continuar.
```

```text
No cierres esta pantalla hasta que el número aparezca como conectado.
```

---

# Formulario: editar número

## Campos

### Nombre del número

- Tipo: texto.
- Requerido: sí.
- Placeholder: `Ej. Ventas`

### Descripción interna

- Tipo: textarea.
- Requerido: no.

### Estado interno

- Tipo: switch.
- Etiqueta: `Número habilitado`
- Requerido: no.
- Si está apagado, no debe usarse para enviar mensajes ni automatizaciones.

### Usar horario general

- Tipo: switch.
- Requerido: no.

### Usar configuración general del bot

- Tipo: switch.
- Requerido: no.

## Botones

```text
Guardar cambios
Cancelar
```

## Validaciones

- Nombre requerido.
- Nombre máximo: 80 caracteres.
- Confirmar si se deshabilita un número conectado.

---

# Acción: desconectar número

Debe pedir confirmación.

Modal:

```text
¿Desconectar este número?
```

Descripción:

```text
El número dejará de enviar y recibir mensajes dentro de la plataforma hasta que vuelva a conectarse.
```

Botones:

```text
Desconectar número
Cancelar
```

Debe ser una acción permitida sólo para Owner/Admin.

---

# 4. Sección Automatización

## Objetivo

Permitir configurar automatizaciones simples, comprensibles y seguras.

En el MVP, automatización significa:

- Activar/desactivar bot.
- Respuesta fuera de horario.
- Reglas por palabra clave.

No debe presentarse como IA avanzada.

---

## Acceso por rol

| Rol   | Acceso     |
| ----- | ---------- |
| Owner | Completo   |
| Admin | Completo   |
| Agent | Sin acceso |

---

## Vista principal

Debe dividirse en bloques claros:

```text
Estado de automatización
Respuesta fuera de horario
Reglas por palabra clave
IA opcional / próximamente
```

---

## Bloque: estado de automatización

Mostrar:

```text
Automatización activa / inactiva
Aplicar a todos los números / configurar por número
```

Si hay varios números, permitir filtrar:

```text
Configuración general
Ventas
Soporte
Sucursal Centro
```

---

# Formulario: configuración general del bot

## Campos

### Automatización activa

- Tipo: switch.
- Requerido: sí.
- Descripción: `Permite que el sistema envíe respuestas automáticas según la configuración.`

### Aplicar a todos los números

- Tipo: switch.
- Requerido: sí.
- Valor por defecto: sí.

### Número específico

- Tipo: select.
- Visible sólo si `Aplicar a todos los números` está apagado.
- Opciones: números activos del workspace.

### Respuestas fuera de horario activas

- Tipo: switch.
- Requerido: no.

### Reglas por palabra clave activas

- Tipo: switch.
- Requerido: no.

### IA activa

- Tipo: switch.
- Requerido: no.
- Estado MVP: deshabilitado o marcado como próximamente.

## Botones

```text
Guardar configuración
Cancelar
```

## Validaciones

- Si se activa automatización pero no hay números conectados, mostrar advertencia.
- Si se activa respuesta fuera de horario sin mensaje configurado, pedir mensaje.
- Si se activan reglas pero no existen reglas, mostrar advertencia, no error.
- Si se activa configuración por número, debe seleccionarse un número.

---

# Bloque: respuesta fuera de horario

Debe permitir configurar qué se responderá cuando un cliente escriba fuera del horario de atención.

---

# Formulario: respuesta fuera de horario

## Campos

### Activar respuesta fuera de horario

- Tipo: switch.
- Requerido: sí.

### Aplicación

- Tipo: radio.
- Opciones:
  - `Toda la empresa`
  - `Número específico`

### Número específico

- Tipo: select.
- Visible si aplicación es `Número específico`.
- Opciones: números conectados o registrados.

### Mensaje automático

- Tipo: textarea.
- Requerido: sí si la respuesta está activa.
- Placeholder:
  `Gracias por escribir. En este momento estamos fuera de horario. Te responderemos el siguiente día hábil.`

### Insertar variables

Opcional, pero recomendable:

Variables sugeridas:

```text
{{business_name}}
{{next_open_time}}
{{whatsapp_number_name}}
```

Botones rápidos:

```text
Insertar nombre del negocio
Insertar próxima hora de apertura
```

### Enviar sólo una vez por conversación

- Tipo: switch.
- Valor por defecto: sí.
- Descripción:
  `Evita enviar el mismo mensaje automático varias veces en una misma conversación.`

### Enviar nuevamente después de

- Tipo: select.
- Visible si "Enviar sólo una vez" está apagado o si se permite repetición.
- Opciones:
  - 1 hora
  - 4 horas
  - 12 horas
  - 24 horas

### Vista previa

Debe mostrar cómo se verá el mensaje.

Ejemplo:

```text
Bot
Gracias por escribir. En este momento estamos fuera de horario. Te responderemos mañana a partir de las 9:00 AM.
```

## Botones

```text
Guardar respuesta
Probar respuesta
Cancelar
```

## Validaciones

- Mensaje requerido si está activo.
- Mensaje máximo recomendado: 1,000 caracteres.
- No permitir mensaje vacío.
- Advertir si no hay horarios configurados.
- Si se usan variables no válidas, mostrar error.
- Si no hay números conectados, permitir guardar pero mostrar advertencia.

---

# Acción: probar respuesta fuera de horario

Modal sugerido:

```text
Probar respuesta automática
```

Campos:

### Número simulado

- Tipo: select.
- Opciones: números del workspace.

### Mensaje entrante de prueba

- Tipo: texto.
- Valor por defecto: `Hola`

Resultado esperado:

- Mostrar si el sistema respondería o no.
- Mostrar mensaje que se enviaría.
- Mostrar razón:

```text
Respondería porque actualmente está fuera de horario.
```

o

```text
No respondería porque actualmente está dentro de horario.
```

---

# Bloque: reglas por palabra clave

## Objetivo

Permitir que el sistema responda automáticamente cuando el cliente escriba ciertas palabras.

Ejemplos:

```text
precio -> Aquí puedes ver nuestra lista de precios...
ubicación -> Estamos ubicados en...
horario -> Nuestro horario es...
factura -> Para facturar necesitamos...
```

---

## Vista de reglas

Tabla:

| Palabra clave | Coincidencia | Respuesta             | Aplica a | Estado   | Acciones |
| ------------- | ------------ | --------------------- | -------- | -------- | -------- |
| horario       | Contiene     | Nuestro horario es... | Todos    | Activa   | Editar   |
| ubicación     | Exacta       | Estamos en...         | Ventas   | Activa   | Editar   |
| factura       | Contiene     | Para facturar...      | Todos    | Inactiva | Editar   |

---

# Formulario: crear / editar regla por palabra clave

## Campos

### Estado de la regla

- Tipo: switch.
- Etiqueta: `Regla activa`
- Valor por defecto: activo.

### Aplicación

- Tipo: radio.
- Opciones:
  - `Todos los números`
  - `Número específico`

### Número específico

- Tipo: select.
- Visible si aplicación es `Número específico`.
- Opciones: números del workspace.

### Palabra clave

- Tipo: texto.
- Requerido: sí.
- Placeholder: `Ej. horario, precio, ubicación`
- Ejemplo: `horario`

### Tipo de coincidencia

- Tipo: select.
- Requerido: sí.
- Opciones:
  - `Contiene la palabra`
  - `Es exactamente igual`
  - `Empieza con la palabra`

Mapeo conceptual:

```text
contains
exact
starts_with
```

### Sensible a mayúsculas/minúsculas

- Tipo: switch.
- Valor por defecto: no.
- Recomendación MVP: mantener apagado y quizá no mostrarlo todavía.

### Respuesta automática

- Tipo: textarea.
- Requerido: sí.
- Placeholder:
  `Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.`

### Evitar responder si ya respondió un agente

- Tipo: switch.
- Valor por defecto: sí.
- Descripción:
  `Evita que el bot interrumpa conversaciones que ya están siendo atendidas por una persona.`

### Vista previa

Debe mostrar:

```text
Cliente:
¿Cuál es su horario?

Respuesta automática:
Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.
```

## Botones

```text
Guardar regla
Probar regla
Cancelar
```

## Validaciones

- Palabra clave requerida.
- Palabra clave máximo: 80 caracteres.
- Respuesta requerida.
- Respuesta máximo: 1,000 caracteres.
- No permitir duplicar palabra clave con mismo tipo de coincidencia y mismo número.
- Advertir si una regla puede chocar con otra.
- Advertir si la automatización global está desactivada.

---

# Acción: probar regla

Modal:

```text
Probar regla
```

Campos:

### Mensaje de prueba

- Tipo: textarea.
- Placeholder: `Escribe un mensaje como lo enviaría un cliente`

### Número

- Tipo: select.
- Opcional.
- Permite probar contra todos o contra un número específico.

Resultado:

```text
Regla encontrada:
horario

Respuesta:
Nuestro horario es...
```

o

```text
Ninguna regla coincide con este mensaje.
```

---

# 5. Sección Horarios

## Objetivo

Configurar el horario de atención que usará la plataforma para determinar si debe responder automáticamente fuera de horario.

---

## Acceso por rol

| Rol   | Acceso     |
| ----- | ---------- |
| Owner | Completo   |
| Admin | Completo   |
| Agent | Sin acceso |

---

## Vista principal

Debe permitir configurar:

```text
Horario general de la empresa
Horario por número de WhatsApp
Días cerrados
Horario partido, si aplica
```

Para MVP se puede iniciar con un bloque por día con apertura y cierre.

---

# Pantalla de horarios

Debe mostrar una tabla semanal:

| Día       | Abierto | Apertura | Cierre |
| --------- | ------- | -------- | ------ |
| Lunes     | Sí      | 09:00    | 18:00  |
| Martes    | Sí      | 09:00    | 18:00  |
| Miércoles | Sí      | 09:00    | 18:00  |
| Jueves    | Sí      | 09:00    | 18:00  |
| Viernes   | Sí      | 09:00    | 18:00  |
| Sábado    | Sí      | 10:00    | 14:00  |
| Domingo   | No      | -        | -      |

---

# Selector de aplicación

Arriba de la tabla:

```text
Configurar horario para:
[ Toda la empresa ▼ ]
```

Opciones:

```text
Toda la empresa
Ventas
Soporte
Sucursal Centro
```

Si se configura un horario para un número específico, debe indicarse que sobrescribe el horario general.

Texto sugerido:

```text
Este horario se aplicará sólo al número seleccionado y reemplazará el horario general de la empresa.
```

---

# Formulario: horario semanal

## Campos por día

### Día

- Tipo: label.
- No editable.
- Ejemplo: `Lunes`

### Abierto

- Tipo: switch.
- Valor por defecto: sí para lunes-viernes, no para domingo.

### Hora de apertura

- Tipo: time picker.
- Requerido si abierto = sí.
- Ejemplo: `09:00`

### Hora de cierre

- Tipo: time picker.
- Requerido si abierto = sí.
- Ejemplo: `18:00`

### Cerrado todo el día

- Implícito si abierto = no.

## Botones generales

```text
Guardar horario
Copiar lunes a viernes
Copiar a todos los días
Cancelar cambios
```

## Validaciones

- Si el día está abierto, apertura y cierre son requeridas.
- La hora de cierre debe ser posterior a la hora de apertura.
- No permitir rangos vacíos.
- Mostrar advertencia si todos los días están cerrados.
- Mostrar advertencia si no hay respuesta fuera de horario activa.
- Soportar zona horaria del workspace.

---

# Formulario: horario partido

No es obligatorio para MVP, pero conviene preverlo.

Ejemplo:

```text
Lunes:
09:00 - 14:00
16:00 - 19:00
```

Campos:

### Agregar bloque horario

- Botón por día.

Cada bloque:

```text
Apertura
Cierre
Eliminar bloque
```

Validaciones:

- Bloques no deben traslaparse.
- Deben estar en orden.
- Cierre posterior a apertura.

Recomendación MVP:

- Diseñar la UI de forma que más adelante pueda soportar varios bloques.
- Implementar sólo un bloque por día al inicio si se quiere simplificar.

---

# Vista previa de estado actual

La pantalla de horarios debe mostrar una tarjeta:

```text
Estado actual:
Abierto ahora
Cierra hoy a las 6:00 PM
```

o

```text
Estado actual:
Fuera de horario
Abre mañana a las 9:00 AM
```

Esto ayuda a validar que el horario está bien configurado.

---

# 6. Sección Usuarios

## Objetivo

Permitir que Owner/Admin administren los usuarios que pueden entrar al dashboard.

---

## Acceso por rol

| Rol   | Acceso                     |
| ----- | -------------------------- |
| Owner | Completo                   |
| Admin | Completo con restricciones |
| Agent | Sin acceso                 |

---

## Vista principal

Tabla de usuarios:

| Nombre | Email      | Rol   | Estado   | Último acceso | Acciones            |
| ------ | ---------- | ----- | -------- | ------------- | ------------------- |
| Carlos | carlos@... | Owner | Activo   | Hoy           | Ver                 |
| Ana    | ana@...    | Admin | Activo   | Ayer          | Editar              |
| Juan   | juan@...   | Agent | Invitado | Nunca         | Reenviar invitación |

---

## Estados de usuario

```text
Activo
Invitado
Deshabilitado
```

---

## Acciones

```text
Invitar usuario
Editar usuario
Cambiar rol
Deshabilitar usuario
Reenviar invitación
Eliminar acceso
```

Para MVP:

- Invitar usuario.
- Editar nombre.
- Cambiar rol.
- Deshabilitar usuario.

---

# Formulario: invitar usuario

## Campos

### Nombre

- Tipo: texto.
- Requerido: sí.
- Placeholder: `Nombre del usuario`
- Ejemplo: `Ana Pérez`

### Email

- Tipo: email.
- Requerido: sí.
- Placeholder: `correo@empresa.com`

### Rol

- Tipo: select.
- Requerido: sí.
- Opciones:
  - Admin
  - Agent

Owner sólo debería poder asignarse al crear el workspace o transferirse con flujo especial.

### Mensaje de invitación

- Tipo: textarea.
- Requerido: no.
- Placeholder:
  `Hola, te invito a acceder al panel de WhatsApp de la empresa.`

## Botones

```text
Enviar invitación
Cancelar
```

## Validaciones

- Nombre requerido.
- Email requerido y válido.
- No permitir email duplicado dentro del workspace.
- Admin no puede invitar owners.
- Si se alcanza límite del plan, bloquear invitación.
- Rol requerido.

---

# Formulario: editar usuario

## Campos

### Nombre

- Tipo: texto.
- Requerido: sí.

### Email

- Tipo: email.
- Sólo lectura inicialmente.
- Motivo: cambiar email puede requerir verificación.

### Rol

- Tipo: select.
- Requerido: sí.
- Opciones según permisos:
  - Owner puede asignar Admin o Agent.
  - Admin puede asignar Agent o Admin, pero no Owner.

### Estado

- Tipo: select o switch.
- Opciones:
  - Activo
  - Deshabilitado

## Botones

```text
Guardar cambios
Cancelar
```

## Validaciones

- No permitir que un admin cambie el rol de un owner.
- No permitir que un usuario se quite a sí mismo el último rol owner.
- No permitir deshabilitar al último owner del workspace.
- Email debe ser válido aunque sea sólo lectura.

---

# Acción: deshabilitar usuario

Modal:

```text
¿Deshabilitar usuario?
```

Descripción:

```text
Este usuario ya no podrá entrar al dashboard ni responder conversaciones.
```

Botones:

```text
Deshabilitar
Cancelar
```

Validaciones:

- No permitir deshabilitar al último owner.
- No permitir que admin deshabilite owner.

---

# 7. Sección Configuración

## Objetivo

Permitir configurar datos generales del workspace y preferencias operativas.

---

## Acceso por rol

| Rol   | Acceso                            |
| ----- | --------------------------------- |
| Owner | Completo                          |
| Admin | Completo operativo                |
| Agent | Sólo perfil personal o sin acceso |

---

## Subsecciones recomendadas

```text
Empresa
Preferencias
Mi perfil
Seguridad
Integraciones internas
```

Para MVP:

```text
Empresa
Preferencias
Mi perfil
```

---

# Configuración > Empresa

## Formulario: datos de empresa

### Nombre de empresa

- Tipo: texto.
- Requerido: sí.
- Placeholder: `Nombre de la empresa`
- Ejemplo: `La Mojarrería`

### Slug

- Tipo: texto.
- Requerido: sí.
- Placeholder: `la-mojarreria`
- Descripción:
  `Identificador interno de la empresa en la plataforma.`
- Puede ser sólo lectura después de creado.

### Zona horaria

- Tipo: select.
- Requerido: sí.
- Valor por defecto: `America/Mexico_City`

### Estado de empresa

- Tipo: badge / sólo lectura.
- Valores:
  - Trial
  - Activa
  - Suspendida
  - Cancelada

### Plan

- Tipo: badge / sólo lectura para MVP.
- Valores:
  - Starter
  - Business
  - Enterprise

## Botones

```text
Guardar cambios
Cancelar
```

## Validaciones

- Nombre requerido.
- Nombre máximo: 120 caracteres.
- Slug requerido.
- Slug sólo minúsculas, números y guiones.
- Zona horaria válida.

---

# Configuración > Preferencias

## Formulario: preferencias operativas

### Conversación nueva por defecto

- Tipo: select.
- Opciones:
  - Abierta
  - Pendiente
- Valor recomendado: Abierta.

### Cerrar conversación automáticamente

- Tipo: switch.
- Valor por defecto: no.

### Tiempo para cierre automático

- Tipo: select.
- Visible si cierre automático está activo.
- Opciones:
  - 24 horas sin respuesta
  - 48 horas sin respuesta
  - 7 días sin respuesta

### Mostrar mensajes del bot en conversaciones

- Tipo: switch.
- Valor por defecto: sí.

### Permitir que agentes cierren conversaciones

- Tipo: switch.
- Valor por defecto: sí.

### Permitir que agentes reasignen conversaciones

- Tipo: switch.
- Valor por defecto: sí o no según decisión del producto.

## Botones

```text
Guardar preferencias
Cancelar
```

---

# Configuración > Mi perfil

Disponible para todos los roles.

## Formulario: perfil personal

### Nombre

- Tipo: texto.
- Requerido: sí.

### Email

- Tipo: email.
- Sólo lectura inicialmente.

### Contraseña actual

- Tipo: password.
- Requerido sólo para cambiar contraseña.

### Nueva contraseña

- Tipo: password.
- Requerido sólo para cambiar contraseña.

### Confirmar nueva contraseña

- Tipo: password.
- Requerido sólo para cambiar contraseña.

## Botones

```text
Guardar perfil
Cambiar contraseña
Cancelar
```

## Validaciones

- Nombre requerido.
- Nueva contraseña mínimo 8 caracteres.
- Confirmación debe coincidir.
- Para cambiar contraseña se requiere contraseña actual.

---

# 8. Sección Plan y facturación

## Estado para MVP

Esta sección puede existir sólo para Owner y estar en modo informativo.

No es necesario implementar cobros todavía, pero conviene reservar el espacio.

---

## Acceso por rol

| Rol   | Acceso                |
| ----- | --------------------- |
| Owner | Completo              |
| Admin | Sólo lectura limitada |
| Agent | Sin acceso            |

---

## Información visible

```text
Plan actual
Estado de cuenta
Límite de números
Límite de usuarios
Fecha de renovación
Método de pago
```

Para MVP, se puede mostrar:

```text
Plan actual: Starter
Estado: Activo
```

Y un mensaje:

```text
La administración de pagos estará disponible próximamente.
```

---

# Formulario futuro: cambio de plan

No implementar en MVP, sólo prever.

Campos:

### Plan

- Tipo: cards / radio.
- Opciones:
  - Starter
  - Business
  - Enterprise

### Datos fiscales

- Tipo: formulario.
- Futuro.

### Método de pago

- Tipo: integración externa.
- Futuro.

---

# Estados globales del dashboard

El frontend debe manejar estados globales claros.

---

## Estado: sin números conectados

Cuando un workspace no tiene números:

Mostrar en inicio y conversaciones:

```text
Aún no tienes números de WhatsApp conectados.
Conecta tu primer número para empezar a recibir conversaciones.
```

Botón:

```text
Conectar número
```

Visible sólo para Owner/Admin.

Para Agent:

```text
Aún no hay números conectados. Contacta a un administrador.
```

---

## Estado: número desconectado

Mostrar banner:

```text
El número "Ventas" está desconectado. No se podrán enviar ni recibir mensajes hasta reconectarlo.
```

Acción para Owner/Admin:

```text
Reconectar
```

Para Agent:

```text
Contacta a un administrador.
```

---

## Estado: sin conversaciones

```text
Todavía no hay conversaciones.
Cuando tus clientes escriban por WhatsApp, aparecerán aquí.
```

---

## Estado: error de servicio externo

Si WhatsApp Service API falla:

```text
No pudimos comunicarnos con el servicio de WhatsApp. Intenta de nuevo.
```

Si Bot Service API falla:

```text
La automatización no está disponible temporalmente. La atención manual sigue funcionando.
```

---

## Estado: permisos insuficientes

```text
No tienes permiso para acceder a esta sección.
```

No mostrar botones que el usuario no puede usar.

---

# Onboarding inicial

Cuando una empresa entra por primera vez, el dashboard debe guiarla.

Flujo recomendado:

```text
1. Completa datos de empresa.
2. Conecta tu primer número.
3. Configura horario de atención.
4. Activa respuesta fuera de horario.
5. Invita a tu equipo.
```

---

## Pantalla de bienvenida

Texto sugerido:

```text
Bienvenido a tu panel de WhatsApp Business.
Vamos a conectar tu primer número para que puedas centralizar tus conversaciones.
```

Acciones:

```text
Conectar número
Configurar después
```

---

## Checklist de configuración

Mostrar tarjeta en Inicio:

```text
Configura tu cuenta

[ ] Conectar primer número
[ ] Configurar horario
[ ] Activar respuesta fuera de horario
[ ] Invitar usuarios
```

Cada punto debe llevar a su sección correspondiente.

---

# Navegación por rol

## Menú para Owner

```text
Inicio
Conversaciones
Números de WhatsApp
Automatización
Horarios
Usuarios
Configuración
Plan y facturación
```

---

## Menú para Admin

```text
Inicio
Conversaciones
Números de WhatsApp
Automatización
Horarios
Usuarios
Configuración
```

Plan y facturación puede aparecer sólo lectura o no aparecer.

---

## Menú para Agent

```text
Inicio
Conversaciones
Mi perfil
```

Alternativamente:

```text
Conversaciones
Mi perfil
```

Para agentes, menos es mejor.

---

# Pantallas necesarias para MVP

## Públicas

```text
/login
/forgot-password
/reset-password
```

## Privadas

```text
/dashboard
/conversations
/conversations/:id
/whatsapp-accounts
/whatsapp-accounts/:id
/whatsapp-accounts/:id/connect
/automation
/business-hours
/users
/settings/company
/settings/preferences
/settings/profile
```

---

# Formularios mínimos del MVP

Los formularios indispensables para lanzar son:

```text
Login
Agregar número de WhatsApp
Editar número de WhatsApp
Enviar mensaje
Editar contacto
Asignar conversación
Configurar horario semanal
Configurar respuesta fuera de horario
Crear regla por palabra clave
Editar regla por palabra clave
Invitar usuario
Editar usuario
Datos de empresa
Perfil personal
```

---

# Detalle de formulario: Login

## Campos

### Email

- Tipo: email.
- Requerido: sí.
- Placeholder: `correo@empresa.com`

### Contraseña

- Tipo: password.
- Requerido: sí.
- Placeholder: `Tu contraseña`

### Recordarme

- Tipo: checkbox.
- Requerido: no.

## Botones

```text
Entrar
```

Links:

```text
Olvidé mi contraseña
```

## Validaciones

- Email requerido.
- Email válido.
- Contraseña requerida.
- Mostrar error genérico:
  `Email o contraseña incorrectos.`

---

# Detalle de formulario: recuperar contraseña

## Campos

### Email

- Tipo: email.
- Requerido: sí.

## Botones

```text
Enviar instrucciones
Volver a login
```

## Mensaje de éxito

```text
Si el correo existe, enviaremos instrucciones para restablecer la contraseña.
```

Esto evita revelar si un correo está registrado.

---

# Detalle de formulario: restablecer contraseña

## Campos

### Nueva contraseña

- Tipo: password.
- Requerido: sí.

### Confirmar nueva contraseña

- Tipo: password.
- Requerido: sí.

## Validaciones

- Mínimo 8 caracteres.
- Ambas contraseñas deben coincidir.

---

# Diseño visual recomendado

## Estilo

- Limpio.
- Profesional.
- Similar a herramientas de atención o CRM ligero.
- Mucho espacio en blanco.
- Estados claros.
- Botones primarios evidentes.

## Componentes clave

- Badges de estado.
- Tablas simples.
- Drawers laterales para formularios.
- Modales de confirmación.
- Toasts para éxito/error.
- Skeleton loaders.
- Empty states útiles.
- Banners de advertencia.

---

# Componentes reutilizables sugeridos

```text
WorkspaceSelector
Sidebar
Topbar
StatusBadge
RoleBadge
WhatsAppStatusBadge
ConversationList
ConversationItem
ChatWindow
MessageBubble
MessageComposer
ContactDetailsPanel
UserTable
WhatsAppAccountTable
BusinessHoursEditor
AutomationRuleTable
RuleForm
AfterHoursForm
ConfirmModal
EmptyState
PermissionGuard
```

---

# Reglas de UX importantes

## 1. No mostrar lo que no se puede usar

Si un Agent no puede conectar números, no debe ver el botón.

---

## 2. Explicar errores en lenguaje simple

Malo:

```text
Error 500 external provider failed
```

Bueno:

```text
No pudimos enviar el mensaje porque el número está desconectado.
```

---

## 3. La configuración debe tener vista previa

Especialmente:

- Respuesta fuera de horario.
- Reglas por palabra clave.
- Horario actual.

---

## 4. El usuario debe saber desde qué número responde

En el chat siempre debe mostrarse:

```text
Respondiendo desde: Ventas (+52...)
```

Esto es muy importante si la empresa tiene varios números.

---

## 5. Los mensajes automáticos deben distinguirse

Un agente debe saber cuándo respondió el bot.

---

## 6. No bloquear la atención manual por fallas del bot

Si Bot Service API falla, el chat manual debe seguir funcionando.

---

# Prioridad de construcción frontend

## Fase 1: Operación básica

1. Login.
2. Layout base.
3. Sidebar por rol.
4. Inicio básico.
5. Números de WhatsApp.
6. Conectar número por QR.
7. Conversaciones.
8. Leer mensajes.
9. Responder mensajes.

---

## Fase 2: Automatización MVP

10. Horarios.
11. Respuesta fuera de horario.
12. Reglas por palabra clave.
13. Vista de mensajes automáticos en chat.

---

## Fase 3: Administración

14. Usuarios.
15. Roles.
16. Configuración de empresa.
17. Perfil personal.
18. Preferencias.

---

## Fase 4: Pulido comercial

19. Onboarding.
20. Empty states.
21. Alertas.
22. Actividad reciente.
23. Plan y facturación informativo.

---

# Resultado esperado

Al terminar este dashboard, un cliente debe poder:

1. Entrar a su cuenta.
2. Conectar uno o varios números de WhatsApp.
3. Ver si están conectados.
4. Recibir conversaciones.
5. Leer mensajes.
6. Responder desde el navegador.
7. Configurar horarios.
8. Activar respuesta fuera de horario.
9. Crear respuestas simples por palabra clave.
10. Invitar a su equipo.
11. Operar WhatsApp Business sin depender de un solo teléfono físico.

---

# Criterio de éxito del MVP web

El MVP web estará listo cuando una empresa pueda operar su WhatsApp diario desde el dashboard sin entrar al teléfono.

La prueba práctica:

```text
Una empresa conecta su número,
recibe mensajes,
los agentes responden desde la web,
el sistema responde fuera de horario,
y el administrador puede ver y controlar la operación.
```

Si eso funciona, el producto ya es vendible.
