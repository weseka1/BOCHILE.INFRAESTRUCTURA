# 11 · Migración a producción 24/7 (Render + respond.io)

Manual maestro para llevar TODO el sistema Bochile a la nube. PC apagada → Cami sigue respondiendo. Esta es la jugada de producción real.

---

## Decisión del 17 may: PC NUNCA es servidor

Juani fue claro: "Cami 24/7 con PC apagada SIEMPRE. Mi PC no es servidor, eso no es escalable."

Por eso TODO va a la nube, incluido el scraper diario (como Render Cron Job). La PC queda solo para desarrollo/debugging local.

## Lo que va a quedar montado

```
┌────────────────────────────────────────────────────────────────────────┐
│  Cliente final (WhatsApp del lead, 24/7)                               │
└────────────────────┬───────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  respond.io (Inbox WhatsApp Business + workflow trigger)               │
│  - Recibe el msg del cliente                                            │
│  - Workflow: POST a https://bochile-n8n.onrender.com/webhook/...        │
│  - Espera respuesta y la manda al cliente vía WA Business               │
└────────────────────┬───────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│  n8n en Render (https://bochile-n8n.onrender.com)                      │
│  - W1 Chatbot Multi-Agente CORE (Cami + 3 sub-agentes)                  │
│  - W2 Recordatorios cron horario                                        │
│  - W3 Match Retroactivo cron 15min                                      │
│  - W4 Cobranza cron diario 9am                                          │
│  - W5 Backup mensual                                                    │
│  - Sub-WF Bochile RAG Search                                            │
└────────┬──────────────────────┬────────────────────────────────────────┘
         │                      │
         ▼                      ▼
┌────────────────────┐   ┌────────────────────────────────────────────────┐
│  Google Sheet      │   │  Bochile RAG (https://bochile-rag.onrender.com)│
│  (fuente verdad)   │   │  - Express + OpenAI embeddings                  │
│  - leads           │   │  - Cliente Qdrant Cloud                          │
│  - propiedades     │   │  - POST /api/search con filtros estrictos        │
│  - visitas         │   └─────────────────────┬──────────────────────────┘
│  - contratos       │                         │
│  - empleados       │                         ▼
│  - conversaciones  │   ┌──────────────────────────────────────────────┐
│  - acciones_ia     │   │  Qdrant Cloud (cloud.qdrant.io)              │
└────────────────────┘   │  - Free tier 1 GB                             │
                         │  - Collection bochile_properties (239+)        │
                         └──────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  TU PC (queda local solo el scraper diario)                            │
│  - Bochile_Scraper (cron diario 6am via Task Scheduler)                 │
│  - Si tu PC está apagada a las 6am, el scrape salta ese día            │
│    (no es crítico, el catálogo de Bochile no cambia tanto)              │
└────────────────────────────────────────────────────────────────────────┘
```

## Costos mensuales nuevos

| Servicio | Plan | Costo |
|---|---|---|
| Render Web Service (bochile-qdrant) | Starter | USD 7 |
| Render Web Service (bochile-n8n) | Starter | USD 7 |
| Render Web Service (bochile-rag) | Starter | USD 7 |
| Render Cron Job (bochile-scraper-diario) | Starter | USD 1 |
| respond.io | Team (5 users, 1000 contactos) | USD 79 |
| OpenAI uso (Cami + embeddings) | pay-as-you-go | USD 10-25 |
| WhatsApp Business API (vía respond.io) | service convs gratis + 0.005/msg | USD 5-15 |
| **Total estimado** | | **USD 116-141/mes** |

**Decisión Juani 17 may**: Qdrant también va a Render (no a Qdrant Cloud). +$7/mes a cambio de todo en un dashboard, sin cuentas extras, latencia sub-ms entre servicios.

> Alternativa más barata para piloto: respond.io plan Free (100 contactos/mes). Total: USD 37-62/mes.

---

## ✅ Checklist · lo que necesito de Juani

Para que YO termine la migración necesito **estas 7 cosas**. Cuando las tengas, pasámelas todas juntas y termino el cableado en 30 min.

### Qdrant — YA NO NECESITAS NADA EXTERNO

Qdrant se levanta como 4to servicio dentro de Render (Docker image oficial). NO usamos Qdrant Cloud. La API key se genera del lado del Render (1 comando) y se setea en el dashboard. URL del Qdrant será automáticamente `https://bochile-qdrant.onrender.com`.

**Lo único**: cuando seteemos los secrets, vas a generar UNA QDRANT_API_KEY (con `openssl rand -hex 32`) y la usás en 3 servicios (qdrant, rag, scraper). Lo hago yo cuando me des los demás secrets.

### GitHub

- [ ] **3. URL del repo** que vas a crear (privado, con la subcarpeta `Bochile_RAG/` adentro)

> Cómo: github.com/new → privado → push de `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/` (incluí `output/properties-enriched.json` para el embed inicial).

