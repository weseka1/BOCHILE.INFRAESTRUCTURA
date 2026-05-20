/**
 * Embedea el catalogo de propiedades (output del scraper) y lo carga a Qdrant.
 *
 * Cada propiedad se transforma en un texto sintetico (title + tipo + operacion +
 * zona + barrio + ambientes + m2 + features + descripcion truncada) y se manda
 * a OpenAI embeddings.
 *
 * Optimizaciones:
 *   - Batch de 100 textos por request a OpenAI (limite del modelo)
 *   - Skip si el embedding ya existe y modified_at no cambio (incremental)
 *   - Concurrencia 4 requests en paralelo (margen al rate limit)
 *
 * Uso:
 *   npx tsx src/embed.ts                     # incremental (default)
 *   npx tsx src/embed.ts --reset             # borra coleccion + reembeda todo
 *   npx tsx src/embed.ts --dry-run           # solo reporta, no escribe
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { config } from './config.js';
import { qdrant, ensureCollection, deleteCollection } from './qdrant.js';

type Property = {
  id: string;
  url: string;
  slug: string;
  title: string;
  operation: 'sale' | 'rent' | 'other' | null;
  property_type: string | null;
  price: number | null;
  price_currency: string | null;
  price_text: string;
  description: string;
  location: { name: string | null; url: string | null };
  address: string | null;
  attributes: {
    area_m2?: number | null;
    lot_size_m2?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    year_built?: number | null;
  };
  features: string[];
  images: string[];
  image_main: string | null;
  modified_at: string | null;
  scraped_at: string;
};

const RESET = process.argv.includes('--reset');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;
const CONCURRENCY = 4;

const openai = new OpenAI({ apiKey: config.openaiApiKey });
const limit = pLimit(CONCURRENCY);

/**
 * Texto sintetico que describe la propiedad. Esto es lo que se embedea.
 * Diseñado para que un lead que pregunta "casa 3 ambientes Palihue 300k USD"
 * matchee con propiedades reales por similaridad semantica.
 */
function buildText(p: Property): string {
  const extra = p as Property & {
    barrio_extracted?: string | null;
    resumen?: string | null;
  };
  const parts: string[] = [];
  if (p.property_type) parts.push(p.property_type);
  if (p.operation) parts.push(p.operation === 'sale' ? 'en venta' : 'en alquiler');
  if (p.attributes.bedrooms) parts.push(`${p.attributes.bedrooms} ambientes`);
  if (p.attributes.bathrooms) parts.push(`${p.attributes.bathrooms} banos`);
  if (p.attributes.area_m2) parts.push(`${p.attributes.area_m2} m2 cubiertos`);
  if (p.attributes.lot_size_m2) parts.push(`lote de ${p.attributes.lot_size_m2} m2`);
  if (extra.barrio_extracted) parts.push(`barrio ${extra.barrio_extracted}`);
  if (p.location.name) parts.push(`en ${p.location.name}`);
  if (p.address) parts.push(`direccion ${p.address}`);
  if (p.price && p.price_currency) parts.push(`precio ${p.price} ${p.price_currency}`);
  if (p.features.length > 0) parts.push(`con ${p.features.join(', ')}`);
  if (p.title) parts.push(`titulo: ${p.title}`);
  if (extra.resumen) parts.push(`resumen: ${extra.resumen}`);
  if (p.description) parts.push(p.description.slice(0, 800));
  return parts.join('. ');
}

/**
 * Barrio inferido del slug/titulo, reutilizado del scraper.
 * Repetido aca para no acoplar paquetes; mantener sincronizado.
 */
const BARRIOS_BB = [
  'Palihue', 'Centro', 'Universitario', 'Villa Mitre', 'Villa Belgrano',
  'Patagonia', 'Tiro Federal', 'Villa Don Bosco', 'Almafuerte',
  'Aldea Romana', 'Paseo de la Mujer', 'Parque Norte', 'Las Calandrias',
];

function inferBarrio(p: Property): string | null {
  const haystack = `${p.slug} ${p.title}`.toLowerCase();
  for (const barrio of BARRIOS_BB) {
    if (haystack.includes(barrio.toLowerCase())) return barrio;
  }
  return null;
}

