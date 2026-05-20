# 10 · Setup respond.io para Camila

Manual completo para conectar Bochile a respond.io (WhatsApp Business API) en lugar de Twilio Sandbox.

---

## ESTADO ACTUAL (2026-05-17) — LISTO PARA TESTEAR

El swap Twilio → respond.io **ya está hecho** en local. Resumen para Yamil:

- ✅ **W1 (Cami)**: 2 nodos respond.io (Responder al Cliente + Avisar Vendedor por tool)
- ✅ **W2 (Recordatorios)**: 2 nodos respond.io (Cliente + Vendedor)
- ✅ **W3 (Match Retroactivo)**: 1 nodo respond.io (Aviso al Lead)
- ✅ **W4 (Cobranza)**: 2 nodos respond.io (Inquilino + Escalar a Camila)
- ✅ **Parser W1** acepta payload de respond.io Y de Twilio (compat dual)
- ✅ **OK al Webhook** devuelve JSON 200 (era TwiML XML)
- ✅ **Credencial `respond.io API`** (id `ZKhcvjnvP6IpEK6w`) linkeada en todos los nodos
- ✅ **Channel ID `503760`** hardcodeado en todos los body JSON

### Datos clave del setup

| Cosa | Valor |
|---|---|
| URL inbound webhook (LOCAL via ngrok) | `https://718f-2800-560-fd-4b00-8564-63de-b4fe-c97.ngrok-free.app/webhook/bochile-chat` |
| URL inbound webhook (RENDER, cuando deployemos) | `https://bochile-n8n.onrender.com/webhook/bochile-chat` |
| Método | POST |
| Auth | ninguna (es webhook abierto) |
| Channel ID respond.io | `503760` |
| Credencial respond.io en n8n | `respond.io API` (httpHeaderAuth, header `Authorization: Bearer <JWT>`) |

### Payload que respond.io tiene que mandar a n8n (inbound)

El parser del W1 detecta automáticamente si es respond.io o Twilio. Para respond.io usar este formato:

```json
{
  "event_type": "message.received.text",
  "contact": {
    "id": 12345,
    "firstName": "Juan",
    "lastName": "Perez",
    "phone": "+5492914000111"
  },
  "message": {
    "type": "text",
    "text": "hola, busco una casa en Palihue"
  },
  "channel": {
    "id": 503760,
    "source": "whatsapp"
  }
}
```

Para **audio**: `message.type = "audio"` + `message.attachment.url = "<URL pública del audio>"`.
Para **imagen**: `message.type = "image"` + `message.attachment.url = "<URL pública de la foto>"`.

El parser mapea automáticamente: `contact.phone` → `telefono`, `contact.firstName + lastName` → `nombre`, `message.text` → `mensaje_original`, `canal = "whatsapp_respondio"`.

### Cómo configurar el workflow en respond.io (en 5 minutos)

1. **respond.io Dashboard → Workflows → Create Workflow**
2. **Trigger**: `Message Received` (filtrar por canal WhatsApp si tenés varios)
3. **Step 1 · HTTP Request** (este es el bloque que llama a n8n):
   - Method: **POST**
   - URL: usar la URL del cuadro de arriba según local/render
   - Headers: `Content-Type: application/json`
   - Body (Raw JSON): pegar el JSON del cuadro de arriba reemplazando con las variables de respond.io:
     ```
     {
       "event_type": "message.received.text",
       "contact": {
         "id": {{contact.id}},
         "firstName": "{{contact.firstName}}",
         "lastName": "{{contact.lastName}}",
         "phone": "{{contact.phone}}"
       },
       "message": {
         "type": "text",
         "text": "{{lastIncomingMessage.text}}"
       },
       "channel": { "id": 503760, "source": "whatsapp" }
     }
     ```
   - **Save Response As**: `n8n_ok` (no se usa para responder porque Cami responde async via API, pero conviene loguearlo)
4. **Save + Activate** el workflow

### Cómo Cami responde al cliente (outbound)

