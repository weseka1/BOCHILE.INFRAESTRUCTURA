/**
 * Enriquece el output del scraper usando gpt-4o-mini para extraer datos
 * estructurados (ambientes, m², barrio, precio, etc.) que están escritos
 * en TEXTO LIBRE en la descripción y title pero no en el bloque estructurado
 * de WPCasa.
 *
 * Pipeline completo:
 *   scraper → properties.json (datos estructurados)
 *   enricher → properties-enriched.json (+ datos extraidos del texto libre)
 *   embed → Qdrant
 *
 * Filosofia:
 *   - NO pisa datos que ya vinieron del HTML estructurado.
 *   - Solo rellena campos que el scraper dejó null/unknown.
 *   - Si el LLM no encuentra el dato en el texto, deja null (no inventa).
 *
 * Costo: ~USD 0.02 por scrape completo de 239 props con gpt-4o-mini.
 *
 * Uso:
 *   npx tsx src/enricher.ts                    # full enrich
 *   npx tsx src/enricher.ts --limit 5          # smoke test
 *   npx tsx src/enricher.ts --force-all        # reenriquece incluso props ya completas
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { config } from './config.js';

const LIMIT_FLAG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG !== -1 ? parseInt(process.argv[LIMIT_FLAG + 1] ?? '0', 10) : 0;
const FORCE_ALL = process.argv.includes('--force-all');
const CONCURRENCY = 8;
const ENRICH_MODEL = 'gpt-4o-mini';

const openai = new OpenAI({ apiKey: config.openaiApiKey });
const limit = pLimit(CONCURRENCY);

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
  enriched_at?: string;
};

/**
 * Schema del JSON que pedimos al LLM. Todo nullable porque el LLM solo debe
 * devolver lo que ENCONTRO en el texto. Nunca inventar.
 */
const EnrichmentSchema = z.object({
  property_type: z
    .string()
    .nullish()
    .transform((v) => {
      if (!v) return null;
      const norm = v.toLowerCase().trim();
      // Normalizar variantes que el LLM a veces devuelve fuera del enum estricto
      const map: Record<string, string> = {
        comercial: 'local',
        negocio: 'local',
        deposito: 'galpon',
        depósito: 'galpon',
        terreno: 'lote',
        chacra: 'campo',
        estancia: 'campo',
        departamentos: 'departamento',
        depto: 'departamento',
        apartamento: 'departamento',
        garage: 'cochera',
      };
      const mapped = map[norm] ?? norm;
      const valid = [
        'casa', 'departamento', 'ph', 'duplex', 'lote', 'local',
        'oficina', 'cochera', 'campo', 'galpon',
      ];
      return valid.includes(mapped) ? mapped : null;
    }),
  bedrooms: z.number().int().nonnegative().nullish().transform((v) => v ?? null),
  bathrooms: z.number().int().nonnegative().nullish().transform((v) => v ?? null),
  area_m2: z.number().positive().nullish().transform((v) => v ?? null),
  lot_size_m2: z.number().positive().nullish().transform((v) => v ?? null),
  price: z.number().positive().nullish().transform((v) => v ?? null),
  price_currency: z.enum(['USD', 'ARS']).nullish().transform((v) => v ?? null),
  barrio: z.string().nullish().transform((v) => v ?? null),
  address: z.string().nullish().transform((v) => v ?? null),
  features_extra: z.array(z.string()).nullish().transform((v) => v ?? []),
  resumen: z.string().max(300).nullish().transform((v) => v ?? null),
});

type Enrichment = z.infer<typeof EnrichmentSchema>;