### Render

- [ ] **4. Confirmación de que la cuenta tiene los USD 7 ya activos** (lo dijiste, solo confirmación)
- [ ] **5. ¿Conectaste tu GitHub a Render?** (Settings → GitHub → Authorize)

> Render lee el render.yaml del repo automáticamente.

### respond.io

- [ ] **6. API Token de respond.io** (Settings → Integrations → Developer API → Create Token)
- [ ] **7. Channel ID del WhatsApp Business configurado en respond.io** (Settings → Channels → click el de WA → URL contiene el ID)

> Si no tenés respond.io configurado todavía: doc completa en [`10_RESPONDIO_SETUP.md`](10_RESPONDIO_SETUP.md), fases 1-2.

### Google Service Account (para el scraper en Render Cron)

- [ ] **8. Contenido del Service Account JSON** (el que ya tenés en `05_DASHBOARD_WEB/backend/credentials/service-account.json`)

> Lo necesito para subirlo como **Secret File** en el dashboard del bochile-scraper-diario en Render. Eso permite que el cron de la nube escriba al Sheet diariamente sin que tu PC esté prendida.

---

## ✅ Lo que YA hice yo (preparado y esperando tus credenciales)

| Archivo | Estado |
|---|---|
| `Bochile_RAG/render.yaml` | ✅ Reescrito para 2 servicios (n8n + RAG) apuntando a Qdrant Cloud |
| `Bochile_RAG/.env.example` | ✅ Actualizado con QDRANT_URL + QDRANT_API_KEY documentados |
| `Sistema_n8n/exports/_render_export/` | ✅ 6 workflows exportados a JSON portable (W1-W5 + sub-WF RAG) |
| `Sistema_n8n/exports/_export_all_workflows.cjs` | ✅ Script para re-exportar cuando cambies algo en n8n local |
| `08_HANDOFF/10_RESPONDIO_SETUP.md` | ✅ Manual completo de respond.io |
| Este archivo | ✅ Manual maestro de migración |

---

## Pasos de ejecución (cuando me pases las credenciales)

### Fase 1 · Vos hacés (15 min)

1. **Qdrant Cloud**:
   - cloud.qdrant.io → Sign up con la cuenta WESEKA
   - Free Tier → Create Cluster (región us-east o eu-west, da igual)
   - Tab Access → Generate API Key → copiar URL y key

2. **GitHub**:
   - github.com/new → repo privado `bochile-rag`
   - Subir SOLO `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/` (con `output/properties-enriched.json` adentro)
   - Verificar que `.env` NO está committeado (lo cubre `.gitignore`)

3. **Render**:
   - Conectar GitHub si no lo hiciste
   - Dashboard → New + → Blueprint → seleccionar el repo `bochile-rag`
   - Render lee el `render.yaml` y propone crear 2 servicios

4. **respond.io**:
   - Si ya tenés cuenta + canal WA configurado: solo generar API Token (Settings → Developer API)
   - Si no: seguir `10_RESPONDIO_SETUP.md` fases 1-2

5. Pegame las 7 cosas del checklist.

### Fase 2 · Yo hago (30 min con tus credenciales)

1. **Setear secrets en Render** (con las credenciales que me pases):
   - `bochile-n8n`: `N8N_ENCRYPTION_KEY` (generada con openssl), `N8N_BASIC_AUTH_PASSWORD`
   - `bochile-rag`: `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`

2. **Esperar deploy** (Render demora 3-5 min en levantar ambos servicios). Verificación:
   - `curl https://bochile-rag.onrender.com/api/health` → 200 OK
   - `curl https://bochile-n8n.onrender.com/healthz` → 200 OK

3. **Embed inicial en el cluster de Qdrant Cloud**:
   - Render Dashboard → bochile-rag → Shell
   - `npm run embed -- --reset` (carga las 239 propiedades al cluster cloud)

4. **Importar los 6 workflows al n8n de Render**:
   - Abrir `https://bochile-n8n.onrender.com` (login admin con la password que seteamos)
   - Workflows → New Workflow → menu (...) → Import from File
   - Subir uno por uno los 6 JSON de `_render_export/`
   - Para cada workflow, reasignar credenciales en los nodos que lo piden (n8n te marca los nodos amarillos)
   - Activar cada workflow (toggle verde)

5. **Crear credenciales en el n8n de Render**:
   - OpenAI account (la misma API key)
   - Google Sheets OAuth2 (re-autenticar con `ju4nl0pezs@gmail.com`)
   - Google Drive OAuth2 (idem)
   - respond.io HTTP Header Auth (`Authorization: Bearer <API_TOKEN>`)

6. **Actualizar el sub-workflow `Bochile RAG Search`** para que apunte a la URL pública de Render:
   - Code node `Call RAG and Format`
   - Cambiar `RAG_URL = 'http://host.docker.internal:3003/api/search'` por `RAG_URL = 'https://bochile-rag.onrender.com/api/search'`

