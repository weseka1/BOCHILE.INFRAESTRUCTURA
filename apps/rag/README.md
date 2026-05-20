# Bochile · RAG (Qdrant + embeddings)

Capa de **retrieval-augmented generation** para Camila. Reemplaza al sub-agente Matcher que hoy hace fuzzy match contra el Sheet — ahora hace **similarity search semántica** contra Qdrant con filtros estrictos por precio, zona, tipo, etc.

## Para qué sirve

Eliminar la divagación de Camila. Hoy el Matcher:
- Lee TODO el catálogo (239 props) y se lo pasa al LLM en el prompt
- El LLM filtra por fuzzy match (frágil, alucina)
- Cuando el catálogo crezca a 1000+ props, va a explotar el context window

Con esta capa:
- Cada propiedad se indexa como vector de 1536 dim (`text-embedding-3-small`)
- Cuando un lead pregunta, el Matcher embedea la query y le pide a Qdrant las top-K más similares
- Filtros estrictos (precio_max, operación, etc.) se aplican como `must` clauses de Qdrant — la IA NO recibe propiedades fuera de presupuesto
- Camila solo ve 3-5 propiedades que SÍ matchean → respuestas exactas, sin alucinación

## Stack

- **Qdrant** opensource (vive en `localhost:6333`, compartido con otros proyectos del founder)
- **OpenAI** `text-embedding-3-small` (1536 dim, USD 0.02 por 1M tokens)
- **API REST** intermedia (puerto 3003) que centraliza embedding del query + filtros sanos por default

## Setup local

> El Qdrant del founder ya está corriendo hace tiempo. **No levantamos un Qdrant nuevo**, reusamos el existente y creamos una collection `bochile_properties` aislada.

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_RAG
cp .env.example .env
# editar .env y completar OPENAI_API_KEY
npm install

# 1) Embedear catalogo (239 props → vectores → Qdrant)
npm run embed
# Tarda ~30 seg. Cuesta ~USD 0.0002.

# 2) Probar busqueda desde terminal
npm run search -- "casa 3 ambientes Palihue hasta 300 mil USD"