const SYSTEM_PROMPT = `Sos un asistente experto en bienes raíces argentinos. Tu única tarea: extraer datos estructurados del texto libre de un listing inmobiliario.

REGLAS DE ORO:
1. SOLO devolvés lo que está EXPLÍCITAMENTE escrito en el texto. NUNCA inventes.
2. Si un dato no aparece en el texto, devolvé null para ese campo.
3. Para "barrio": usá nombres conocidos de Bahía Blanca (Palihue, Centro, Villa Mitre, Villa Belgrano, Patagonia, Universitario, Tiro Federal, Aldea Romana, Parque Norte, Las Calandrias, Solares Norte, Pacífico, etc.), Monte Hermoso, Sierra de la Ventana. Si menciona una calle conocida pero no el barrio, igual ponelo si podés inferir (ej: "Cuyo 1265" → "Paseo de la Mujer" si el texto lo aclara).
4. Para "address": calle y número exactos si están en el texto.
5. Para "property_type": elegí UNA opción del enum. Si dice "Casa en PH" elegí "ph". Si dice "depósito" elegí "galpon".
6. Para "price": número entero, sin separadores. Solo si el texto da un valor concreto (ej "USD 285.000" → 285000). Si dice "Consulte" o "Consultar", devolvé null.
7. Para "price_currency": "USD" o "ARS". Si el texto usa "U$S", "u$s", "USD", "dólares" → USD. Si usa "$", "pesos", "ARS" → ARS.
8. Para "ambientes": "3 dormitorios" → bedrooms: 3. "monoambiente" → bedrooms: 1.
9. Para "m²": "170 m² cubiertos" → area_m2: 170. "lote de 300m2" → lot_size_m2: 300.
10. Para "features_extra": características destacadas que el texto menciona y son útiles para venta (ej: "quincho", "pileta", "cochera", "amoblado", "frente al mar"). 1 palabra cada feature, máx 8 items.
11. Para "resumen": 1-2 oraciones describiendo la propiedad en lenguaje natural, máx 300 chars. NO repitas datos numéricos exactos, hablá de la PROPUESTA de valor (familiar, inversión, ubicación, etc.).

Output: JSON válido contra el schema. SIN texto adicional. Solo el objeto JSON.`;

function buildUserPrompt(p: Property): string {
  const knownData: string[] = [];
  if (p.property_type) knownData.push(`tipo_ya_detectado: ${p.property_type}`);
  if (p.location.name) knownData.push(`zona_ya_detectada: ${p.location.name}`);
  if (p.attributes.bedrooms) knownData.push(`ambientes_ya_detectados: ${p.attributes.bedrooms}`);
  if (p.attributes.area_m2) knownData.push(`m2_ya_detectados: ${p.attributes.area_m2}`);
  if (p.price) knownData.push(`precio_ya_detectado: ${p.price} ${p.price_currency}`);
  const knownSection = knownData.length > 0 ? `\nDatos ya detectados del HTML estructurado:\n${knownData.join('\n')}\n` : '';

  return `Listing a procesar:

TITLE: ${p.title}
SLUG: ${p.slug}
URL: ${p.url}
PRECIO TEXTO: ${p.price_text}
DESCRIPCION:
${p.description.slice(0, 2500)}
${knownSection}
Devolvé el JSON estructurado con los datos del texto.`;
}