7. **Modificar el W1 para que use respond.io en lugar de Twilio**:
   - Nodo `Responder al Cliente Twilio` → reemplazar por HTTP Request POST a respond.io API
   - Nodo `Avisar Vendedor por WhatsApp Twilio` → idem
   - Doc paso a paso en `10_RESPONDIO_SETUP.md` Fase 3

8. **Configurar workflow en respond.io** para que reenvíe mensajes al webhook de n8n:
   - respond.io Dashboard → Workflows → New Workflow
   - Trigger: Message Received
   - Step 1: HTTP Request POST a `https://bochile-n8n.onrender.com/webhook/bochile-chat` con payload Twilio-compatible
   - Step 2: Send Message con `{{n8n_response.body.respuesta}}`
   - Doc completa en `10_RESPONDIO_SETUP.md` Fase 2

### Fase 3 · Test E2E (10 min)

1. Apagar Docker Desktop local de la PC de Juani (Qdrant local + n8n local)
2. Verificar que el sistema sigue UP:
   - `curl https://bochile-rag.onrender.com/api/health` → 200
   - `curl https://bochile-n8n.onrender.com/healthz` → 200
3. Mandar mensaje al WhatsApp Business desde el celular:
   > "Hola, busco casa en Bahía Blanca 3 ambientes hasta 200k USD"
4. Esperar respuesta de Cami por WhatsApp
5. Verificar:
   - Lead creado en el Sheet (pestaña `leads`)
   - Conversación registrada en `conversaciones`
   - Cami responde con 2-3 propiedades reales del catálogo

Si funciona → migración completa, Cami funciona 24/7 sin tu PC.

### Fase 4 · Cleanup local (opcional)

Una vez validado que la nube funciona:

1. Apagar n8n local: `cd 00_SISTEMA_INTERNO/n8n-infra && docker compose down`
2. Apagar Qdrant local: `docker stop qdrant` (cuidado si lo compartís con WSK_SALES_MACHINE)
3. Mantener scraper local + Task Scheduler corriendo (no afecta nada, sigue alimentando el catálogo)
4. Sacar ngrok del autostart (ya no se necesita)

---

## Cuándo querés volver a la PC local (rollback)

Si por algún motivo Render falla y querés volver al setup local:

1. n8n local: `cd 00_SISTEMA_INTERNO/n8n-infra && docker compose up -d` → restaura el estado previo
2. RAG local: `cd 04_INFRAESTRUCTURA_TECNICA/Bochile_RAG && npm run dev` → puerto 3003
3. Cambiar la URL del sub-workflow `Bochile RAG Search` de vuelta a `http://host.docker.internal:3003/api/search`
4. ngrok http 5680 → URL pública para Twilio
5. Cambiar webhook en Twilio Console

Backups de todos los workflows: `Sistema_n8n/exports/_backups/`.

---

## Detalles técnicos importantes

### N8N_ENCRYPTION_KEY

Es la key que n8n usa para encriptar las credenciales guardadas. **Si la perdés, perdés acceso a todas las credenciales** (hay que reingresarlas). Backup obligatorio en password manager.

Para generar una:
```bash
openssl rand -hex 32
```

### Qdrant Cloud free tier — límites

- 1 GB storage (suficiente para ~700K propiedades a 1536 dims)
- 1 cluster
- Si se llena: upgrade a paid tier (~USD 25/mes para 4 GB)
- Bochile va a usar < 5 MB → free tier para siempre

### Migración del scraper diario

El scraper sigue corriendo local en tu PC vía Task Scheduler (`run-cron.bat`). Cambia 1 línea:

```bash
# .env del scraper / del RAG local
QDRANT_URL=https://abcd.us-east.aws.cloud.qdrant.io:6333  # tu cluster cloud
QDRANT_API_KEY=<la key>
```

Cuando el scraper corre a las 6am, ahora vuelca el embed directo al cluster cloud. La sincronización es transparente.

### Por qué no movemos también el scraper a Render

Podríamos (Render Cron Job, USD 1/mes extra). Pero:
- El scraper solo corre 1 vez/día
- Si tu PC está apagada a las 6am, el catálogo no se actualiza ese día — no es crítico
- Mantenerlo local te da más control y debugging fácil

Si querés moverlo: render.yaml soporta `type: cron` con schedule cron. Doc en RENDER_DEPLOY.md.

---

## Doc relacionada

- `08_RAG_QDRANT.md` — Cómo funciona el RAG
- `09_CAMI_HUMANA.md` — Personalidad de Cami
- `10_RESPONDIO_SETUP.md` — Manual respond.io
- `04_QUE_PASA_SI.md` — Troubleshooting general
- `06_CONTACTOS_Y_CUENTAS.md` — URLs y credenciales
- `Bochile_RAG/render.yaml` — Blueprint de Render
- `Sistema_n8n/exports/_render_export/` — JSONs de workflows para importar
