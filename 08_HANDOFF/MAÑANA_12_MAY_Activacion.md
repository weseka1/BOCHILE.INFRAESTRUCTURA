# 🌅 Checklist 12 mayo · Activación Bochile

**Hora target:** 10:00 AM (1h antes de la reunión 11am)
**Estado actual:** infraestructura 100% construida + auditada. Falta cargar credenciales.

---

## ⏱️ 10:00-10:15 · Cargar credenciales en n8n local

Abrir http://localhost:5680 → **Settings → Credentials → New credential**

### 1. OpenAI API
- Tipo: `OpenAI API`
- Field `API Key`: pegar `sk-...`

### 2. WhatsApp Business Cloud
- Tipo: `WhatsApp API`
- Access Token: `EAA...` (Permanent Token desde Meta App Settings)
- Business Account ID: opcional

### 3. HTTP Header Auth (para audio/imagen Meta)
- Tipo: `Header Auth`
- Name: `Authorization`
- Value: `Bearer EAA...` (el mismo access token del paso 2)
- Nombrarlo: `Meta Graph Token`

### 4. Google Sheets OAuth2
- Tipo: `Google Sheets OAuth2 API`
- Click `Connect` → autenticarse con `ju4nl0pezs@gmail.com`

---

## ⏱️ 10:15-10:20 · Variables de entorno

En la config de n8n local (depende del deploy):

| Variable | Valor |
|---|---|
| `BOCHILE_WA_PHONE_ID` | Phone Number ID de Meta WhatsApp |
| `BOCHILE_GSHEET_ID` | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` |
| `BOCHILE_CARLOS_TEL` | `5492914401120` |

**Restart n8n** después de setear.

---

## ⏱️ 10:20-10:30 · Asignar credenciales a workflows

Abrir cada workflow y asignar:

### W1 (`1mdYkXwFWmKaTLEs` · v3 multimodal · 36 nodos)
| Nodo | Credencial |
|---|---|
| GPT Vendedor CORE / Calificador / Matcher / Admin | OpenAI API |
| Audio - Transcribir Whisper | OpenAI API |
| Imagen - Analizar Vision | OpenAI API |
| Audio - Get URL Meta / Download | Meta Graph Token |
| Imagen - Get URL Meta / Download | Meta Graph Token |
| Responder al Cliente / Avisar Vendedor | WhatsApp API |

### W2-W4 (`f1CC972kzNPR8ebi`, `W327qYVE9SpwQiRi`, `wrFto5o6Zk02sZty`)
Solo WhatsApp API en cada nodo de WhatsApp.

### W5 (`uA4y7AytMBraEiEX`)
Google Sheets OAuth2 en los 8 nodos "Volcar X".

---

## ⏱️ 10:30-10:35 · Test del W1

```bash
curl -X POST http://localhost:5680/webhook/bochile-chat \
  -H "Content-Type: application/json" \
  -d '{"from":"+5492914423398","name":"Lucas Test","message":"Hola busco casa 4 ambientes Palihue presupuesto 280k USD","channel":"whatsapp"}'
```

**Validar:**
- Response 200 con `ok: true`
- En n8n → Executions → ver flow completo verde
- En `bochile_leads` aparece L-2914423398 con score y etapa
- En `bochile_conversaciones` aparecen msg in + out
- (Si llegó al Admin) en `bochile_visitas` aparece nueva visita
- (Si Admin notificó) Carlos Bochile recibe WhatsApp con formato "VISITA AGENDADA..."

---

## ⏱️ 10:35-10:40 · Activar workflows

Toggle **Active** en cada uno (orden):
1. W5 Sync Dashboard
2. W2 Recordatorios
3. W3 Match Retroactivo
4. W4 Cobranza
5. W1 Chatbot CORE (último — el que recibe webhooks de Meta)

---

## ⏱️ 10:40-10:50 · Exponer webhook a Meta

n8n local no es accesible desde Meta. Opciones:

**A · ngrok (rápido para demo):**
```bash
ngrok http 5680
```
URL pública tipo `https://abc123.ngrok.io` → en Meta WhatsApp Business → Configuration → Webhook URL: `https://abc123.ngrok.io/webhook/bochile-chat`

