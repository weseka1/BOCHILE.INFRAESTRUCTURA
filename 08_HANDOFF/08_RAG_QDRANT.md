# 08 · RAG (Qdrant + embeddings)

Capa que elimina la divagación de Camila. Las 239 propiedades del catálogo se indexan como vectores semánticos y el sub-agente Matcher las consulta con **similarity search + filtros estrictos**, en vez de leer todo el Sheet y filtrar con fuzzy match.

Vive en `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/`. Doc técnica completa en el README de ahí. Este archivo es el manual operativo.

---

## Qué problema resuelve

**Antes** (sub-agente Matcher hoy):
- Lee TODO el catálogo del Sheet (239 props × 30 columnas) → llega al LLM como bloque gigante
- El LLM elige propiedades por fuzzy match → alucina, divaga, ofrece propiedades que no cumplen presupuesto
- No escala: cuando lleguen 1000+ props, explota el context window
- Falla con sinónimos: lead dice "casa para vivir con la familia" → el LLM no relaciona con "casa 3 ambientes"

**Ahora** (con Qdrant + embeddings):
- Cada propiedad pre-indexada como vector 1536-dim de OpenAI `text-embedding-3-small`
- El Matcher embedea la query del lead y consulta Qdrant → recibe top-K relevantes (3-5 props)
- Filtros estrictos por precio/zona/operación → Camila NUNCA ofrece algo fuera de presupuesto
- Latencia <500ms por query
- Costo: USD 0.0007 por re-indexar todo, USD 0.0000005 por consulta

---

## Stack

| Componente | Detalle |
|---|---|
| Vector DB | **Qdrant opensource** (contenedor `qdrant` ya corriendo en `localhost:6333`, compartido con otros proyectos) |
| Embedding | **OpenAI `text-embedding-3-small`** (1536 dim, USD 0.02 por 1M tokens) |
| API REST intermedia | Express en **`localhost:3003`** que valida con Zod + aplica filtros sanos |
| Collection | `bochile_properties` (aislada — no toca las otras collections del Qdrant) |
| Indices payload | 11 índices: prop_id, operation, property_type, zona, barrio, price, bedrooms, bathrooms, area_m2, has_image, price_currency |

---

## Setup desde cero

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_RAG
cp .env.example .env
# editar .env y poner OPENAI_API_KEY (la misma que usa Camila en n8n)
npm install

# 1) Embedear las 239 props (30 seg, USD 0.0007)
npm run embed

# 2) Validar desde terminal
npm run search -- "casa 3 amb Palihue 300k USD"

# 3) Levantar la API que consume n8n
npm run dev
# → http://localhost:3003/api/health
```

---

## Endpoints

| Método | Path | Notas |
|---|---|---|
| GET  | `/api/health` | health check |
| GET  | `/api/stats`  | `{ points_count, status }` |
| POST | `/api/search` | **el endpoint que consume el Matcher de n8n** |
| GET  | `/api/property/:propId` | lookup por prop_id |

### Body de `/api/search`

```json
{
  "query": "casa familiar 3 ambientes con quincho en Palihue",
  "limit": 5,
  "filters": {
    "operation": "sale",
    "property_type": "casa",
    "price_currency": "USD",
    "price_max": 300000,
    "price_min": 50000,
    "bedrooms_min": 3,
    "bathrooms_min": 1,
    "area_m2_min": 100,
    "zona": "Bahía Blanca",
    "barrio": "Palihue",
    "with_image": true
  }
}
```

**Solo `query` es obligatorio.** El resto son filtros opcionales. Recomendado siempre setear:
- `operation` (sale/rent)
- `price_max` + `price_currency`
- `with_image: true` (para que solo aparezcan props con foto)

---

## Integración con n8n (W1 Matcher) — YA OPERATIVA

La integración entre el W1 Matcher y el RAG está **funcionando end-to-end** desde el 2026-05-16.

### Flow completo

```
Vendedor CORE (Camila, gpt-5)
     ↓ ai_tool
SubAgente Matcher (gpt-4o-mini)
     ↓ ai_tool
"Buscar Propiedades en Catalogo" (toolWorkflow)
     ↓ executeWorkflow
Sub-workflow "Bochile RAG Search" (id 6Dk2umeJDNViv9yb, activo)
     ↓ HTTP POST
http://host.docker.internal:3003/api/search
     ↓
RAG Server → OpenAI embeddings + Qdrant (con filtros estrictos)
     ↓
Top 5 props REALES devueltas al Matcher
     ↑
Matcher devuelve al CORE las top 3
     ↑
