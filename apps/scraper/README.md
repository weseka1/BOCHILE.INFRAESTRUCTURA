# Bochile Scraper

Scraper del catalogo de propiedades de [bochile.com](https://www.bochile.com).
Extrae las ~239 propiedades publicadas (WordPress + plugin WPCasa) usando el sitemap + microdatos schema.org del HTML, y entrega:

- **JSON** validado con Zod (`output/properties.json`)
- **CSV** plano (`output/properties.csv`)
- **POST a webhook** (batches de 20)
- **Upload directo al Google Sheet** vivo de Bochile (mismo Service Account del Dashboard)

## Por que existe

La web de Bochile (Hosting Bahia + WPCasa) **no tiene API REST** para las propiedades. La unica via realista es scraping del HTML publico. Como cada ficha usa microdatos schema.org (`itemprop`), la extraccion es estable.

Este scraper alimenta la pestania `propiedades` del Sheet maestro `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` que consume el sistema Camila (W1-W5 del n8n local).

## Setup

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper
cp .env.example .env  # editar valores si hace falta
npm install
```

El Service Account JSON ya existe en `../../05_DASHBOARD_WEB/backend/credentials/service-account.json` (creado el 15 may 2026 para el Dashboard).

## Uso

```bash
# Smoke test: scrapeo 5 URLs y dump a JSON
npm run scrape -- --limit 5

# Scrape completo a JSON + CSV
npm run scrape -- --out both

# Scrape + subir al Sheet (REPLACE de la pestania propiedades)
npm run scrape -- --to-sheet

# Solo modificadas desde una fecha
npm run scrape -- --since 2026-05-01 --to-sheet

# POST a un webhook de n8n
npm run scrape -- --webhook https://tu-ngrok.ngrok-free.dev/webhook/sync-catalog

# Listar URLs del sitemap (sin scrapear)
npm run dev -- sitemap --limit 10

# Probar una URL individual y ver el JSON normalizado
npm run dev -- test-one https://www.bochile.com/listing/bermudez-y-juan-elias-aldea-romana/
```

## Como funciona

```
1. sitemap.ts       → GET https://www.bochile.com/wp-sitemap-posts-listing-1.xml
                       parse → 239 URLs
2. http.ts          → fetchText con UA realista + retry 3 + rate limit 4 RPS + concurrencia 5
3. scraper.ts       → cheerio + selectores estables sobre microdatos schema.org
4. normalizer.ts    → parseo precio numerico, area, ambientes, banos, operation, tipo
5. exporter.ts      → JSON / CSV / webhook
6. sheets-uploader  → escribe al Sheet via service account (REPLACE de la pestania)
```

## Endpoints del sitio (verificados)

| Recurso | URL |
|---|---|
| Sitemap indice | https://www.bochile.com/wp-sitemap.xml |
| Sitemap de listings | https://www.bochile.com/wp-sitemap-posts-listing-1.xml |
| Sitemap location | https://www.bochile.com/wp-sitemap-taxonomies-location-1.xml |
| Sitemap listing-type | https://www.bochile.com/wp-sitemap-taxonomies-listing-type-1.xml |
| Sitemap feature | https://www.bochile.com/wp-sitemap-taxonomies-feature-1.xml |
| RSS novedades | https://www.bochile.com/listing/feed/ |
| Patron ficha | https://www.bochile.com/listing/{slug}/ |

## Selectores principales (en ficha individual)

| Campo | Selector |
|---|---|
| id | `ID-XXXXX` en `.wpsight-listing-info` o `body.postid-XXXXX` |
| title | `h1` o `[itemprop="name"]` |
| price | `[itemprop="price"]` atributo `content` |
| price_currency | `[itemprop="priceCurrency"]` atributo `content` |
| price_text | `.listing-price-value` |
| description | `[itemprop="mainContentOfPage"]` |
| details | `.widget_listing_details` (dl/tr/li) |
| features | `.widget_listing_features li` + `a[href*="/feature/"]` |
| taxonomy location | `a[href*="/location/"]` |
| taxonomy listing-type | `a[href*="/listing-type/"]` |
| images | `img[src*="/wp-content/uploads/"]` (full size, sin -WxH) |
| og:image | `meta[property="og:image"]` |
| published_at | `meta[property="article:published_time"]` |
| modified_at | `meta[property="article:modified_time"]` |

## Schema de salida (Zod)

Ver `src/schema.ts`. Cada propiedad sale como:

```ts
{
  id: "26524",
  url: "https://www.bochile.com/listing/...",
  slug: "...",
  title: "...",
  operation: "sale" | "rent" | "other" | null,
  property_type: "casa" | "departamento" | "lote" | ...,
  price: 285000,
  price_currency: "USD",
  price_text: "USD 285.000",
  description: "...",
  location: { name: "Palihue", url: "..." },
  address: "...",
  attributes: { area_m2, lot_size_m2, bedrooms, bathrooms, year_built },
  raw_details: { ... },     // pares clave/valor crudos del listing
  features: ["pileta", "cochera", ...],
  images: ["https://...", ...],
  image_main: "https://...",
  taxonomies: { location: [...], listing_type: [...], feature: [...] },
  published_at: "2026-...",
  modified_at: "2026-...",
  scraped_at: "2026-..."
}
```

## Mapeo al Sheet (`sheets-uploader.ts`)

| Columna Sheet | Campo Property |
|---|---|
| prop_id | id |
| titulo | title |
| url | url |
| operacion | operation |
| tipo | property_type |
| zona | location.name |
| direccion | address |
| precio | price |
| moneda | price_currency |
| precio_texto | price_text |
| ambientes | attributes.bedrooms |
| banos | attributes.bathrooms |
| superficie_cubierta | attributes.area_m2 |
| superficie_total | attributes.lot_size_m2 |
| foto_principal | image_main |
| imagenes_total | images.length |
| descripcion | description (truncado a 4000) |
| features | features.join(' \| ') |
| publicada | 'TRUE' |
| fecha_alta | published_at |
| fecha_modificacion | modified_at |
| scraped_at | scraped_at |

## Automatizacion sugerida

Crontab diario que corre incremental:

```bash
0 6 * * * cd /path/to/Bochile_Scraper && npm run scrape -- --since "$(date -d 'yesterday' +%Y-%m-%d)" --to-sheet >> scraper.log 2>&1
```

O un workflow n8n con Schedule Trigger 6am → Execute Command → npm run scrape -- --to-sheet.

## Notas y limites

- Respeta robots.txt: el scraper usa UA identificable, rate-limit 4 RPS y concurrencia 5.
- Algunos listings (lotes, "consultar") no tienen precio → `price: null`, `price_text: "Consultar"`.
- Slugs con emojis URL-encoded (`%f0%9f%8f%ac`) se decodifican.
- Imagenes: se quita el sufijo `-WxH` antes de la extension para apuntar al full-size.
- Si la web rompe el HTML (cambio de plugin/tema), el primer sintoma es `extractDetails` devolviendo `{}` o `images` vacio. Logging detallado para detectarlo rapido.
