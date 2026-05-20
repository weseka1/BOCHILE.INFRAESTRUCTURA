# 05 - Arquitectura en detalle

> Ver también `../ARQUITECTURA.md` para el diagrama maestro y decisiones técnicas.

Este archivo profundiza en cada subsistema.

## Capa n8n

### W1 - Chatbot CORE (el principal, 50 nodos)

Flujo lógico simplificado:

```
Webhook Respond.io
  → Parsear Mensaje (HMAC valid + detect humano vs bot)
    → Router Parser (3 caminos: humano / skip / continue)
       │
       ├─ humano → Marcar Bot Pausado (24h) → fin
       ├─ skip → fin (no es msg válido)
       └─ continue ▼
          Wait 7s (batching)
            → Consolidate Or Skip (lee buffer compartido del RAG)
               → Switch Tipo Mensaje (text/audio/image)
                  → procesamiento específico
                     → Merge Caminos
                        → Buscar Lead Existente + Upsert Lead CRM
                           → Log Mensaje Entrante
                              → Cargar Estado Lead (lee bot_pausado_hasta + conversacion_cerrada)
                                 → Switch Bot Activo
                                    │
                                    ├─ pausado → fin
                                    └─ activo ▼
                                       Cargar Historial Conversaciones
                                          → Formatear Historial
                                             → Cargar Empleados Activos
                                                → Cargar Visitas Próximas
                                                   → Cargar Feriados
                                                      → Formatear Equipo y Agenda (JS: contexto temporal + agenda real)
                                                         → Vendedor CORE (GPT-4o agent + 3 sub-agentes)
                                                            → Log Mensaje Saliente
                                                               → Registrar Acción IA
                                                                  → Responder al Cliente respond.io
```

### Sub-agentes del CORE

1. **SubAgente Calificador**
   - Recibe la conversación, devuelve JSON con score 0-100 + intención + datos del lead
   - Tool: ninguna (puro LLM)
   - Lo llama el CORE cuando ya tiene algunos datos del cliente

2. **SubAgente Matcher**
   - Recibe criterios (operacion + tipo + zona + presupuesto)
   - Tool: `Buscar Propiedades en Catalogo` (toolWorkflow que ejecuta el SUB)
   - El SUB hace POST a `bochile-rag.onrender.com/api/search` con los criterios
   - Devuelve hasta 5 props con filtros

3. **SubAgente Administrativo**
   - Recibe instrucción (ej. "agendar visita") + datos
   - Tools:
     - Leer Vendedores Activos
     - Leer Agenda Vendedor
     - Crear Visita en CRM
     - Guardar Match Pendiente
     - Actualizar Lead CRM
     - Avisar Vendedor respond.io
     - Cerrar Conversación

### Otros workflows (crons)

- **W2 Recordatorios Visitas**: cron horario, busca visitas en próximas 24h y 1h, manda recordatorio al cliente vía respond.io.
- **W3 Match Retroactivo**: cron 15min, busca leads con `etapa='en_espera_de_stock'` y prueba contra propiedades nuevas. Si hay match, avisa al lead.
- **W4 Cobranza Alquileres**: cron diario 9am, busca contratos con `ultimo_pago` > 30 días y manda recordatorio.
- **W5 Backup Mensual**: cron día 1 mes 03:00, copia el Sheet entero a Google Drive con timestamp.
- **W7 Reactivar Bot Pausado**: cron horario, busca leads con `bot_pausado_hasta < ahora` y limpia el campo.

## Capa RAG (apps/rag/)

### Endpoints

```typescript
POST /api/search
  body: { query, filters: { operation, property_type, zona, price_max, bedrooms_min, with_image }, limit }
  flow: embed query (text-embedding-3-small) → Qdrant search con filter → fallback escalonado si 0 results
  resp: { items: [{ prop_id, score, title, url, ...detallesCompletos }] }

POST /api/search-by-image
  body: { image_base64 OR image_url, limit }
  flow:
    1. clasificar ambiente entrante (Vision LLM gpt-4o-mini → fachada/cocina/baño/etc)
    2. describir entrante (Vision LLM → texto 40-70 palabras)
    3. CLIP embed entrante (@xenova/transformers local, 512d)
    4. Qdrant search con filter por mismo ambiente
    5. para cada candidato: calcular text similarity (descripción entrante vs descripción catalogo)
    6. score híbrido = 0.7 * clip + 0.3 * text
    7. agregar por prop_id (max score), top K props únicas
  resp: { mode: 'clip_hybrid', incoming_ambient, items: [{ prop_id, score, clip_score, text_score, ...detalles }] }

POST /api/buffer/add  (interno, usado por n8n para batching)
POST /api/buffer/consume

GET /api/health
GET /api/stats
GET /api/property/:id
```

### Embeddings en Qdrant

- **Colección `bochile_properties`**: 1 punto por propiedad. Vector: text-embedding-3-small (1536d) del texto enriquecido (título + descripción + features + dirección).
- **Colección `bochile_property_images_clip`**: 1 punto por imagen. Vector: CLIP visual (512d). Payload incluye `prop_id`, `image_ambient`, `image_description`. ~1600 puntos (8 imgs × 200 props).

### CLIP local

- Modelo: `Xenova/clip-vit-base-patch32` (transformers.js, 150 MB).
- Cold start: ~30s la primera vez (descarga modelo). Después <50ms por embedding.
- Si el plan de Render es Starter (512 MB RAM), CLIP justo entra. Si es Standard (2 GB), holgado.