Camila arma respuesta natural en español
```

### Test validado (16 may 2026)

Lead: *"casa en Bahia Blanca 3 amb hasta 200 mil USD"*

Camila respondió con **3 casas reales del catálogo**, scores 0.67-0.69:
- Casa San Martín 566 · USD 88,000 · 3 amb · 191 m²
- Casa Rincón 672 · USD 100,000 · 3 amb · 236 m²
- Casa 9 de Julio 5600 · USD 180,000 · 3 amb · 231 m²

Filtros aplicados automáticamente: `{operation: "sale", property_type: "casa", price_currency: "USD", price_max: 200000, bedrooms_min: 3, with_image: true}`. **Zero alucinación.**

### Por qué toolWorkflow y no toolHttpRequest

Probamos varios approaches:
- `toolHttpRequest` → falla dentro de `agentTool`: "has supplyData but no execute"
- `toolCode` con `fetch` → `fetch` no está expuesto en el sandbox
- `toolCode` con `this.helpers.httpRequest` → funciona pero el LLM no expone los inputs como variables individuales
- **`toolWorkflow`** → SÍ funciona. El LLM pasa params via `$fromAI()`, el sub-workflow los recibe limpios como `$input.first().json.query`, etc.

### Migración a Render (cambio de 1 línea)

Cuando movamos el RAG a Render (`https://bochile-rag.onrender.com`), abrir el sub-workflow `Bochile RAG Search` y cambiar UNA línea en el nodo `Call RAG and Format`:

```js
// ANTES (local)
const RAG_URL = 'http://host.docker.internal:3003/api/search';

// DESPUÉS (Render)
const RAG_URL = 'https://bochile-rag.onrender.com/api/search';
```

Doc completa de Render: [`../Bochile_RAG/RENDER_DEPLOY.md`](../Bochile_RAG/RENDER_DEPLOY.md).

---

## (REFERENCIA HISTÓRICA, ya no aplica)

Antes del 16 may, el Matcher usaba `n8n-nodes-base.googleSheetsTool` directo al Sheet. Funcionaba pero divagaba porque pasaba todo el catálogo al LLM. Ahora el filtrado es estricto vía Qdrant + payload indexes.

### Cambios en el W1 (UI de n8n)

1. Abrir el W1 (`Bochile - Chatbot Multi-Agente CORE (v4 Twilio)`, ID `aUMQyupnGJ5IWm5e`)
2. Click en el sub-agente **SubAgente Matcher**
3. En la sección "Tools" del agente, **eliminar** el tool actual `Leer Catalogo Propiedades` (`n8n-nodes-base.dataTableTool`)
4. **Agregar** un tool nuevo: **HTTP Request** (`@n8n/n8n-nodes-langchain.toolHttpRequest`)
   - **Name**: `search_catalog`
   - **Description**: `Busca propiedades del catalogo de Bochile por similaridad semantica + filtros estrictos. Devuelve hasta 5 propiedades reales que cumplen TODOS los filtros. Si no hay match, devuelve count=0 y hay que ofrecer crear un match_pendiente.`
   - **Method**: POST
   - **URL**: `http://host.docker.internal:3003/api/search`
   - **Send Body**: JSON
   - **Body**:
     ```javascript
     {
       "query": "{{ $fromAI('query', 'Descripcion natural de lo que busca el lead. Ejemplo: casa familiar 3 ambientes en Palihue con quincho y pileta', 'string') }}",
       "limit": 5,
       "filters": {
         "operation": "{{ $fromAI('operation', 'sale para venta, rent para alquiler', 'string') }}",
         "property_type": "{{ $fromAI('property_type', 'casa, departamento, ph, lote, local, oficina, cochera, campo, galpon. Vacio si no se sabe.', 'string') }}",
         "price_currency": "{{ $fromAI('price_currency', 'USD o ARS. Default USD si no se sabe.', 'string') }}",
         "price_max": "{{ $fromAI('price_max', 'Presupuesto maximo en numero. Si dijo 300k, poner 300000.', 'number') }}",
         "bedrooms_min": "{{ $fromAI('bedrooms_min', 'Cantidad minima de ambientes', 'number') }}",
         "with_image": true
       }
     }
     ```

### Cambios en el prompt del Matcher

Reemplazar el prompt actual por:

