/**
 * Embeddings VISUALES de las propiedades.
 *
 * Para cada propiedad:
 *   1. Toma sus primeras N imagenes locales (000.jpg, 001.jpg, 002.jpg)
 *   2. Pasa cada una por GPT-4o-mini (vision) -> descripcion detallada en espanol
 *   3. Concatena las descripciones
 *   4. Embed la descripcion combinada con text-embedding-3-small
 *   5. Upsert a Qdrant en una nueva coleccion: bochile_property_images
 *
 * Despues, cuando un cliente manda una foto, el server hace lo mismo (describe + embed)
 * y busca similitud → identifica la propiedad sin que el cliente diga la direccion.
 *
 * Modelo barato: gpt-4o-mini con vision ($0.001 por imagen). 235 props * 3 imgs = $0.70.
 *
 * Uso:
 *   npx tsx src/embed-images.ts                # full (3 imgs por prop)
 *   npx tsx src/embed-images.ts --limit 5      # smoke test 5 props
 *   npx tsx src/embed-images.ts --imgs 5       # 5 imagenes por prop (mas detalle)
 *   npx tsx src/embed-images.ts --reset        # borra coleccion antes de embedear
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { config } from './config.js';
import { qdrant } from './qdrant.js';

const COLLECTION = process.env.IMAGE_COLLECTION ?? 'bochile_property_images';
const IMAGES_BASE = path.resolve('../Bochile_Scraper/output/images');
const PROPS_JSON = path.resolve('output/properties-enriched.json');

const LIMIT_FLAG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG !== -1 ? parseInt(process.argv[LIMIT_FLAG + 1] ?? '0', 10) : 0;
const IMGS_FLAG = process.argv.indexOf('--imgs');
const IMGS_PER_PROP = IMGS_FLAG !== -1 ? parseInt(process.argv[IMGS_FLAG + 1] ?? '3', 10) : 3;
const RESET = process.argv.includes('--reset');
const CONCURRENCY = 6;
const VISION_MODEL = 'gpt-4o-mini';

const openai = new OpenAI({ apiKey: config.openaiApiKey });
const limit = pLimit(CONCURRENCY);

const VISION_PROMPT = `Eres un experto en describir propiedades inmobiliarias para búsqueda por similitud visual. Describe esta foto en español en 60-100 palabras, enfocandote en:

- AMBIENTE (living, cocina, dormitorio, baño, balcón, fachada, plano, etc.)
- MATERIALES Y TERMINACIONES (parquet, porcelanato, ladrillo visto, paredes blancas, vigas de madera, etc.)
- ILUMINACIÓN (natural luminoso, oscuro, ventanal, balcón)
- CARACTERÍSTICAS DISTINTIVAS (vista, altura, mobiliario, estilo arquitectónico)
- ESTADO (nuevo, a reformar, moderno, clásico, lujo, simple)

NO menciones marca, precio, ni dirección. Solo describe lo que ves. Devuelve un párrafo plano, sin bullets.`;

async function describeImage(imagePath: string): Promise<string> {
  const imageBuf = fssync.readFileSync(imagePath);
  const b64 = imageBuf.toString('base64');
  const mime = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  try {
    const res = await openai.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'low' } },
          ],
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ describe error (${path.basename(imagePath)}): ${msg.slice(0, 100)}`);
    return '';
  }
}

async function ensureCollection() {
  const cols = await qdrant.getCollections();
  const exists = cols.collections.some((c) => c.name === COLLECTION);
  if (exists && RESET) {
    console.log(`[reset] deleting collection ${COLLECTION}`);
    await qdrant.deleteCollection(COLLECTION);
  }
  const colsAfter = await qdrant.getCollections();
  if (!colsAfter.collections.some((c) => c.name === COLLECTION)) {
    console.log(`[create] collection ${COLLECTION} (${config.embedDim} dims)`);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: config.embedDim, distance: 'Cosine' },
    });
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'prop_id', field_schema: 'keyword', wait: true });
  }
}

type Property = {
  id: string;
  prop_id?: string;
  url: string;
  title: string;
  address?: string | null;
  location?: { name?: string | null };
};

async function main() {
  await ensureCollection();
  const raw = await fs.readFile(PROPS_JSON, 'utf-8');
  let props: Property[] = JSON.parse(raw);
  if (LIMIT > 0) props = props.slice(0, LIMIT);

  console.log(`[embed-images] ${props.length} propiedades a procesar | ${IMGS_PER_PROP} imgs c/u | modelo ${VISION_MODEL}`);

  let okCount = 0;
  let skipCount = 0;
  let errCount = 0;
  const points: Array<{ id: number; vector: number[]; payload: Record<string, unknown> }> = [];

  await Promise.all(
    props.map((p, idx) =>
      limit(async () => {
        const propIdRaw = p.prop_id || p.id;
        const folder = path.join(IMAGES_BASE, p.id);
        if (!fssync.existsSync(folder)) {
          skipCount++;
          return;
        }
        const files = fssync.readdirSync(folder)
          .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
          .sort()
          .slice(0, IMGS_PER_PROP);
        if (files.length === 0) {
          skipCount++;
          return;
        }

        const descriptions: string[] = [];
        for (const f of files) {
          const fp = path.join(folder, f);
          const desc = await describeImage(fp);
          if (desc) descriptions.push(`[${f}] ${desc}`);
        }

        if (descriptions.length === 0) {
          errCount++;
          return;
        }

        const combined = descriptions.join('\n\n');

        try {
          const emb = await openai.embeddings.create({
            model: config.embedModel,
            input: combined,
          });
          points.push({
            id: parseInt(p.id, 10) || idx,
            vector: emb.data[0]!.embedding,
            payload: {
              prop_id: String(propIdRaw),
              folder_id: p.id,
              url: p.url,
              title: p.title,
              address: p.address ?? null,
              location: p.location?.name ?? null,
              image_count: descriptions.length,
              image_descriptions: combined,
            },
          });
          okCount++;
          if (okCount % 10 === 0) console.log(`  ... ${okCount}/${props.length} props embeded`);
        } catch (err: unknown) {
          errCount++;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`  ✗ embed error prop ${p.id}: ${msg.slice(0, 100)}`);
        }
      }),
    ),
  );

  if (points.length > 0) {
    console.log(`[upsert] subiendo ${points.length} puntos a Qdrant...`);
    const batches: typeof points[] = [];
    for (let i = 0; i < points.length; i += 100) batches.push(points.slice(i, i + 100));
    for (const batch of batches) {
      await qdrant.upsert(COLLECTION, { wait: true, points: batch });
    }
  }

  console.log(`[done] ok=${okCount} skip=${skipCount} err=${errCount} | colleccion: ${COLLECTION}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
