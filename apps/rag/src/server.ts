/**
 * API REST para que n8n (sub-agente Matcher) consulte Qdrant.
 *
 * Endpoints:
 *   POST /api/search       Body { query, filters?, limit? } → top-K propiedades
 *   GET  /api/property/:id → propiedad por prop_id (read-through del payload)
 *   GET  /api/health
 *   GET  /api/stats        Cantidad de puntos + breakdown por operation/type
 *
 * Por que un server intermedio y no llamar directo a Qdrant desde n8n?
 *   - Centralizar el embedding del query (n8n no tiene que conocer OpenAI)
 *   - Aplicar filtros sanos por default (publicada=true, has_image=true, etc.)
 *   - Validar respuestas con Zod y devolver shape estable que el Matcher consume
 *   - Logear cada query (para tunear el prompt despues)
 */
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from './config.js';
import { qdrant } from './qdrant.js';
import { embedImage as clipEmbedImage } from './clip.js';

const CLIP_COLLECTION = 'bochile_property_images_clip';

const openai = new OpenAI({ apiKey: config.openaiApiKey });
const app = express();

app.use(cors({ origin: config.allowOrigin }));
app.use(express.json({ limit: '512kb' }));

const SearchBodySchema = z.object({
  query: z.string().min(2).max(2000),
  limit: z.number().int().positive().max(20).default(5),
  filters: z
    .object({
      operation: z.enum(['sale', 'rent', 'other']).optional(),
      property_type: z.string().optional(),
      zona: z.string().optional(),
      barrio: z.string().optional(),
      price_currency: z.enum(['USD', 'ARS']).optional(),
      price_max: z.number().positive().optional(),
      price_min: z.number().positive().optional(),
      bedrooms_min: z.number().int().nonnegative().optional(),
      bathrooms_min: z.number().int().nonnegative().optional(),
      area_m2_min: z.number().positive().optional(),
      with_image: z.boolean().optional(),
    })
    .default({}),
});

type SearchBody = z.infer<typeof SearchBodySchema>;

function buildQdrantFilter(f: SearchBody['filters']): unknown {
  const must: unknown[] = [];

  if (f.operation) must.push({ key: 'operation', match: { value: f.operation } });
  if (f.property_type)
    must.push({ key: 'property_type', match: { value: f.property_type } });
  if (f.zona) must.push({ key: 'zona', match: { value: f.zona } });
  if (f.barrio) must.push({ key: 'barrio', match: { value: f.barrio } });
  if (f.price_currency)
    must.push({ key: 'price_currency', match: { value: f.price_currency } });
  if (f.price_max !== undefined)
    must.push({ key: 'price', range: { lte: f.price_max } });
  if (f.price_min !== undefined)
    must.push({ key: 'price', range: { gte: f.price_min } });
  if (f.bedrooms_min !== undefined)
    must.push({ key: 'bedrooms', range: { gte: f.bedrooms_min } });
  if (f.bathrooms_min !== undefined)
    must.push({ key: 'bathrooms', range: { gte: f.bathrooms_min } });
  if (f.area_m2_min !== undefined)
    must.push({ key: 'area_m2', range: { gte: f.area_m2_min } });
  if (f.with_image) must.push({ key: 'has_image', match: { value: true } });

  return must.length > 0 ? { must } : undefined;
}

// ============================================================
// Message buffer compartido para batching humano de Cami.
// n8n no puede compartir staticData entre execs concurrentes,
// asi que centralizamos el buffer en este proceso (Map en memoria).
// Misma instancia = atomicidad inherente (Node es single-thread).
// ============================================================
type BufferedMsg = {
  cmid: string; ts: number; msg_type: string; text: string;
  media_url: string; media_type: string; profile: string; lead_id: string;
};
const messageBuffer = new Map<string, BufferedMsg[]>();

function cleanupBuffer() {
  const cutoff = Date.now() - 30000; // 30s
  for (const [phone, arr] of messageBuffer.entries()) {
    const fresh = arr.filter(m => m.ts >= cutoff);
    if (fresh.length === 0) messageBuffer.delete(phone);
    else messageBuffer.set(phone, fresh);
  }
}