async function enrichOne(p: Property): Promise<Enrichment | null> {
  try {
    const res = await openai.chat.completions.create({
      model: ENRICH_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(p) },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return EnrichmentSchema.parse(parsed);
  } catch (err) {
    console.error(`[enrich] ${p.id} error: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Merge: solo sobreescribe valores null/unknown del scraper.
 * NO pisa datos que ya vinieron del HTML estructurado.
 */
function merge(p: Property, e: Enrichment): Property {
  const enriched: Property = { ...p };

  if (!enriched.property_type && e.property_type) enriched.property_type = e.property_type;

  if (e.address && !enriched.address) enriched.address = e.address;

  if (e.price !== null && enriched.price === null) {
    enriched.price = e.price;
    if (!enriched.price_currency && e.price_currency) enriched.price_currency = e.price_currency;
  }

  enriched.attributes = { ...enriched.attributes };
  if (enriched.attributes.bedrooms == null && e.bedrooms != null)
    enriched.attributes.bedrooms = e.bedrooms;
  if (enriched.attributes.bathrooms == null && e.bathrooms != null)
    enriched.attributes.bathrooms = e.bathrooms;
  if (enriched.attributes.area_m2 == null && e.area_m2 != null)
    enriched.attributes.area_m2 = e.area_m2;
  if (enriched.attributes.lot_size_m2 == null && e.lot_size_m2 != null)
    enriched.attributes.lot_size_m2 = e.lot_size_m2;

  // Features extra (no duplicar)
  const featSet = new Set(enriched.features.map((f) => f.toLowerCase()));
  for (const f of e.features_extra) {
    if (!featSet.has(f.toLowerCase())) {
      enriched.features.push(f);
      featSet.add(f.toLowerCase());
    }
  }

  // Barrio enriquecido viaja en un campo nuevo dentro de la propiedad para
  // no romper el schema actual. El embedder lo va a sumar al payload de Qdrant.
  (enriched as Property & { barrio_extracted?: string | null; resumen?: string | null }).barrio_extracted = e.barrio;
  (enriched as Property & { barrio_extracted?: string | null; resumen?: string | null }).resumen = e.resumen;

  enriched.enriched_at = new Date().toISOString();
  return enriched;
}

function needsEnrichment(p: Property): boolean {
  if (FORCE_ALL) return true;
  // Si ya esta enriquecido en una corrida previa, skip salvo --force-all
  if (p.enriched_at) return false;
  // Enriquecer si falta cualquier campo importante
  return (
    !p.property_type ||
    p.attributes.bedrooms == null ||
    p.attributes.area_m2 == null ||
    !p.address ||
    (p.price === null && !/consult/i.test(p.price_text))
  );
}

async function main() {
  const scraperPath = path.resolve(config.scraperOutputJson);
  const enrichedPath = path.join(path.dirname(scraperPath), 'properties-enriched.json');

  console.log(`[enrich] leyendo ${scraperPath}`);
  const properties: Property[] = JSON.parse(await fs.readFile(scraperPath, 'utf-8'));

  // Cargar enriquecidas previas para evitar duplicar trabajo
  let prevEnriched: Map<string, Property> = new Map();
  try {
    const prev = JSON.parse(await fs.readFile(enrichedPath, 'utf-8')) as Property[];
    prevEnriched = new Map(prev.map((p) => [p.id, p]));
    console.log(`[enrich] ${prevEnriched.size} props ya enriquecidas en run previo`);
  } catch {
    /* primer run */
  }

  const work: Property[] = [];
  const passthrough: Property[] = [];
  for (const p of properties) {
    const prev = prevEnriched.get(p.id);
    // si ya esta enriquecido y los datos del scraper no cambiaron, reusar
    if (prev && !FORCE_ALL && prev.modified_at === p.modified_at && prev.enriched_at) {
      passthrough.push({ ...p, ...prev });
      continue;
    }
    if (needsEnrichment(p)) work.push(p);
    else passthrough.push(p);
  }

  const slice = LIMIT > 0 ? work.slice(0, LIMIT) : work;
  console.log(
    `[enrich] ${properties.length} totales | ${passthrough.length} skip | ${slice.length} a enriquecer (modelo ${ENRICH_MODEL})`,
  );

  const enrichedResults: Property[] = [];
  let okCount = 0;
  let failCount = 0;

  const tasks = slice.map((p) =>
    limit(async () => {
      const e = await enrichOne(p);
      if (e) {
        enrichedResults.push(merge(p, e));
        okCount++;
        process.stdout.write('.');
      } else {
        enrichedResults.push(p);
        failCount++;
        process.stdout.write('x');
      }
    }),
  );
  await Promise.all(tasks);
  process.stdout.write('\n');

  const final = [...passthrough, ...enrichedResults].sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(enrichedPath, JSON.stringify(final, null, 2), 'utf-8');

  console.log(`[enrich] terminado: ${okCount} ok, ${failCount} fallaron`);
  console.log(`[enrich] output: ${enrichedPath}`);

  // Stats de cobertura post-enrich
  const cov = {
    property_type: final.filter((p) => p.property_type).length,
    bedrooms: final.filter((p) => p.attributes.bedrooms != null).length,
    bathrooms: final.filter((p) => p.attributes.bathrooms != null).length,
    area_m2: final.filter((p) => p.attributes.area_m2 != null).length,
    price: final.filter((p) => p.price != null).length,
    address: final.filter((p) => p.address).length,
    barrio_extracted: final.filter(
      (p) => (p as Property & { barrio_extracted?: string | null }).barrio_extracted,
    ).length,
    resumen: final.filter((p) => (p as Property & { resumen?: string | null }).resumen).length,
  };
  console.log('[enrich] cobertura post-enrich:');
  for (const [k, v] of Object.entries(cov)) {
    console.log(`  ${k.padEnd(20)} ${v}/${final.length} (${Math.round((v / final.length) * 100)}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
