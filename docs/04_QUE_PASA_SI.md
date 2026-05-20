# 04 - ¿Qué pasa si...?

> FAQ + troubleshooting. Buscá tu síntoma, seguí el fix.

## El bot no responde

**1er paso**: ¿el cliente está suscrito al canal en respond.io?
- respond.io → Contacts → buscar el teléfono → verificar que está y tiene el canal de WhatsApp asignado.

**2do paso**: ¿llegó la request al n8n?
- `https://bochile-n8n.onrender.com` → login → workflows → W1 → ver "Executions". Si NO hay ejecución nueva del lado del W1, respond.io no está disparando el webhook.
  - Verificar en respond.io → Webhooks → ver "Activity log" del webhook (si hubo error de delivery).
  - Verificar la URL del webhook: tiene que ser `https://bochile-n8n.onrender.com/webhook/bochile-chat`.

**3er paso**: ¿el bot está pausado para ese cliente?
- Sheet → `leads` → buscar el teléfono → columna `bot_pausado_hasta`. Si tiene fecha futura, está pausado.
- Borrar el valor para reactivar.

**4to paso**: ¿la conversación está marcada como cerrada?
- Sheet → `leads` → `conversacion_cerrada`. Si es `true`, Cami solo responde si el cliente saluda de nuevo ("hola").
- Para reactivar manual: poner `false`.

**5to paso**: ¿el W1 ejecutó pero falló?
- n8n → W1 → Executions → buscar la última con status "error" (rojo). Click → ver qué nodo falló y por qué.
- Errores comunes:
  - "OpenAI 503" → temporal, intentar de nuevo
  - "Sheet rate limit" → esperar 1 min
  - "RAG timeout" → RAG en cold start, esperar 30s

## Cami responde mal / inventa cosas

**Probable causa**: la memoria buffer in-memory tiene contexto viejo + el historial del Sheet tiene mensajes confusos.

**Fix rápido**:
1. Sheet → `leads` → el cliente → `conversacion_cerrada` = `true`. Después que él escriba "hola" otra vez, arranca limpio.
2. Si Cami sigue mal: pedirle a Juani que cambie el `sessionKey` de la memoria a `_v7` (o el número que siga).

## Veo un lead con datos rotos

Sheet → `leads` → editar directo la fila. Los cambios se reflejan en el dashboard en 30s.

Si querés que Cami "olvide" lo que ya sabía del cliente: borrar todas las filas en `conversaciones` con ese `telefono`. Cami va a verlo como un lead nuevo la próxima vez.

## Quiero pausar el bot por un día entero

Hay 2 formas:

**Forma A — bot completamente off**:
- n8n → W1 → toggle Active OFF.
- Cuando quieras prenderlo, ON de vuelta.

**Forma B — solo pausar el bot pero seguir recibiendo en respond.io**:
- En el W1: agregar un Switch al principio que skipea TODO si está dentro de un horario X. Pero esto requiere edición del workflow.
- Más simple: para cada cliente que escriba, marcar manualmente `bot_pausado_hasta` con la fecha de mañana.

## Una visita se duplicó

Sheet → `visitas` → buscar las 2 filas con datos similares → eliminar la más reciente (manteniendo la más antigua que es la "real").

## El cliente dice que NO le llegó un mensaje que Cami le mandó

- n8n → W1 → Executions → buscar la ejec → ver output del nodo "Responder al Cliente respond.io".
- Si devolvió `{contactId: ..., messageId: ...}` → respond.io aceptó. Es problema del proveedor WhatsApp (Meta).
- Si devolvió 400/401/500 → ver el error específico, suele ser que el contact no está bien creado en respond.io.

## Una propiedad nueva no aparece en las búsquedas de Cami

Cami solo "ve" propiedades que están indexadas en Qdrant. Si agregaste manualmente al Sheet, tenés que correr el re-embed:

- Render Dashboard → bochile-rag → Shell → `npm run embed`
- Tarda ~5-10 min para 250 propiedades.

## El dashboard no carga / muestra error

1. `https://bochile-dashboard-api.onrender.com/api/health` → debe responder `{"status":"ok"}`.
2. Si NO responde: el backend está caído. Render → bochile-dashboard-api → ver logs.
3. Si responde OK pero el frontend no carga: refrescar con Ctrl+F5. Si persiste, ver logs de `bochile-dashboard-ui` en Render.

## OpenAI dio error y se cae todo

- Si es transitorio (503): no hacés nada, OpenAI recupera en minutos.
- Si es por crédito agotado: ir a `platform.openai.com` → Settings → Billing → top up.
- Si es por API key inválida: revisar `OPENAI_API_KEY` en Render → bochile-rag → Environment.

## Cami responde con fechas equivocadas (octubre 2023, etc.)

**Causa**: el bloque CONTEXTO TEMPORAL no se está renderizando bien.

**Fix**: pedirle a Juani que verifique el nodo "Formatear Equipo y Agenda" → debe estar generando el contexto en JS puro (no usar `{{ DateTime.now() }}` que a veces no se evalúa).

## Quiero exportar TODAS las conversaciones para analizar

Sheet → pestaña `conversaciones` → File → Download → CSV.

Si lo querés ya filtrado, podemos armarte un script `scripts/08_export_conversations.cjs` que filtre por rango de fechas. Pedírselo a Juani.

## ¿Y si quiero deshacer el deploy a Render y volver a local?

- Render → pausar todos los servicios.
- En tu PC: seguir `docs/02_COMO_PRENDE.md` modalidad LOCAL.
- En respond.io: actualizar webhook URL a la de cloudflared local.

## ¿Y si Juani no está disponible?

El repo en GitHub tiene TODO. Cualquier dev con experiencia en Node/n8n puede tomar el control:

- README → entender estructura
- DEPLOY.md → cómo deployar
- ARQUITECTURA.md → cómo está armado

Pero ojalá Juani esté disponible.