app.post('/api/buffer/add', (req, res) => {
  cleanupBuffer();
  const b = req.body || {};
  if (!b.phone || !b.ts) {
    return res.status(400).json({ error: 'phone and ts required' });
  }
  if (!messageBuffer.has(b.phone)) messageBuffer.set(b.phone, []);
  const arr = messageBuffer.get(b.phone)!;
  // Dedupe por cmid (mismo channelMessageId no se agrega 2 veces)
  if (b.cmid && arr.some(m => m.cmid === b.cmid)) {
    return res.json({ already_in_buffer: true, count: arr.length });
  }
  arr.push({
    cmid: String(b.cmid || ''),
    ts: Number(b.ts),
    msg_type: String(b.msg_type || 'text'),
    text: String(b.text || ''),
    media_url: String(b.media_url || ''),
    media_type: String(b.media_type || ''),
    profile: String(b.profile || ''),
    lead_id: String(b.lead_id || ''),
  });
  res.json({ added: true, count: arr.length, my_ts: b.ts });
});

app.post('/api/buffer/consume', (req, res) => {
  const b = req.body || {};
  if (!b.phone || !b.my_ts) {
    return res.status(400).json({ error: 'phone and my_ts required' });
  }
  const arr = messageBuffer.get(b.phone);
  if (!arr || arr.length === 0) {
    return res.json({ skip: true, reason: 'empty_buffer' });
  }
  const maxTs = Math.max(...arr.map(m => m.ts));
  if (Number(b.my_ts) < maxTs) {
    return res.json({ skip: true, reason: 'not_latest', maxTs, my_ts: b.my_ts });
  }
  // Yo soy el ultimo → consolido y limpio
  const allTexts = arr.filter(m => m.msg_type === 'text').map(m => m.text).filter(t => t && t.trim());
  const consolidated = allTexts.join('\n');
  const snapshot = arr.slice();
  messageBuffer.delete(b.phone);
  res.json({
    skip: false,
    consolidated_text: consolidated,
    count: snapshot.length,
    msgs: snapshot.map(m => ({ ts: m.ts, type: m.msg_type, text: m.text.slice(0, 80) })),
  });
});

app.get('/api/buffer/state', (_req, res) => {
  cleanupBuffer();
  const state: Record<string, number> = {};
  for (const [phone, arr] of messageBuffer.entries()) state[phone] = arr.length;
  res.json({ phones_with_pending: Object.keys(state).length, state });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    collection: config.qdrantCollection,
    embed_model: config.embedModel,
    time: new Date().toISOString(),
  });
});