# 3) Levantar la API que consume el W1 Matcher
npm run dev
# Listening: http://localhost:3003
```

## Endpoints de la API

| Método | Path | Body / Response |
|---|---|---|
| GET | `/api/health` | `{ status, collection, embed_model, time }` |
| GET | `/api/stats` | `{ points_count, vectors_count, status }` |
| POST | `/api/search` | Ver below |
| GET | `/api/property/:propId` | Payload completo de una propiedad |

### POST /api/search

```json
{
  "query": "casa 3 ambientes Palihue hasta 300 mil USD",
  "limit": 5,
  "filters": {
    "operation": "sale",
    "property_type": "casa",
    "price_currency": "USD",
    "price_max": 300000,
    "bedrooms_min": 3,
    "with_image": true
  }
}
```

Response:
```json
{
  "query": "...",
  "filters": { ... },
  "count": 3,
  "items": [
    {
      "prop_id": "8264",
      "score": 0.8721,
      "title": "Cuyo 1265 – Casa",
      "url": "https://www.bochile.com/listing/casa-en-venta-cuyo-1200/",
      "operation": "sale",
      "property_type": "casa",
      "zona": "Bahía Blanca",
      "barrio": null,
      "address": null,
      "price": null,
      "price_currency": null,
      "price_text": "Consulte precio",
      "bedrooms": 3,
      "bathrooms": 2,
      "area_m2": 170,
      "features": ["Garage pasante", "Lavadero", "patio"],
      "image_main": "https://www.bochile.com/wp-content/uploads/2021/08/CUYO-1-scaled.jpg"
    }
  ]
}
```

## Cómo se integra con n8n (W1 Matcher)

El sub-agente Matcher del W1 actualmente usa `n8n-nodes-base.dataTableTool` (lectura directa al Sheet). Hay que reemplazarlo por un **HTTP Request tool** que pegue a `/api/search`:

```
URL:     http://host.docker.internal:3003/api/search
Method:  POST
Headers: Content-Type: application/json
Body:    JSON con el shape de arriba (query del lead + filtros estructurados)
```

> `host.docker.internal` es la forma de que el container de n8n llegue al host de Windows. Si el RAG corre en otra máquina, cambiar por la IP/dominio.

El Matcher debe construir el body desde la conversación con el lead:
- `query`: descripción libre del lead reformulada por el LLM
- `filters.operation`: si el lead dijo "venta" → `sale`, "alquilar" → `rent`
- `filters.price_max`: si dijo "hasta 300k USD" → 300000 con `price_currency: USD`
- `filters.bedrooms_min`: si dijo "3 ambientes" → 3
- `filters.with_image: true` (default — siempre preferir props con foto)

## Costo

- **Indexación**: USD 0.0002 por scrape completo (239 props ≈ 9,500 tokens).
- **Consultas**: USD 0.0000005 por mensaje de lead. Para 10,000 conversaciones/mes ≈ USD 0.005.
- **Storage Qdrant**: gratis local. En Render Qdrant managed ≈ USD 5-10/mes para vol bajo.

## Migración a Render (fase 2)

1. Crear Render Web Service desde este repo
2. Variables de entorno: `OPENAI_API_KEY`, `QDRANT_URL` (apuntar al Qdrant en Render, no localhost), `QDRANT_API_KEY` (Render lo requiere)
3. El `docker-compose.yml` en este folder funciona tal cual en Render como segundo servicio (Qdrant + API en un mismo `docker-compose.yml` de Render)
4. Re-correr `npm run embed -- --reset` desde el Render Shell para indexar la primera vez

## Re-indexación automática

El scraper de propiedades (W6 en cron de 6 AM) actualiza `properties.json`. Para que Qdrant se sincronice, agregar a `run-cron.bat` del scraper:

```bat
cd ..\Bochile_RAG
call npm run embed
```

Como `embed.ts` hace **upsert por prop_id**, no duplica filas y solo recalcula embeddings de propiedades nuevas/modificadas. Costo extra: USD 0.0001 por prop nueva.

## Tunear el prompt del Matcher

El sub-agente Matcher de Camila debe darle al `/api/search` un query **descriptivo natural** (no SQL ni keywords). Ejemplo de prompt actualizado:

```
Tu trabajo es buscar propiedades para el lead. Tenes una herramienta `search_catalog`
que recibe:
  - query: texto descriptivo de lo que busca el lead, ej. "casa familiar en Palihue
    con quincho y pileta hasta 300 mil USD"
  - filters: objeto con operation, property_type, zona, barrio, price_currency,
    price_max, price_min, bedrooms_min, bathrooms_min, area_m2_min, with_image

Genera el query parafraseando lo que dijo el lead. Aplica filtros estrictos solo
para datos cuantitativos (precio, ambientes). NO uses filters.zona ni filters.barrio
salvo que el lead haya nombrado explicitamente esa zona — dejá que la similarity
search haga el matching de zona por similitud.

Devuelve hasta 3 propiedades al CORE con prop_id, titulo, precio, zona, ambientes,
m2 y URL del tour. Si la query no devuelve nada, decile al CORE que active el flow
de "match_pendiente".
```

## Si algo falla

| Síntoma | Causa | Fix |
|---|---|---|
| `Missing env var: OPENAI_API_KEY` | falta `.env` | `cp .env.example .env` y completar |
| `ECONNREFUSED localhost:6333` | Qdrant no corre | `docker ps` → si no está, levantar con `docker compose up -d` |
| `collection not found` | falta correr `npm run embed` | correr embed |
| Resultados malos | embeddings desactualizados | `npm run embed -- --reset` |
| Filtros no filtran | índices no creados | `npm run embed -- --reset` (los crea) |