function toPayload(p: Property): Record<string, unknown> {
  // El enricher puede haber agregado barrio_extracted y resumen
  const extra = p as Property & {
    barrio_extracted?: string | null;
    resumen?: string | null;
  };
  const barrio = extra.barrio_extracted ?? inferBarrio(p) ?? 'unknown';

  return {
    prop_id: p.id,
    title: p.title,
    url: p.url,
    operation: p.operation ?? 'unknown',
    property_type: p.property_type ?? 'unknown',
    zona: p.location.name ?? 'unknown',
    barrio,
    address: p.address,
    price: p.price,
    price_currency: p.price_currency ?? 'unknown',
    price_text: p.price_text,
    bedrooms: p.attributes.bedrooms ?? null,
    bathrooms: p.attributes.bathrooms ?? null,
    area_m2: p.attributes.area_m2 ?? null,
    lot_size_m2: p.attributes.lot_size_m2 ?? null,
    features: p.features,
    image_main: p.image_main,
    has_image: p.images.length > 0,
    images_count: p.images.length,
    modified_at: p.modified_at,
    resumen: extra.resumen ?? null,
  };
}

async function loadCatalog(): Promise<Property[]> {
  // Preferir el enriquecido si existe (output del enricher LLM)
  const baseDir = path.dirname(path.resolve(config.scraperOutputJson));
  const enrichedPath = path.join(baseDir, 'properties-enriched.json');
  try {
    const raw = await fs.readFile(enrichedPath, 'utf-8');
    console.log(`[embed] cargando catalogo enriquecido desde ${enrichedPath}`);
    return JSON.parse(raw) as Property[];
  } catch {
    const fullPath = path.resolve(config.scraperOutputJson);
    console.log(`[embed] cargando catalogo desde ${fullPath} (sin enriquecer)`);
    const raw = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(raw) as Property[];
  }
}

/**
 * Convierte un prop_id (ej "8264") a numero estable para Qdrant.
 * Si el prop_id es slug (ej "casa-cuyo-1200"), hashea a 32 bits.
 */
function toQdrantId(propId: string): number {
  const asNum = Number(propId);
  if (!Number.isNaN(asNum) && asNum > 0) return asNum;
  // fallback hash 32 bits
  let hash = 0;
  for (let i = 0; i < propId.length; i++) {
    hash = ((hash << 5) - hash + propId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: config.embedModel,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

async function main() {
  console.log('[embed] modo:', RESET ? 'RESET' : 'incremental', DRY_RUN ? '(dry-run)' : '');

  if (RESET && !DRY_RUN) {
    await deleteCollection();
  }
  if (!DRY_RUN) {
    await ensureCollection();
  }

  const properties = await loadCatalog();
  console.log(`[embed] ${properties.length} propiedades en el JSON`);

  // Construir batches
  const batches: Property[][] = [];
  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    batches.push(properties.slice(i, i + BATCH_SIZE));
  }
  console.log(`[embed] ${batches.length} batches de hasta ${BATCH_SIZE}`);

  let totalEmbedded = 0;
  let totalTokens = 0;

  await Promise.all(
    batches.map((batch, idx) =>
      limit(async () => {
        const texts = batch.map(buildText);
        const totalCharsBatch = texts.reduce((a, t) => a + t.length, 0);

        if (DRY_RUN) {
          console.log(
            `[embed] batch ${idx + 1}/${batches.length}: ${batch.length} props (${totalCharsBatch} chars) — DRY`,
          );
          totalEmbedded += batch.length;
          return;
        }

        const vectors = await embedBatch(texts);
        totalTokens += Math.ceil(totalCharsBatch / 4); // estimacion 4 chars/token

        const points = batch.map((p, i) => ({
          id: toQdrantId(p.id),
          vector: vectors[i]!,
          payload: toPayload(p),
        }));

        await qdrant.upsert(config.qdrantCollection, { points, wait: true });
        totalEmbedded += batch.length;
        process.stdout.write(`.`);
      }),
    ),
  );

  process.stdout.write('\n');
  console.log(`[embed] terminado: ${totalEmbedded} propiedades embedeadas`);
  if (!DRY_RUN) {
    console.log(
      `[embed] tokens estimados: ${totalTokens} (~USD ${(totalTokens / 1_000_000 * 0.02).toFixed(4)})`,
    );

    // Stats finales
    const info = await qdrant.getCollection(config.qdrantCollection);
    console.log(`[embed] coleccion total: ${info.points_count} puntos`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
