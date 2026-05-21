/**
 * Embeddings VISUALES REALES con CLIP (Tesla mode).
 *
 * Cada imagen se procesa con CLIP-ViT-Base-Patch32 (512d). Las 3 imagenes
 * de cada propiedad se embedean por separado y se sube cada una como un
 * punto distinto en Qdrant -> al buscar, podemos matchear contra
 * CUALQUIERA de las fotos (no contra un promedio que pierde detalle).
 *
 * Coleccion: bochile_property_images_clip (512d, cosine)
 *
 * Uso:
 *   npx tsx src/embed-images-clip.ts                # full (3 imgs por prop)
 *   npx tsx src/embed-images-clip.ts --limit 5      # smoke test
 *   npx tsx src/embed-images-clip.ts --imgs 5       # 5 imgs por prop
 *   npx tsx src/embed-images-clip.ts --reset        # borra coleccion antes
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { config } from './config.js';
import { qdrant } from './qdrant.js';
import { embedImage, CLIP_DIM } from './clip.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const AMBIENT_PROMPT = `Mira esta foto de propiedad inmobiliaria. Responde SOLO con UNA palabra de esta lista, la que mejor describe la imagen:
- fachada (vista exterior frontal del edificio o casa)
- exterior (jardin, patio, balcon, vista desde afuera no fachada)
- living (sala, comedor, ambiente principal interior)
- cocina (cocina sola o integrada)
- dormitorio (habitacion para dormir)
- bano (baño, toilette)
- plano (plano arquitectonico, render 2D)
- detalle (closeup de algun elemento: piso, ventana, escalera, etc.)

Devuelve SOLO la palabra, en minusculas, sin punto ni explicacion.`;

const DESC_PROMPT = `Describe esta foto de propiedad en español, 40-70 palabras, enfocandote en ambiente, materiales, iluminacion, estado y caracteristicas visibles. NO menciones precio/direccion/marca. Devuelve un parrafo plano.`;

async function classifyAndDescribe(imagePath: string): Promise<{ ambient: string; description: string }> {
  const imgBuf = fssync.readFileSync(imagePath);
  const b64 = imgBuf.toString('base64');
  const mime = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${b64}`;

  // 2 calls en paralelo (clasificar + describir)
  const [ambRes, descRes] = await Promise.all([
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: AMBIENT_PROMPT }, { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }] }],
    }),
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.2,
      messages: [{ role: 'user', content: [{ type: 'text', text: DESC_PROMPT }, { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }] }],
    }),
  ]);

  let ambient = (ambRes.choices[0]?.message?.content || '').trim().toLowerCase().replace(/[.,!?]/g, '');
  const validAmbients = ['fachada', 'exterior', 'living', 'cocina', 'dormitorio', 'bano', 'plano', 'detalle'];
  if (!validAmbients.includes(ambient)) ambient = 'detalle';

  const description = (descRes.choices[0]?.message?.content || '').trim();
  return { ambient, description };
}

const COLLECTION = 'bochile_property_images_clip';
const IMAGES_BASE = path.resolve('../scraper/output/images');
const PROPS_JSON = path.resolve('../scraper/output/properties-enriched.json');

const LIMIT_FLAG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG !== -1 ? parseInt(process.argv[LIMIT_FLAG + 1] ?? '0', 10) : 0;
const IMGS_FLAG = process.argv.indexOf('--imgs');
const IMGS_PER_PROP = IMGS_FLAG !== -1 ? parseInt(process.argv[IMGS_FLAG + 1] ?? '3', 10) : 3;
const RESET = process.argv.includes('--reset');

async function ensureCollection() {
  const cols = await qdrant.getCollections();
  const exists = cols.collections.some((c) => c.name === COLLECTION);
  if (exists && RESET) {
    console.log(`[reset] deleting ${COLLECTION}`);
    await qdrant.deleteCollection(COLLECTION);
  }
  const colsAfter = await qdrant.getCollections();
  if (!colsAfter.collections.some((c) => c.name === COLLECTION)) {
    console.log(`[create] ${COLLECTION} (${CLIP_DIM} dims, cosine)`);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: CLIP_DIM, distance: 'Cosine' },
    });
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'prop_id', field_schema: 'keyword', wait: true });
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'image_ambient', field_schema: 'keyword', wait: true });
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

  console.log(`[clip-embed] ${props.length} props * ${IMGS_PER_PROP} imgs = ${props.length * IMGS_PER_PROP} embeddings esperados`);
  console.log(`[clip-embed] cargando modelo CLIP (descarga ~150MB primera vez)...`);

  let okPoints = 0;
  let skipProps = 0;
  let errImgs = 0;
  const pointsBatch: Array<{ id: number; vector: number[]; payload: Record<string, unknown> }> = [];
  let nextId = 1;

  for (let i = 0; i < props.length; i++) {
    const p = props[i]!;
    const folder = path.join(IMAGES_BASE, p.id);
    if (!fssync.existsSync(folder)) {
      skipProps++;
      continue;
    }
    const files = fssync.readdirSync(folder)
      .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
      .sort()
      .slice(0, IMGS_PER_PROP);

    for (const f of files) {
      const fp = path.join(folder, f);
      try {
        const buf = fssync.readFileSync(fp);
        // CLIP embedding + clasificacion ambiente + descripcion (en paralelo)
        const [vector, meta] = await Promise.all([
          embedImage(buf),
          classifyAndDescribe(fp).catch(() => ({ ambient: 'detalle', description: '' })),
        ]);
        pointsBatch.push({
          id: nextId++,
          vector,
          payload: {
            prop_id: String(p.prop_id || p.id),
            folder_id: p.id,
            image_file: f,
            url: p.url,
            title: p.title,
            address: p.address ?? null,
            location: p.location?.name ?? null,
            image_ambient: meta.ambient,
            image_description: meta.description,
          },
        });
        okPoints++;
      } catch (err: unknown) {
        errImgs++;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ✗ embed err ${p.id}/${f}: ${msg.slice(0, 100)}`);
      }
    }

    if ((i + 1) % 5 === 0) {
      console.log(`  ... props ${i + 1}/${props.length} | embeds=${okPoints} | err=${errImgs}`);
    }

    // Upsert cada 100 puntos
    if (pointsBatch.length >= 100) {
      await qdrant.upsert(COLLECTION, { wait: true, points: pointsBatch });
      pointsBatch.length = 0;
    }
  }

  if (pointsBatch.length > 0) {
    await qdrant.upsert(COLLECTION, { wait: true, points: pointsBatch });
  }

  console.log(`[done] points=${okPoints} skipProps=${skipProps} errImgs=${errImgs} | collection=${COLLECTION}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
