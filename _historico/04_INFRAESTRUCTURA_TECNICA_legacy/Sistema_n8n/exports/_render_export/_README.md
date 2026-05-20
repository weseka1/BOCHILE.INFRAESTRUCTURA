# Workflows exportados para n8n en Render

Estos 6 JSON son los workflows del n8n local de Bochile, listos para importar en `https://bochile-n8n.onrender.com`.

## Orden de importación recomendado

1. **`SUB_Bochile_RAG_Search_v_render.json`** primero (porque W1 lo invoca)
2. **`W1_Chatbot_Multi_Agente_CORE_v_render.json`** (el principal — Cami)
3. **`W2_Recordatorios_Visitas_v_render.json`**
4. **`W3_Match_Retroactivo_v_render.json`**
5. **`W4_Cobranza_Alquileres_v_render.json`**
6. **`W5_Backup_Mensual_v_render.json`**

## Pasos para cada workflow

1. Abrir `https://bochile-n8n.onrender.com` (login con admin + N8N_BASIC_AUTH_PASSWORD)
2. Workflows → New → menú (...) → **Import from File** → seleccionar el JSON
3. n8n carga el workflow. Vas a ver nodos amarillos: son los que necesitan credencial.
4. Reasignar credenciales: clickear cada nodo amarillo → seleccionar la credencial correspondiente (que tenés que crear primero, ver abajo).
5. **Save**.
6. Una vez que NO hay nodos amarillos, **Activate** (toggle verde arriba a la derecha).

## Credenciales a crear en el n8n de Render

ANTES de importar workflows, crear estas credenciales en Settings → Credentials:

| Tipo | Nombre sugerido | Para qué |
|---|---|---|
| **OpenAi account** | `OpenAi account` | Cami + Calificador + Matcher + Admin + Whisper + Vision |
| **Google Sheets OAuth2 API** | `Google Sheets account` | Todos los nodos googleSheets / googleSheetsTool |
| **Google Drive OAuth2 API** | `Google Drive account` | W5 backup mensual |
| **HTTP Header Auth** | `respond.io API` | Header `Authorization: Bearer <TOKEN>` para mandar mensajes via respond.io |

**Nota sobre la migración Twilio → respond.io**:

El W1 actual tiene 2 nodos Twilio que hay que reemplazar:
- `Responder al Cliente Twilio` (envío al lead)
- `Avisar Vendedor por WhatsApp Twilio` (notificación al vendedor)

Cuando importes el W1 al n8n de Render, esos 2 nodos van a quedar con error (no hay credencial Twilio en Render). Reemplazalos por **HTTP Request** apuntando a `https://api.respond.io/v2/contact/phone:{{$json.telefono}}/message` con la credencial `respond.io API`. Doc paso a paso en [`../08_HANDOFF/10_RESPONDIO_SETUP.md`](../../../../08_HANDOFF/10_RESPONDIO_SETUP.md) Fase 3.

## Variables de entorno que necesitan los workflows

Setearlas en bochile-n8n Render → Environment:

```
BOCHILE_GSHEET_ID=1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4
BOCHILE_CARLOS_TEL=5492914401120
BOCHILE_CAMILA_TEL=5492914413200
RESPONDIO_API_TOKEN=<tu token>
RESPONDIO_CHANNEL_ID=<tu channel id>
```

## URLs internas pre-configuradas

- Sub-workflow `Bochile RAG Search` ya tiene **`https://bochile-rag.onrender.com/api/search`** hardcodeado en el Code node `Call RAG and Format`. No hay que tocarlo después del import.

## Si algo se rompe en producción

Backup automático: `_backups/` tiene snapshots históricos del W1 de cuando estaba local. Para volver al estado local exacto, importar `W1_pre_RAG_*.json`.