**B · Producción real:** dominio propio con TLS apuntando a tu server.

Subscribe a eventos `messages` en Meta WhatsApp Webhook.

---

## ⏱️ 10:50-11:00 · Test real punta a punta

Desde un teléfono real (tuyo o de prueba), mandar WhatsApp al número Bochile:
- "Hola"
- "Busco casa en Palihue, 4 ambientes, hasta 300 mil USD"
- (Audio testeo) Mandar audio diciendo "tenés algo en Centro?"
- (Imagen testeo) Mandar foto de cualquier casa

**Validar:** Camila responde en <30s, agenda visita, Carlos Bochile recibe notificación.

---

## 🎯 Demo a Bochile (11:00 AM)

### Apertura — 2 min
- "Esto es el sistema completo construido y corriendo. Tres piezas: el cerebro (n8n), la fuente de verdad (Google Sheets), la cara visible (dashboard web)."

### Demo en vivo — 8 min
1. Abrir n8n local → mostrar los 5 workflows verdes (Active). 5 segundos en cada uno.
2. **Test en vivo:** desde tu teléfono mandar WhatsApp diciendo "Hola busco casa Palihue 4 amb 280k USD". Esperar respuesta de Camila. Mostrar:
   - Conversación en WhatsApp
   - Lead creado en `bochile_leads` (ir a Data Tables)
   - Visita agendada en `bochile_visitas`
   - Carlos recibe notificación
3. Abrir el Spreadsheet maestro → mostrar las hojas analíticas con datos sincronizados
4. Abrir el demo HTML → "esto es cómo va a verse el dashboard final para el cliente"

### Cierre — 2 min
- "El sistema atiende 24/7 sin que ustedes hagan nada. La IA califica, agenda, cobra y avisa. Ustedes solo van a la visita y cierran."
- "Cuesta X/mes en infraestructura. Genera tiempo equivalente a 1 vendedor extra."
- "Cuándo arrancamos?"

---

## 🚑 Plan B si algo se rompe en vivo

- WhatsApp no responde: usar el curl de test que ya probamos a las 10:30. Mostrar el flow en n8n.
- Modelo OpenAI da error: cambiar todos los modelos a `gpt-4o-mini` (más estable, más barato).
- Webhook Meta no llega: ngrok caído → reiniciarlo.

---

## 📚 Memoria contextual para Claude mañana

Todo el contexto del proyecto está guardado en `~/.claude/projects/c--Users-46094-Desktop-WESEKA-IA-STRUCTURE/memory/`:
- `bochile_proyecto.md`
- `bochile_n8n_local.md` (IDs, API key, refs técnicas)
- `bochile_credenciales_pendientes.md`
- `bochile_arquitectura_decisiones.md`
- `bochile_instagram_roadmap.md` (fase 2)
- `user_yamil.md`
- `feedback_workflow_estilo.md`

Cuando abras Claude Code mañana en la carpeta Bochile, ya tiene contexto completo.

---

## 🎬 IDs vivos en n8n local (final)

| Recurso | ID |
|---|---|
| W1 Chatbot CORE v3 multimodal | `1mdYkXwFWmKaTLEs` |
| W2 Recordatorios | `f1CC972kzNPR8ebi` |
| W3 Match Retroactivo | `W327qYVE9SpwQiRi` |
| W4 Cobranza | `wrFto5o6Zk02sZty` |
| W5 Sync Dashboard (hardened) | `uA4y7AytMBraEiEX` |
| Data Table leads | `UGNAXqPUX0udDRPi` |
| Data Table propiedades | `UlHoNXfh9nX5W8vn` |
| Data Table visitas | `UJOWnNg9k0BdMMJP` |
| Data Table contratos | `TSBcE3hUHHvzcrr2` |
| Data Table empleados | `pfACps5XOWJo7UME` |
| Data Table matches_pendientes | `X1djtSSRbpiiNMTk` |
| Data Table conversaciones | `B5WIk9wqVUH8Z0t8` |
| Data Table acciones_ia | `XeXT6GunMsOgpGa2` |

---

*Andá a dormir. Mañana es 50 min de copy/paste de credenciales y verificar. El sistema está construido.*