NO usamos webhook bidireccional. Cami responde **directo a la API REST de respond.io** desde el nodo "Responder al Cliente respond.io" del W1:

```
POST https://api.respond.io/v2/contact/phone:<telefono_sin_+>/message
Headers: Authorization: Bearer <JWT> + Content-Type: application/json
Body:
{
  "channelId": 503760,
  "message": { "type": "text", "text": "<respuesta de Cami>" }
}
```

Esto significa: respond.io recibe el msg → llama webhook n8n → n8n procesa con Cami → n8n llama API respond.io con la respuesta → respond.io envía WhatsApp al cliente.

**Importante**: para que el cliente reciba el mensaje, el `phone` del Body tiene que coincidir con un contacto YA EXISTENTE en respond.io. Si es un cliente nuevo (primer contacto), respond.io lo crea automáticamente al recibir su mensaje (en el inbound), así que para cuando Cami responde el contacto ya existe.

### Doble webhook para audit (capturar IN + OUT) — feature pedido por Yamil

Si querés guardar absolutamente todos los mensajes (entrada + salida) en un sistema separado, podés:

- **Webhook IN**: configurar un segundo `HTTP Request` en el workflow de respond.io que mande copia del payload de entrada a un URL tuya de logging (ej. otro endpoint n8n `webhook/log-inbound`)
- **Webhook OUT**: en n8n W1, después del nodo "Responder al Cliente respond.io", agregar un nodo HTTP Request que mande a `webhook/log-outbound` con `{telefono, mensaje_cami, timestamp}`

Estos 2 webhooks son la fuente de verdad para auditoría. Los podés mandar al mismo Sheet o a un sistema externo.

### Testeo end-to-end (recetario corto)

```powershell
# Simular un inbound de respond.io desde la PC (sin tocar respond.io)
$payload = @{
  event_type = "message.received.text"
  contact = @{ id = 99999; firstName = "Yamil"; lastName = "Test"; phone = "+5492914000111" }
  message = @{ type = "text"; text = "hola, busco casa en Palihue 3 amb hasta 250k USD" }
  channel = @{ id = 503760; source = "whatsapp" }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://localhost:5680/webhook/bochile-chat" -Method POST -Body $payload -ContentType "application/json"
# Esperado: { ok: true, received_at: "..." } en menos de 60s
```

Después, en n8n UI → Executions del W1 → ver el último run y confirmar:
- Parser → `telefono: 5492914000111`, `canal: whatsapp_respondio`, `nombre: Yamil Test` ✓
- Vendedor CORE → output con respuesta de Cami ✓
- Responder al Cliente respond.io → 200 OK (o 404 "Contact not found" si el número no existe en respond.io)
- Registrar Accion IA → 200 OK (escribe a Sheet)

### ⚠️ Pendiente operativo (Juani)

- **Re-autenticar credencial Google Sheets en n8n UI**: el refresh token expiró. Settings → Credentials → "Google Sheets account" → "Reconnect" → autorizar. Sin esto, no se logean acciones IA en el Sheet (pero Cami sigue respondiendo).

---

## Por qué respond.io vs Twilio

| | Twilio Sandbox (hoy) | respond.io (objetivo) |
|---|---|---|
| Costo | USD 0 + límite 50 msg/día | Plan gratis hasta 100 contactos/mes · Plan Pro USD 79/mes ilimitado |
| Setup | 5 min | 1-2 días (aprobación Meta) |
| Atiende a cualquiera | NO (solo los que hicieron `join`) | SÍ |
| Número propio | NO | SÍ (de Meta WhatsApp Business) |
| Inbox unificado | NO | SÍ (Instagram, FB, WA, web chat) |
| Workflows visuales | NO | SÍ (constructor drag-and-drop) |
| API para n8n | SÍ (webhook) | SÍ (webhook bidireccional + REST API) |
| Plantillas WhatsApp | NO | SÍ (HSM templates aprobadas por Meta) |
| Análitica | Básica | Avanzada (response time, agents, tags) |