app.get('/api/stats', async (_req, res, next) => {
  try {
    const info = await qdrant.getCollection(config.qdrantCollection);
    res.json({
      points_count: info.points_count,
      vectors_count: info.vectors_count,
      status: info.status,
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/search', async (req, res, next) => {
  try {
    const body = SearchBodySchema.parse(req.body);

    // 1) Embedear el query
    const embRes = await openai.embeddings.create({
      model: config.embedModel,
      input: body.query,
    });
    const vector = embRes.data[0]!.embedding;

    // 2) Buscar en Qdrant con filtros. Si los filtros estrictos devuelven 0
    //    (probablemente por catalogo con metadata faltante: price=unknown,
    //    barrio=unknown, etc), hacemos fallback escalonado para nunca devolver
    //    vacio cuando hay propiedades semanticamente relevantes.
    const fullFilter = buildQdrantFilter(body.filters);
    let results = await qdrant.search(config.qdrantCollection, {
      vector,
      limit: body.limit,
      filter: fullFilter as never,
      with_payload: true,
    });
    let usedFallback: string | null = null;

    // Fallback 1: sacar filtros numericos (price, bedrooms, etc) pero mantener
    // operation/property_type (categoria es importante).
    if (results.length === 0) {
      const categorical = {
        operation: body.filters.operation,
        property_type: body.filters.property_type,
        price_currency: body.filters.price_currency,
        with_image: body.filters.with_image,
      };
      const catFilter = buildQdrantFilter(categorical);
      results = await qdrant.search(config.qdrantCollection, {
        vector,
        limit: body.limit,
        filter: catFilter as never,
        with_payload: true,
      });
      if (results.length > 0) usedFallback = 'sin_filtros_numericos';
    }

    // Fallback 2: solo operation
    if (results.length === 0 && body.filters.operation) {
      const opFilter = buildQdrantFilter({ operation: body.filters.operation });
      results = await qdrant.search(config.qdrantCollection, {
        vector,
        limit: body.limit,
        filter: opFilter as never,
        with_payload: true,
      });
      if (results.length > 0) usedFallback = 'solo_operation';
    }

    // Fallback 3: sin filtros, solo similitud semantica
    if (results.length === 0) {
      results = await qdrant.search(config.qdrantCollection, {
        vector,
        limit: body.limit,
        with_payload: true,
      });
      if (results.length > 0) usedFallback = 'semantico_puro';
    }

    // 3) Shape estable para el Matcher
    const items = results.map((r) => ({
      prop_id: r.payload?.prop_id ?? String(r.id),
      score: Number(r.score?.toFixed(4) ?? 0),
      title: r.payload?.title ?? null,
      url: r.payload?.url ?? null,
      operation: r.payload?.operation ?? null,
      property_type: r.payload?.property_type ?? null,
      zona: r.payload?.zona ?? null,
      barrio: r.payload?.barrio ?? null,
      address: r.payload?.address ?? null,
      price: r.payload?.price ?? null,
      price_currency: r.payload?.price_currency ?? null,
      price_text: r.payload?.price_text ?? null,
      bedrooms: r.payload?.bedrooms ?? null,
      bathrooms: r.payload?.bathrooms ?? null,
      area_m2: r.payload?.area_m2 ?? null,
      features: r.payload?.features ?? [],
      image_main: r.payload?.image_main ?? null,
    }));

    res.json({
      query: body.query,
      filters: body.filters,
      count: items.length,
      fallback_used: usedFallback,
      items,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Buscar propiedad por IMAGEN: cliente manda foto, identificamos
// la propiedad del catalogo por similitud visual (descripcion + embed).
// ============================================================
const IMAGE_COLLECTION = process.env.IMAGE_COLLECTION ?? 'bochile_property_images';
const VISION_PROMPT = `Describe esta foto de propiedad inmobiliaria en español, 60-100 palabras. Enfocate en: AMBIENTE (living, cocina, dormitorio, baño, balcón, fachada, plano), MATERIALES (parquet, porcelanato, ladrillo, paredes), ILUMINACIÓN, CARACTERÍSTICAS DISTINTIVAS (vista, mobiliario, estilo), ESTADO (nuevo, a reformar, moderno, clásico). NO menciones marca/precio/dirección. Solo un párrafo plano.`;

const SearchByImageSchema = z.object({
  image_url: z.string().url().optional(),
  image_base64: z.string().optional(),
  mime: z.string().optional(),
  limit: z.number().int().positive().max(10).default(3),
}).refine((d) => d.image_url || d.image_base64, { message: 'image_url o image_base64 requerido' });

app.post('/api/search-by-image', async (req, res, next) => {
  try {
    const body = SearchByImageSchema.parse(req.body);

    // 1) Obtener buffer de imagen
    let imgBuf: Buffer;
    if (body.image_base64) {
      imgBuf = Buffer.from(body.image_base64, 'base64');
    } else {
      const r = await fetch(body.image_url!);
      if (!r.ok) return res.status(400).json({ error: `fetch image failed: ${r.status}` });
      imgBuf = Buffer.from(await r.arrayBuffer());
    }

    // 2a) Clasificar ambiente + describir (en paralelo con CLIP embed)
    const b64 = imgBuf.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    const AMBIENTS = ['fachada', 'exterior', 'living', 'cocina', 'dormitorio', 'bano', 'plano', 'detalle'];

    const [clipVector, classifyRes, describeRes] = await Promise.all([
      clipEmbedImage(imgBuf),
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Responde SOLO con UNA palabra de esta lista, la mejor para esta foto: fachada, exterior, living, cocina, dormitorio, bano, plano, detalle. Sin punto ni explicacion.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
        ]}]
      }).catch(() => ({ choices: [{ message: { content: 'detalle' } }] }) as any),
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        temperature: 0.2,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Describe esta propiedad en español 40-70 palabras: ambiente, materiales, iluminacion, estado. No menciones precio/direccion. Parrafo plano.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
        ]}]
      }).catch(() => ({ choices: [{ message: { content: '' } }] }) as any),
    ]);

    let incomingAmbient = (classifyRes.choices[0]?.message?.content || '').trim().toLowerCase().replace(/[.,!?]/g, '');
    if (!AMBIENTS.includes(incomingAmbient)) incomingAmbient = 'detalle';
    const incomingDesc = (describeRes.choices[0]?.message?.content || '').trim();

    // 2b) Embed la descripcion para hybrid score
    let descVector: number[] | null = null;
    if (incomingDesc) {
      try {
        const e = await openai.embeddings.create({ model: config.embedModel, input: incomingDesc });
        descVector = e.data[0]!.embedding;
      } catch {}
    }

    // 3) Search en CLIP con filter por ambiente (acota a mismo tipo de foto)
    const ambientFilter = { must: [{ key: 'image_ambient', match: { value: incomingAmbient } }] };
    let clipResults = await qdrant.search(CLIP_COLLECTION, {
      vector: clipVector,
      limit: body.limit * 6,
      filter: ambientFilter as never,
      with_payload: true,
    });
    // Si filter no devuelve nada (catalogo aun sin clasificar), fallback sin filter
    if (clipResults.length === 0) {
      clipResults = await qdrant.search(CLIP_COLLECTION, {
        vector: clipVector,
        limit: body.limit * 6,
        with_payload: true,
      });
    }

    // 4) Score híbrido: 0.7 * CLIP visual + 0.3 * cosine(descripcion entrante, descripcion catalogo)
    function cosine(a: number[], b: number[]): number {
      let dot = 0, na = 0, nb = 0;
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
      const denom = Math.sqrt(na) * Math.sqrt(nb);
      return denom > 0 ? dot / denom : 0;
    }

    // Para cada candidato: si tiene image_description y tenemos descVector, calcular text similarity
    const candidates = await Promise.all(clipResults.map(async (r) => {
      const clipScore = Number(r.score ?? 0);
      let textScore = 0;
      const cataloDesc = String(r.payload?.image_description ?? '');
      if (descVector && cataloDesc) {
        try {
          const e = await openai.embeddings.create({ model: config.embedModel, input: cataloDesc });
          textScore = cosine(descVector, e.data[0]!.embedding);
        } catch {}
      }
      const hybrid = 0.7 * clipScore + 0.3 * textScore;
      return { clipScore, textScore, hybrid, payload: r.payload as Record<string, unknown>, id: r.id };
    }));

    // Agregar por prop_id usando max hybrid score
    const byProp = new Map<string, { score: number; clip: number; text: number; payload: Record<string, unknown> }>();
    for (const c of candidates) {
      const pid = String(c.payload?.prop_id ?? c.id);
      const prev = byProp.get(pid);
      if (!prev || c.hybrid > prev.score) {
        byProp.set(pid, { score: c.hybrid, clip: c.clipScore, text: c.textScore, payload: c.payload });
      }
    }
    const topProps = [...byProp.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, body.limit);

    // 5) Enriquecer cada match con TODOS los detalles del catalogo (cruzar con bochile_properties)
    const enriched = await Promise.all(topProps.map(async ([pid, info]) => {
      let detail: Record<string, unknown> = {};
      try {
        const sc = await qdrant.scroll(config.qdrantCollection, {
          filter: { must: [{ key: 'prop_id', match: { value: pid } }] } as never,
          limit: 1,
          with_payload: true,
        });
        detail = (sc.points[0]?.payload as Record<string, unknown>) ?? {};
      } catch {}
      return {
        prop_id: pid,
        score: Number(info.score.toFixed(4)),
        clip_score: Number(info.clip.toFixed(4)),
        text_score: Number(info.text.toFixed(4)),
        title: detail.title ?? info.payload.title ?? null,
        url: detail.url ?? info.payload.url ?? null,
        address: detail.address ?? info.payload.address ?? null,
        matched_image: info.payload.image_file ?? null,
        matched_ambient: info.payload.image_ambient ?? null,
        // detalles ricos para que Cami pueda charlar
        operation: detail.operation ?? null,
        property_type: detail.property_type ?? null,
        zona: detail.zona ?? null,
        barrio: detail.barrio ?? null,
        price: detail.price ?? null,
        price_currency: detail.price_currency ?? null,
        price_text: detail.price_text ?? null,
        bedrooms: detail.bedrooms ?? null,
        bathrooms: detail.bathrooms ?? null,
        area_m2: detail.area_m2 ?? null,
        features: detail.features ?? [],
        image_main: detail.image_main ?? null,
      };
    }));

    res.json({
      mode: 'clip_hybrid',
      incoming_ambient: incomingAmbient,
      incoming_desc: incomingDesc.slice(0, 200),
      count: enriched.length,
      items: enriched,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/property/:propId', async (req, res, next) => {
  try {
    const propId = String(req.params.propId);
    // No tenemos un getById por payload directo; usamos scroll con filtro.
    const result = await qdrant.scroll(config.qdrantCollection, {
      filter: { must: [{ key: 'prop_id', match: { value: propId } }] } as never,
      limit: 1,
      with_payload: true,
    });
    if (result.points.length === 0) {
      return res.status(404).json({ error: 'prop_id not found', prop_id: propId });
    }
    res.json(result.points[0]!.payload);
  } catch (err) {
    next(err);
  }
});

app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[ERROR]', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation', issues: err.issues });
    }
    res.status(500).json({ error: err.message });
  },
);

app.listen(config.serverPort, () => {
  console.log(`[bochile-rag] up on http://localhost:${config.serverPort}`);
  console.log(`[bochile-rag] Qdrant: ${config.qdrantUrl}`);
  console.log(`[bochile-rag] Collection: ${config.qdrantCollection}`);
});