```
Sos el sub-agente MATCHER de Bochile. Tu unica tarea: buscar propiedades del
catalogo real que matcheen con lo que pide el lead.

Tenes una herramienta `search_catalog` que recibe:
- query: descripcion natural en español de lo que busca el lead
- filters.operation: "sale" o "rent"
- filters.property_type: casa | departamento | ph | lote | local | oficina | cochera | campo | galpon
- filters.price_max: numero, presupuesto en USD o ARS
- filters.price_currency: "USD" o "ARS"
- filters.bedrooms_min: ambientes minimos
- filters.with_image: true (default)

Reglas:
1. Generá un `query` parafraseando al lead, incluyendo zona/barrio/features.
2. Aplicá filtros estrictos cuantitativos (precio, ambientes, operacion).
3. Cuando recibis resultados, DEVOLVE al CORE hasta 3 propiedades con:
   - prop_id, titulo, precio + moneda, zona/barrio, ambientes/baños, m2, URL.
4. Si `count === 0`, decile al CORE: "SIN_STOCK + <criterios resumidos>" para que
   active el flow de match_pendiente.
5. NUNCA inventes propiedades. NUNCA modifiques los datos que devuelve `search_catalog`.
6. NUNCA ofrezcas propiedades que no esten en la respuesta.
```

### Por qué `host.docker.internal`

n8n corre en un contenedor Docker. Desde adentro del contenedor, `localhost:3003` apunta al PROPIO contenedor, no al host de Windows. `host.docker.internal` es el alias que Docker Desktop pone para llegar al host.

Si en algún momento movemos el RAG a Render: cambiar la URL por el dominio público del servicio Render (ej. `https://bochile-rag.onrender.com/api/search`).

---

## Operación diaria

### Re-indexar cuando hay propiedades nuevas

El scraper W6 corre todos los días a las 6 AM y actualiza `properties.json`. Para que Qdrant se sincronice, el `run-cron.bat` del scraper llama al `embed` después:

```bat
:: Ya esta agregado al final de run-cron.bat
cd ..\Bochile_RAG
call npm run embed >> "%LOG_FILE%" 2>&1
```

Como `embed.ts` hace **upsert por prop_id**, no duplica datos. Solo recalcula embeddings de propiedades nuevas o cuyo contenido cambió. Costo extra: USD 0.0001 por propiedad nueva.

### Re-indexación manual completa (cuando hay cambios grandes)

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_RAG
npm run embed -- --reset
```

`--reset` borra la collection entera y la rearma desde cero. Útil si cambiamos el modelo de embedding o el formato del texto sintético.

### Monitor

```bash
# stats actuales
curl http://localhost:3003/api/stats
# → {"points_count":239,"status":"green"}

# test rápido de búsqueda
curl -X POST http://localhost:3003/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"casa Palihue 300k USD","limit":3}'
```

---

## Si algo falla

| Síntoma | Diagnóstico | Fix |
|---|---|---|
| Camila ofrece propiedades inventadas | Matcher no usa el RAG, sigue con dataTableTool viejo | Verificar en n8n que el tool es HTTP Request a `:3003/api/search` |
| `ECONNREFUSED localhost:3003` desde n8n | RAG server caído | `cd Bochile_RAG && npm run dev` |
| `ECONNREFUSED localhost:6333` desde RAG | Qdrant caído | `docker ps` → si no aparece `qdrant`, levantar |
| Resultados malos (props irrelevantes) | embeddings desactualizados o texto pobre | `npm run embed -- --reset` |
| Filtros no filtran | índices de payload no creados | el `--reset` los recrea automáticamente |
| `host.docker.internal` no resuelve | Docker Desktop muy viejo o Linux nativo | reemplazar por IP del host (`ipconfig` en Windows) |
| OpenAI 401 | `OPENAI_API_KEY` mal o expirada | actualizar `.env` |

---

## Migración a Render (fase 2 post-firma)

1. Crear Web Service en Render desde el repo, root `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Env vars:
   - `OPENAI_API_KEY` (secret)
   - `QDRANT_URL` (URL del Qdrant en Render — crear como segundo servicio)
   - `QDRANT_API_KEY` (Render Qdrant lo requiere)
   - `QDRANT_COLLECTION=bochile_properties`
   - `SCRAPER_OUTPUT_JSON` (path del scraper si lo cargás como bundle, sino subir a S3/Drive)
5. En el W1 de n8n, cambiar URL del HTTP Request por la URL Render
6. Re-correr `npm run embed -- --reset` desde Render Shell para indexar la primera vez

Costo Render estimado: USD 7 (Web Service Hobby) + USD 5-10 (Qdrant managed) = ~USD 15/mes.

---

## TL;DR para Yamil

Camila ahora **no inventa propiedades**. Pregunta lo que sea ("casa familiar en Palihue", "depto para alquilar Centro", "lote inversión"), Camila consulta Qdrant en <500ms y solo ofrece propiedades que matchean.

Para mantenerlo vivo: dejar prendido el container `qdrant` y el server RAG (`npm run dev` en `Bochile_RAG/`). El re-indexado diario está automatizado en el cron del scraper.
