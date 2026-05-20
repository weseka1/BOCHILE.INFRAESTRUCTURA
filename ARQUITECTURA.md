# ARQUITECTURA.md — Cómo funciona Cami por dentro

> Para developers / arquitectos. Decisiones de diseño + diagrama detallado.

---

## Diagrama maestro

```
                                ┌─────────────────────────────┐
                                │     Cliente WhatsApp        │
                                └──────────────┬──────────────┘
                                               │
                                ┌──────────────▼──────────────┐
                                │  WhatsApp Business API      │
                                │  (proveedor: respond.io)    │
                                └──────────────┬──────────────┘
                                               │ webhook
                                               │ (POST con HMAC firma)
                                               │
              ┌────────────────────────────────▼─────────────────────────────────┐
              │                       n8n Cloud (Render)                          │
              │                                                                    │
              │   ┌────────────────┐                                              │
              │   │  Webhook       │                                              │
              │   │  Respond.io    │                                              │
              │   └───────┬────────┘                                              │
              │           │                                                       │
              │   ┌───────▼────────┐   skip_humano   ┌────────────────┐         │
              │   │  Parser        ├─────────────────►  Marcar pausa  │         │
              │   │  (HMAC + flags)│                  │  (24h)         │         │
              │   └───────┬────────┘                  └────────────────┘         │
              │           │ normal flow                                          │
              │   ┌───────▼────────┐                                              │
              │   │  Wait 7s       │ ← batching (consolida msgs entrantes)      │
              │   │  + Consolidate │                                              │
              │   └───────┬────────┘                                              │
              │           │                                                       │
              │   ┌───────▼────────┐                                              │
              │   │ Switch tipo:   │                                              │
              │   │ texto/audio/img│                                              │
              │   └─┬────┬────┬────┘                                              │
              │     │    │    │                                                   │
              │     │  Whisper Vision+CLIP                                        │
              │     ▼    ▼    ▼                                                   │
              │   ┌─────────────────┐                                            │
              │   │ Merge + Upsert  │ ← actualiza leads en Sheet                 │
              │   │ Lead CRM        │                                            │
              │   └────────┬────────┘                                            │
              │            │                                                     │
              │   ┌────────▼─────────┐                                          │
              │   │ Check bot activo │ ← lee bot_pausado_hasta + conversacion_cerrada │
              │   └────────┬─────────┘                                          │
              │            │ activo                                              │
              │   ┌────────▼──────────────┐                                     │
              │   │ Cargar historial      │ ← lee últimas convs del Sheet      │
              │   │ + empleados + visitas │                                     │
              │   │ + feriados            │                                     │
              │   └────────┬──────────────┘                                     │
              │            │                                                     │
              │   ┌────────▼──────────┐                                         │
              │   │ Formatear contexto│ ← arma bloque CONTEXTO TEMPORAL +      │
              │   │ (JS puro)         │   EQUIPO Y AGENDA en JS confiable      │
              │   └────────┬──────────┘                                         │
              │            │                                                     │
              │   ┌────────▼──────────────────────────┐                         │
              │   │  Vendedor CORE (GPT-4o agent)     │                         │
              │   │  + memoria buffer (in-memory)     │                         │
              │   │  + 3 sub-agentes:                 │                         │
              │   │     ├─ Calificador (score lead)   │                         │
              │   │     ├─ Matcher (RAG search)       │ ────► RAG server       │
              │   │     └─ Administrativo (CRUD)      │                         │
              │   └────────┬──────────────────────────┘                         │
              │            │ respuesta natural argentina                         │
              │   ┌────────▼────────┐                                            │
              │   │ Responder       │ POST a respond.io API                     │
              │   │ al Cliente      │                                            │
              │   └─────────────────┘                                            │
              └───────────────────────────────────────────────────────────────────┘

                                        │
                       ┌────────────────┼──────────────────┐
                       │                │                  │
              ┌────────▼─────┐  ┌───────▼──────┐  ┌────────▼─────┐
              │ RAG server   │  │ Google Sheet │  │ Dashboard    │
              │ (Render)     │  │ (DB)         │  │ (UI+API)     │
              │              │  │              │  │              │
              │ • text RAG   │  │ • leads      │  │ • Vista      │
              │ • CLIP visual│  │ • props      │  │   ejecutiva  │
              │ • Qdrant     │  │ • visitas    │  │ • Edición    │
              │   Cloud      │  │ • empleados  │  │   manual     │
              │ • hybrid     │  │ • feriados   │  │              │
              │   filter por │  │ • visitas    │  │              │
              │   ambiente   │  │ • convs      │  │              │
              └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Decisiones técnicas clave

### 1. ¿Por qué Sheet-as-DB en vez de Postgres/Mongo?

- **Pros**: visibilidad inmediata, edición no técnica, backup gratis, integración nativa con n8n.
- **Contras**: lento (60 reads/min limit), no escala a 10M filas, sin transacciones.
- **Decisión**: para Bochile (~5k leads/año), Sheets sobra. Si crece a 50k+, migrar a Postgres.

### 2. ¿Por qué n8n self-host en vez de n8n Cloud?

- n8n Cloud cuesta USD 20/mes por starter, USD 50 por pro.
- Render Docker con disco persistente: USD 25/mes pero con control total + sin límites de exec.
- Lo importante: `N8N_ENCRYPTION_KEY` constante (sino las credenciales se rompen al reiniciar).

### 3. ¿Por qué CLIP local en vez de Vision-LLM solo?

- Vision-LLM (GPT-4o vision) cuesta USD 0.001 por imagen. 100 reqs/día = USD 3/mes.
- CLIP local es 0 costo en producción (modelo de 150 MB se descarga 1 vez).
- Para **identificar propiedad** (no describir), CLIP es 10× más rápido (no espera HTTP a OpenAI).
- **Hybrid**: usamos CLIP para visual + Vision-LLM para clasificar ambiente + texto para desambiguar. Mejor de los mundos.

### 4. ¿Por qué Qdrant en vez de Pinecone/Weaviate?

- Qdrant Cloud Free Tier: 1 GB gratis para siempre. Suficiente para 100k embeddings.
- Open source: si Qdrant Cloud quiebra, lo levanto self-host en 5 min.
- API simple (REST + gRPC) y bindings JS oficiales.

### 5. ¿Por qué respond.io en vez de Meta WhatsApp Business directo?

- respond.io maneja la auth con Meta + provee UI para los humanos del equipo.
- Cuando vos respondés desde respond.io, el bot se entera (via webhook `message.sent`).
- Sin respond.io habría que armar un panel humano custom.

### 6. ¿Por qué cloudflared/ngrok en local pero NO en Render?

- Local: necesitás tunnel porque respond.io no puede pegarle a `localhost:5680`.
- Render: el servicio tiene URL pública nativa, no necesita tunnel.

### 7. ¿Por qué 3 sub-agentes y no un mega-agente único?

- **Separación de responsabilidades**: Calificador NO sabe nada del catálogo. Matcher NO escribe en el Sheet. Administrativo NO razona con el cliente.
- **Tokens**: cada sub-agente tiene su propio system message reducido → más barato.
- **Debugging**: si una visita se agenda mal, sabés que fue el Administrativo, no Cami.

### 8. ¿Por qué memoria buffer in-memory + Sheet histórico?

- Buffer in-memory: rápido, sobrevive a la conversación actual.
- Sheet histórico: fuente de verdad persistente. Si la memoria se borra (reinicio), se reconstruye del Sheet.
- Si solo usáramos buffer, perdíamos contexto. Si solo Sheet, latencia alta.

---

## Componentes y sus responsabilidades

### n8n (cerebro)

- **W1** (CORE): el flow principal, recibe mensaje → responde
- **W2** (Recordatorios): cron cada hora, manda SMS 24h y 1h antes de cada visita
- **W3** (Match Retroactivo): cron cada 15 min, busca leads sin match y prueba contra propiedades nuevas
- **W4** (Cobranza): cron diario 9am, manda recordatorios de alquiler vencido
- **W5** (Backup): cron mensual día 1 03:00, snapshot del Sheet a Drive
- **W7** (Reactivar Bot): cron cada hora, limpia `bot_pausado_hasta` de leads con timestamp vencido

### RAG server (apps/rag/)

- **POST /api/search** → text RAG (recibe query, devuelve top K propiedades)
- **POST /api/search-by-image** → CLIP hybrid (recibe imagen, clasifica ambiente, filtra, score híbrido)
- **POST /api/buffer/{add,consume}** → batching de mensajes (para Wait 7s del W1)
- **GET /api/health** → ping
- **GET /api/stats** → cantidad de embeddings

### Dashboard API (apps/dashboard-api/)

- Express + googleapis
- Cache en memoria por pestaña (TTL 30s)
- Endpoints REST: `/api/{leads,propiedades,visitas,contratos,empleados,matches,conversaciones,acciones,metrics,health}`
- Lee SOLO (read-only). La escritura va a Sheet directo o via n8n.

### Dashboard UI (apps/dashboard-ui/)

- Vite + React 18 + TS + Tailwind + TanStack Query + Recharts
- 8 páginas: Dashboard (KPIs), Leads, Propiedades, Visitas, Contratos, Conversaciones, Acciones IA, Empleados

### Scraper (apps/scraper/)

- Node + Cheerio
- Cron local (Task Scheduler de Windows) corre 1×/día a las 6am
- Scrapea `bochile.com.ar/propiedades`, upsert al Sheet `propiedades`

---

## Flujo de un mensaje típico

1. Cliente manda "busco depto en centro hasta 80mil USD" a WhatsApp
2. respond.io recibe → dispara webhook → POST a `bochile-n8n.onrender.com/webhook/bochile-chat`
3. Parser: valida HMAC, detecta que es contacto (no humano), arma estructura
4. Wait 7s: si el cliente está mandando varios mensajes seguidos, los consolida
5. Switch: tipo=text → "Texto - Set Mensaje"
6. Merge Caminos: unifica payloads de texto/audio/imagen
7. Buscar Lead → Upsert: crea o actualiza la fila del lead en Sheet
8. Log Mensaje Entrante: guarda en `conversaciones`
9. Cargar Estado Lead: lee `bot_pausado_hasta`, `conversacion_cerrada`
10. Check Bot Activo: si pausa vigente → SKIP. Si OK → sigue.
11. Cargar Historial (conversaciones del Sheet), Cargar Empleados, Cargar Visitas, Cargar Feriados
12. Formatear Equipo y Agenda (JS): arma bloques de contexto temporal + agenda + slots
13. Vendedor CORE (GPT-4o): con todo el contexto, decide qué hacer
14. CORE llama a Sub-agente Matcher: "tengo cliente con criterios X, busca propiedades"
15. Matcher llama a tool "Buscar Propiedades en Catalogo" (toolWorkflow) → POST a RAG `/api/search`
16. RAG devuelve top 5 con filtros, Matcher arma resumen, CORE lo recibe
17. CORE responde al cliente en tono argentino con propiedades reales
18. Log Mensaje Saliente + Registrar Acción IA en Sheet
19. Responder al Cliente: POST a respond.io API → mensaje aparece en WhatsApp del cliente

Total: ~10-15 segundos.

---

## Costos por conversación

| Acción | Costo OpenAI |
|---|---|
| Mensaje texto simple (sin Matcher) | ~USD 0.003 |
| Mensaje con Matcher (busca props) | ~USD 0.008 |
| Mensaje con imagen (CLIP + vision describe) | ~USD 0.005 |
| Mensaje con audio (Whisper) | ~USD 0.006 |

Promedio: USD 0.005/mensaje. 1000 mensajes/día = USD 5/día = USD 150/mes.

Para Bochile (volumen pequeño, ~50 msg/día), el costo OpenAI es USD 7-10/mes.
