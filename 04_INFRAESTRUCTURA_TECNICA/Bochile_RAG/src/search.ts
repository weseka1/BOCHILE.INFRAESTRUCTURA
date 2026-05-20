/**
 * CLI helper: prueba similarity search desde terminal sin levantar el server.
 *
 * Uso:
 *   npx tsx src/search.ts "casa 3 ambientes en Palihue hasta 300k USD"
 *   npx tsx src/search.ts "depto centro alquiler" --limit 10
 */
import OpenAI from 'openai';
import { config } from './config.js';
import { qdrant } from './qdrant.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '5', 10) : 5;
const skipIdx = limitIdx !== -1 ? limitIdx + 1 : -1;
const query = args
  .filter((a, i) => !a.startsWith('--') && i !== skipIdx)
  .join(' ');

if (!query) {
  console.error('Uso: npx tsx src/search.ts "<query>" [--limit N]');
  process.exit(1);
}

async function main() {
  console.log(`[search] query: "${query}"`);
  console.log(`[search] embedeando...`);
  const embRes = await openai.embeddings.create({
    model: config.embedModel,
    input: query,
  });
  const vector = embRes.data[0]!.embedding;

  console.log(`[search] buscando top-${limit} en Qdrant...`);
  const results = await qdrant.search(config.qdrantCollection, {
    vector,
    limit,
    with_payload: true,
  });

  console.log('');
  console.log(`[search] ${results.length} resultados:`);
  for (const r of results) {
    const p = r.payload as Record<string, unknown>;
    const score = Number(r.score?.toFixed(4) ?? 0);
    const priceStr = p.price
      ? `${p.price} ${p.price_currency}`
      : (p.price_text as string);
    console.log(
      `  ${String(score).padEnd(7)} [${String(p.property_type ?? '?').padEnd(12)}] ${String(p.barrio ?? p.zona ?? '?').padEnd(20)} ${String(priceStr).padEnd(18)} ${p.title}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
