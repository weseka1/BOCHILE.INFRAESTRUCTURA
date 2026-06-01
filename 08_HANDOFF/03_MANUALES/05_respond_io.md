# Manual: respond.io (conector WhatsApp ↔ Cami)

## ¿Qué es?

respond.io es la herramienta que conecta tu WhatsApp Business con el resto del sistema. Es como un "switchboard" — recibe los mensajes del WA y los dispara a n8n para que Cami los procese, después devuelve la respuesta de Cami al WA.

**Vos casi nunca tenés que entrar acá.** Solo si querés ver chats centralizados, o si Yamil necesita ajustar algo.

## Acceso

- URL: https://app.respond.io/space/413905
- Usuario / Contraseña: ver [04_CREDENCIALES_TRANSFERIDAS.md](../04_CREDENCIALES_TRANSFERIDAS.md)

## Canal conectado (1 solo)

| Nombre | Channel ID | Para qué sirve |
|---|---|---|
| WhatsApp Business (6) | 508111 | Tu WA Bochile productivo donde Cami atiende |

**Canal 508045 (Alquileres):** está conectado pero Cami NO interviene ahí. Solo se loguea cliente↔empleado humano. El depto de Alquileres lo maneja por su cuenta.

## Webhooks configurados (NO TOCAR — son los que disparan a Cami)

| Webhook | Estado | Qué dispara |
|---|---|---|
| **Developer Webhook 1** — Nuevo mensaje entrante | Activo | Cuando un cliente te escribe |
| **Developer Webhook 2** — Nuevo mensaje saliente (sources: User + Echo Message) | Activo | Cuando vos respondés como humano desde WA Business o desde respond.io UI |

Ambos apuntan a: `https://weseka.onrender.com/webhook/bochile-chat`

> Si alguno de estos dos webhooks se desactiva, **Cami deja de funcionar bien** (no recibe mensajes o no detecta el handoff humano).

## ¿Para qué entrar a respond.io?

### 1. Ver todos los chats en una pantalla
Es como un WhatsApp Web mejorado. Buscar contactos, ver historial.

### 2. Responder a clientes con tu equipo
Cada vendedor puede tener su user en respond.io y responder desde la web. Se sincroniza con WA Business.

### 3. Agregar etiquetas/tags a contactos
Útil para filtrar (ej: "lead caliente", "ya visito", "sin presupuesto").

### 4. Crear plantillas de respuestas rápidas
Frases que usás seguido — Snippets. Se insertan con `/` en respond.io.

## Lo que NO hay que hacer en respond.io

- ❌ Desactivar el canal "WhatsApp Business (6)" — todo se cae
- ❌ Borrar los webhooks 1 y 2 — Cami deja de funcionar
- ❌ Cambiar el "Punto final" de los webhooks (la URL https://weseka...)
- ❌ Cambiar las "Fuentes del evento" del webhook saliente (User + Echo Message)

Si tocás algo y se rompe, vení que lo arreglamos rápido pero **avisame primero antes de cambiar config**.

## Si querés agregar un canal nuevo (ej: otro número de WA, Instagram DMs)

Necesita ajuste en el lado n8n también (agregar el nuevo channel_id al mapping). Hablamos antes de hacerlo.
