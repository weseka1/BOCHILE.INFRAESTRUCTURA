# 07 · Scraper del catálogo web

El catálogo de propiedades de Camila se alimenta desde la web pública de Bochile (bochile.com) vía un scraper Node.js que vive en `04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/`.

Este manual cuenta qué hace, cómo correrlo manualmente y cómo dejarlo en cron automático.

## Por qué scraping

La web de Bochile (WordPress + plugin WPCasa, hosteada en Hosting Bahía) **no expone API REST** para las propiedades. La única vía realista es scraping HTML público. Como cada ficha usa microdatos schema.org (`itemprop`, `wpsight-listing-details`, `wpsight-gallery`), la extracción es estable mientras el plugin no cambie.

## Qué hace en una corrida

1. Baja `https://www.bochile.com/wp-sitemap-posts-listing-1.xml` → lista de 239 URLs.
2. Visita cada ficha (rate-limit 4 RPS, concurrencia 5, retry 3 con backoff exponencial).
3. Extrae: id, title, operation (sale/rent), tipo (casa/depto/lote/...), zona, barrio inferido, dirección, precio, moneda, m², ambientes, baños, features, galería completa de fotos, descripción, fechas.
4. **Valida** cada propiedad contra un schema Zod estricto.
5. Genera `output/properties.json` (~3 MB).
6. (Opcional `--to-sheet`) hace REPLACE total de la pestaña `propiedades` del Sheet.
7. (Opcional `--download-images`) baja las ~2700 imágenes full-size a `output/images/{id}/`.

Una corrida full tarda ~75 segundos sin imágenes, ~12 minutos con imágenes (613 MB).

## Cobertura del último scrape (15 may 2026)

| Métrica | Valor |
|---|---|
| Total propiedades | 239 |
| Errores | 0 |
| Con operation detectada | 239 (100%) |
| Con location | 239 (100% — usando fallback "Bahía Blanca") |
| Con imágenes | 235 (98%) |
| Total imágenes | 2697 |
| Con precio numérico | 114 (48% — el resto dice "Consulte precio") |
| Con superficie m² | 5 (2% — el cliente no completa este campo) |
| Con ambientes | 7 (3%) |

> Los campos m²/ambientes/baños están bajos porque el cliente NO los carga consistente en cada ficha de WPCasa. Es info que falta del lado del CMS, no bug del scraper.

## Cómo correrlo a mano

```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\04_INFRAESTRUCTURA_TECNICA\Bochile_Scraper

# Smoke test: 5 propiedades a JSON
npm run scrape -- --limit 5

# Full scrape a JSON + CSV
npm run scrape -- --out both

# Full scrape + REPLACE en el Sheet (la operación de producción)
npm run scrape -- --to-sheet

# Solo modificadas desde una fecha (modo incremental)
npm run scrape -- --since 2026-05-01 --to-sheet

# Full + descargar todas las imágenes
npm run scrape -- --to-sheet --download-images

# Probar una URL sola y ver el JSON normalizado
npm run dev -- test-one "https://www.bochile.com/listing/casa-en-venta-cuyo-1200/"
```

## Cron diario automático (Windows Task Scheduler)

El archivo `run-cron.bat` corre el scrape incremental (modo `--since yesterday`) y sube al Sheet, con log diario en `output/logs/scraper-YYYYMMDD.log`.

**Setup (una vez):**

1. Abrir **Task Scheduler** (`Win+R` → `taskschd.msc`).
2. **Create Basic Task** (panel derecho).
3. Nombre: `Bochile Scraper Diario`.
4. Trigger: **Daily**, comienza hoy, hora **06:00**.
5. Action: **Start a program**.
6. Program/script: **Browse** → seleccionar `c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\04_INFRAESTRUCTURA_TECNICA\Bochile_Scraper\run-cron.bat`.
7. **Finish**.

**Importante:** la PC tiene que estar prendida a las 6am. Si la apagás de noche, el Task Scheduler la salta y reintenta al día siguiente. Si querés que corra al despertarse: en las propiedades del task → tab **Settings** → tildar "Run task as soon as possible after a scheduled start is missed".

## Cobertura post-firma: migrar a Render

Cuando migremos n8n + dashboard a Render (fase 2), también va a ir el scraper:
- Crear un **Cron Job** en Render con frecuencia `0 6 * * *`.
- Comando: `npm run scrape -- --since $(date -d 'yesterday' +%Y-%m-%d) --to-sheet`.
- El Service Account JSON se inyecta como secret env var.
- Storage: las imágenes ya no se bajan (las URLs apuntan a la web de Bochile que tiene CDN propio).

## Si la web de Bochile cambia y el scraper se rompe

Síntomas:
- `npm run scrape -- --limit 5` tira muchos errores.
- Las propiedades llegan al Sheet sin location/precio/imágenes.

Pasos:
1. Descargar el HTML de una ficha que rompe: `curl -o debug.html https://www.bochile.com/listing/<slug>/`.
2. Inspeccionar con `grep` los selectores que el scraper usa (todos están listados en `src/scraper.ts`).
3. Identificar qué selector cambió y actualizarlo. La estructura típica de WPCasa Oslo es muy estable; los cambios suelen ser nombres de clases CSS.
4. Re-correr smoke test `npm run scrape -- --limit 5` para validar.
5. Si funciona, full scrape `npm run scrape -- --to-sheet`.

## Estructura del proyecto

```
Bochile_Scraper/
├── src/
│   ├── index.ts          ← CLI (commander)
│   ├── sitemap.ts        ← descarga lista de URLs del sitemap WordPress
│   ├── http.ts           ← fetch con UA realista, retry, rate-limit
│   ├── scraper.ts        ← parsea HTML con cheerio
│   ├── normalizer.ts     ← convierte raw → schema tipado + infiere barrio/operation
│   ├── exporter.ts       ← JSON / CSV / webhook
│   ├── sheets-uploader.ts ← REPLACE en el Sheet vía Service Account
│   ├── images.ts         ← descarga concurrente de imágenes
│   ├── schema.ts         ← schema Zod
│   └── upload-only.ts    ← upload sin re-scrapear (útil para iterar)
├── output/
│   ├── properties.json   ← último scrape (~3 MB)
│   ├── properties.csv    ← versión CSV plana
│   ├── images/{id}/      ← imágenes descargadas (~613 MB)
│   └── logs/             ← logs del cron diario
├── run-cron.bat          ← entrypoint del Task Scheduler
├── README.md             ← doc técnica completa
├── .env.example
├── package.json
└── tsconfig.json
```

## Costos

- **OpenAI**: nada extra (el scraper no usa IA).
- **Google Sheets API**: gratis dentro de cuotas (60 reads/min/user, sin límite de writes razonable).
- **Bandwidth**: ~50 MB por scrape sin imágenes, ~700 MB con imágenes. Si corrés diario sin imágenes son ~1.5 GB/mes — bajísimo.

## Cosas que el scraper NO hace

- No detecta cuándo una propiedad fue **eliminada** del sitio de Bochile. Hace REPLACE total, así que si la quitan de la web, también desaparece del Sheet en el próximo scrape. Eso está bien — coincide con la realidad.
- No baja el plan/mapa de cada propiedad (PDFs, planos), solo fotos.
- No respeta `robots.txt` explícitamente, pero usa rate-limit (4 RPS) y UA identificable. Si Bochile pide que paremos, basta con apagar el Task.
- No hace OCR sobre las imágenes. Las fotos van como URLs al Sheet; Camila las puede compartir por WhatsApp pasando la URL al cliente.