**Decisión para Bochile**: respond.io es la jugada profesional. Twilio queda como backup para desarrollo.

---

## Fase 1 · Crear cuenta y conectar WhatsApp

### 1.1 · Cuenta respond.io

1. https://respond.io/ → Sign Up
2. Plan inicial: **Free** (hasta 100 contactos/mes) para testear, después pasás a **Pro** (USD 79/mes ilimitado).

### 1.2 · Conectar WhatsApp Business API

Hay 2 caminos:

**Opción A · Vía respond.io directo (recomendado):**
- En Dashboard → Settings → Channels → Add Channel → WhatsApp
- Sigue el wizard, te pide número de teléfono, lo verifica con Meta, configura HSM templates
- Tiempo: 1-3 días por aprobación Meta
- Costo: USD 1.5/mes (número) + USD 0.005/msg saliente

**Opción B · Vía proveedor BSP existente (más rápido si ya tenés WA Business):**
- Si ya tenés número Twilio WhatsApp Business: conectar Twilio como BSP a respond.io
- Settings → Channels → Add → Twilio → pegar credenciales

### 1.3 · Verificar conexión

En **Inbox** debería aparecer tu canal WhatsApp activo. Mandate un mensaje de prueba desde otro teléfono al número configurado — tiene que aparecer en el inbox respond.io.

---

## Fase 2 · Configurar webhook hacia n8n (mensajes entrantes)

Cuando llega un mensaje a respond.io, queremos que respond.io lo reenvíe automáticamente al webhook de n8n para que Camila lo procese.

### 2.1 · Workflow en respond.io

1. **Dashboard → Workflows → Create Workflow**
2. **Trigger**: `Conversation Opened` o `Message Received`
3. **Step 1 · HTTP Request**:
   - Method: **POST**
   - URL: `https://<tu-ngrok>.ngrok-free.dev/webhook/bochile-chat` (o el dominio que uses para n8n)
   - Body (JSON):
     ```json
     {
       "From": "whatsapp:{{contact.phone}}",
       "ProfileName": "{{contact.firstName}} {{contact.lastName}}",
       "Body": "{{message.text}}",
       "NumMedia": "0",
       "respondio_contact_id": "{{contact.id}}",
       "respondio_message_id": "{{message.id}}"
     }
     ```
   - Headers: `Content-Type: application/json`
   - Output variable: `n8n_response` (para usar la respuesta)
4. **Step 2 · Send a Message**:
   - Source: `{{n8n_response.body.respuesta}}` ← el W1 ya devuelve este campo
   - Channel: WhatsApp del contacto
5. **Save + Activate** el workflow

### 2.2 · ¿Y si el lead manda audio o imagen?

El W1 ya soporta audio (Whisper) y imagen (Vision). Adaptar el HTTP Request:

```json
{
  "From": "whatsapp:{{contact.phone}}",
  "ProfileName": "{{contact.firstName}} {{contact.lastName}}",
  "Body": "{{message.text}}",
  "NumMedia": "{{message.attachments.length}}",
  "MediaUrl0": "{{message.attachments[0].url}}",
  "MediaContentType0": "{{message.attachments[0].type}}"
}
```

El nodo `Parsear Mensaje` del W1 detecta `NumMedia > 0` y rutea al flujo audio/imagen.

### 2.3 · Test

Mandá un mensaje al número WhatsApp configurado en respond.io. En 5-10 segundos:
- respond.io recibe el mensaje
- Ejecuta el workflow → POST al webhook n8n
- n8n procesa con Camila
- n8n devuelve `{ ok: true, lead_id, respuesta }` en el body
- respond.io lee `respuesta` y lo manda al cliente
- El cliente recibe el WhatsApp de Cami

---

## Fase 3 · Cami responde via respond.io API (alternativa al webhook bidireccional)