## Capa Sheets (DB)

### Estructura de pestañas

| Pestaña | Filas típicas | Función |
|---|---|---|
| `leads` | 100-5000 | Cada cliente potencial. Score, etapa, datos demográficos, flags (pausado, cerrado) |
| `propiedades` | 200-500 | Catálogo (mantenido por scraper diario) |
| `visitas` | 50-500 | Visitas agendadas/realizadas/canceladas |
| `contratos` | 10-50 | Alquileres firmados (para cobranza) |
| `empleados` | 4-10 | Vendedores con zonas, horarios, vacaciones |
| `matches_pendientes` | 0-100 | Leads esperando stock que aún no llegó |
| `conversaciones` | 1k-50k | Cada mensaje (entrada + salida) loggeado |
| `acciones_ia` | 500-10k | Cada decisión de la IA (qué hizo y por qué) |
| `feriados_args` | 16 (fijo año) | Feriados ARG hardcoded |

### Columnas críticas

**`leads`**:
- `bot_pausado_hasta` (ISO datetime) → si > ahora, bot skipea
- `conversacion_cerrada` (bool) → si true, bot solo responde a saludo nuevo
- `ultimo_humano_respondio` (ISO datetime) → para auditoría
- `etapa` → `nuevo` / `calificado` / `visita_agendada` / `cerrada_por_cliente` / `descartado`

**`empleados`**:
- `dias_laborales` (CSV) → `L,M,X,J,V,S` por defecto, sin D
- `horario_inicio` / `horario_fin` (HH:MM)
- `vacacion_desde` / `vacacion_hasta` (YYYY-MM-DD)
- `max_visitas_dia` (int) → default 4

## Capa Dashboard (apps/dashboard-api + apps/dashboard-ui)

### Backend (Express + googleapis)

- Cache en memoria por pestaña, TTL 30s (config en `CACHE_TTL_SECONDS`).
- Service account read-only (no escribe en el Sheet).
- 10 endpoints REST:
  - `/api/health`
  - `/api/leads`
  - `/api/propiedades`
  - `/api/visitas`
  - `/api/contratos`
  - `/api/empleados`
  - `/api/matches`
  - `/api/conversaciones`
  - `/api/acciones`
  - `/api/metrics` ← KPIs precalculados

### Frontend (Vite + React + TS + Tailwind + TanStack Query + Recharts)

- 8 páginas con routing.
- Refetch automático cada 30s (matches con el cache del backend).
- Filtros + búsqueda en cada lista.

## Capa Scraper (apps/scraper/)

- Cron Task Scheduler de Windows (local), 6am diario.
- Node + Cheerio.
- Recorre `bochile.com.ar/propiedades`, parsea cada listing, upsert a Sheet `propiedades` por `prop_id`.
- Si la propiedad desaparece de la web, marca `estado=pausada`.

## Modelos LLM usados

| Servicio | Modelo | Costo aprox |
|---|---|---|
| Vendedor CORE | gpt-4o | USD 5/1M input, USD 15/1M output |
| Sub-agentes (Calificador, Matcher, Admin) | gpt-4o-mini | USD 0.15/1M input, USD 0.6/1M output |
| Clasificar ambiente imagen | gpt-4o-mini (vision) | USD 0.001/imagen |
| Describir imagen | gpt-4o-mini (vision) | USD 0.001/imagen |
| Whisper (transcribir audio) | whisper-1 | USD 0.006/min |
| Embeddings | text-embedding-3-small | USD 0.02/1M tokens |

Costo promedio por mensaje: **USD 0.005-0.008**.

## Limitaciones conocidas

1. **n8n self-host en Render Standard** se reinicia ocasionalmente (deploys, OOM si Standard se queda corto). Cuando reinicia, la memoria buffer in-memory del CORE se pierde. El Sheet sobrevive, pero la conversación en curso puede confundirse 1 vez antes de reconstruirse.

2. **HMAC validation está en modo WARN**. El Parser loggea match/mismatch pero no rechaza. Para activar ENFORCE, modificar el Parser y descomentar el `return skip`. Lo dejé en WARN para evitar bloquear mensajes legítimos si la fórmula no matchea exacto.

3. **CLIP local en Render** requiere ~512 MB RAM. Si el plan es Starter (512 MB total), puede quedar justo. Si Cami se pone lenta con imágenes, upgradear a Standard.

4. **Scraper diario es local** (depende de tu PC encendida + Task Scheduler). Para 24/7 real, migrar a un cron de Render (USD 0/mes extra) o un GitHub Action.

5. **Sin Google Calendar sync**. Las visitas viven SOLO en el Sheet. El vendedor recibe WhatsApp con datos pero no aparece en su Google Calendar. Mejora futura.

## Roadmap de mejoras (post-MVP)

| Prioridad | Mejora | Costo extra | Beneficio |
|---|---|---|---|
| Alta | HMAC ENFORCE | 0 | Seguridad real (rechazar webhooks no firmados) |
| Alta | Scraper en cron de Render | 0 | 24/7 sin depender de tu PC |
| Media | Re-rank LLM del top-3 CLIP | USD 0.0015/img | +15% accuracy en reconocimiento de propiedades |
| Media | Google Calendar sync por vendedor | dev time | Single source of truth para agendas |
| Media | Rate limit por contacto | dev time | Anti-spam / anti-bucles |
| Baja | Multi-cliente (white-label) | dev time | Reutilizar el sistema con otras inmobiliarias |