Si en lugar de que respond.io espere la respuesta del webhook (Fase 2), preferís que Cami responda PROACTIVAMENTE (ej. recordatorios W2, cobranza W4), hay que usar la API REST de respond.io.

### 3.1 · Generar API token

1. respond.io Dashboard → Settings → Integrations → **Developer API**
2. **Create Token** → copiar el token (formato `eyJ...`)

### 3.2 · Endpoint para mandar mensaje

```bash
curl -X POST "https://api.respond.io/v2/contact/phone:5491100000000/message" \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": <ID_CANAL_WA>,
    "message": {
      "type": "text",
      "text": "Hola, te escribo de Bochile..."
    }
  }'
```

### 3.3 · En n8n: reemplazar nodos Twilio por HTTP Request a respond.io

En el **W1 nodo "Responder al Cliente Twilio"** (y "Avisar Vendedor por WhatsApp Twilio"), reemplazar por:

- **HTTP Request**:
  - URL: `https://api.respond.io/v2/contact/phone:{{ $json.telefono.replace('+', '') }}/message`
  - Method: POST
  - Authentication: Header Auth (nombre: `Authorization`, valor: `Bearer <TU_TOKEN>`)
  - Body JSON:
    ```javascript
    {
      "channelId": {{ $env.RESPONDIO_CHANNEL_ID }},
      "message": {
        "type": "text",
        "text": "{{ $json.respuesta_camila }}"
      }
    }
    ```

Crear credential **HTTP Header Auth** en n8n con nombre `respond.io API` para no hardcodear el token.

Setear env vars en el `docker-compose.yml`:
```yaml
RESPONDIO_CHANNEL_ID: "123456"
```

---

## Fase 4 · Identificación de leads (sincronizar respond.io ↔ Sheet)

respond.io tiene su propio sistema de contactos. Para que cada lead del Sheet de Bochile tenga un `respondio_contact_id` asociado:

### Opción A · n8n busca/crea contacto en respond.io al recibir mensaje

En el flujo del W1, agregar un nodo nuevo después del Webhook que:
1. Toma el teléfono del mensaje
2. Busca el contacto en respond.io via API: `GET /v2/contact/phone:{tel}`
3. Si no existe, lo crea: `POST /v2/contact`
4. Pasa el `contact_id` al resto del flujo

Cuando Cami quiera responder, lo hace por `contact_id` (más confiable que por teléfono).

### Opción B · Mantener teléfono como identificador (simple)

El W1 actual usa teléfono como `lead_id`. Si respond.io también usa teléfono, no hace falta sincronizar.

**Recomendación**: empezar con Opción B (más simple), migrar a A si el volumen escala.

---

## Fase 5 · Plantillas WhatsApp (para mensajes proactivos)

Meta WhatsApp Business solo permite mensajes proactivos (que la marca inicia) usando **plantillas HSM** preaprobadas.

Para Bochile, recomendamos crear estas templates:

| Nombre | Caso de uso | Texto plantilla |
|---|---|---|
| `recordatorio_visita_24h` | W2 recordatorio 24h antes | "Hola {{1}}, te recuerdo que tenés una visita mañana a las {{2}} en {{3}}. Te paso a verla yo, soy Cami. ¿Te queda bien?" |
| `recordatorio_visita_1h` | W2 recordatorio 1h antes | "Hola {{1}}, en una hora nos vemos en {{2}}. Llevo las llaves. ¡Hasta enseguida!" |
| `cobranza_recordatorio` | W4 5 días antes vencimiento | "Hola {{1}}, te recuerdo que el {{2}} vence el alquiler de {{3}} por ARS {{4}}. Cualquier consulta, escribime." |
| `match_pendiente_aviso` | W3 cuando aparece prop | "Hola {{1}}, te tengo una novedad: entró una {{2}} en {{3}} por USD {{4}} que matchea con lo que buscabas. ¿Te paso el link?" |

Plantillas se crean en: **respond.io → Settings → WhatsApp Templates → New Template**. Meta las aprueba en 24h.

---

## Fase 6 · Migrar todo el flow

Una vez configurado respond.io, modificá el `docker-compose.yml` de n8n:

```yaml
environment:
  RESPONDIO_API_KEY: "${RESPONDIO_API_KEY}"
  RESPONDIO_CHANNEL_ID: "${RESPONDIO_CHANNEL_ID}"
  WEBHOOK_URL: "https://tu-dominio.com/"  # respond.io necesita HTTPS, idealmente con tu dominio propio
```

Y desactivar los nodos Twilio del W1 (los podés dejar como "fallback" si querés).

---

## Pricing

### respond.io
- Free: hasta 100 contactos/mes (suficiente para testing).
- Team: USD 79/mes (hasta 5 usuarios, 1000 contactos).
- Pro: USD 159/mes (10 usuarios, contactos ilimitados).
- Business: USD 279/mes (25 usuarios, AI agent built-in).

### Meta WhatsApp Business API
- Conversaciones gratis: 1000 service conversations/mes (iniciadas por el cliente).
- Después: USD 0.0085 por mensaje saliente.
- Templates marketing: USD 0.005 por mensaje.

**Estimado mensual Bochile** (asumiendo 500 conversaciones, 200 visitas):
- respond.io Team: USD 79
- Meta WA: USD ~10 (la mayoría de las conversaciones son service, gratis las primeras 1000)
- **Total**: USD ~90/mes

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| Workflow respond.io no dispara | Trigger mal configurado | Verificar que el canal WA esté seleccionado en el trigger |
| n8n no responde el webhook | Twilio sigue siendo el destino | Asegurate que el body del HTTP Request a n8n use formato Twilio compatible |
| Cliente recibe respuesta vacía | `respond.io workflow` no lee `n8n_response.body.respuesta` | Verificar variable de Output del HTTP Request |
| Mensaje saliente falla con 401 | Token expirado o mal | Regenerar en respond.io Settings → Developer API |
| Plantilla rechazada por Meta | Texto promocional | Revisar guidelines: no spam, no urgencia falsa, no contenido prohibido |

---

## Checklist final antes de mandar al cliente real

- [ ] Cuenta respond.io creada (plan Team o Pro)
- [ ] Número WhatsApp Business aprobado por Meta
- [ ] Workflow respond.io activo: recibe mensaje → POST a n8n → manda respuesta
- [ ] n8n W1 actualizado para responder via respond.io API (en lugar de Twilio)
- [ ] 4 plantillas HSM creadas y aprobadas
- [ ] Probado con tu WhatsApp personal: mandás "Hola" → recibís respuesta de Cami en menos de 30s
- [ ] Probado audio: mandás audio → Cami transcribe + responde
- [ ] Probado foto: mandás foto → Cami describe + responde
- [ ] Notificación al vendedor por WhatsApp funciona
- [ ] Recordatorios automáticos W2 funcionan
- [ ] Dashboard refleja conversaciones nuevas

---

## Migración desde Twilio (cuando estés listo)

1. Configurar respond.io según fases 1-3
2. Probar en paralelo (Twilio sigue activo + respond.io recibe los nuevos mensajes)
3. Una vez validado, en n8n W1 → desactivar el webhook Twilio + activar el de respond.io
4. Bajar el ngrok actual + apuntar respond.io a la URL pública nueva
5. Cancelar el plan Twilio (o dejarlo USD 0 como backup)

---

## Doc relacionada

- W1 Chatbot Multi-Agente: [`01_QUE_ES_ESTO.md`](01_QUE_ES_ESTO.md)
- Cómo prende el sistema: [`02_COMO_PRENDE.md`](02_COMO_PRENDE.md)
- Troubleshooting general: [`04_QUE_PASA_SI.md`](04_QUE_PASA_SI.md)
- Cami la humana: [`09_CAMI_HUMANA.md`](09_CAMI_HUMANA.md)
- RAG + Qdrant: [`08_RAG_QDRANT.md`](08_RAG_QDRANT.md)
