import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  openaiApiKey: required('OPENAI_API_KEY'),
  qdrantUrl: process.env.QDRANT_URL ?? 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY || undefined,
  qdrantCollection: process.env.QDRANT_COLLECTION ?? 'bochile_properties',
  embedModel: process.env.EMBED_MODEL ?? 'text-embedding-3-small',
  embedDim: parseInt(process.env.EMBED_DIM ?? '1536', 10),
  scraperOutputJson:
    process.env.SCRAPER_OUTPUT_JSON ?? '../Bochile_Scraper/output/properties.json',
  serverPort: parseInt(process.env.SERVER_PORT ?? '3003', 10),
  allowOrigin: process.env.ALLOW_ORIGIN ?? '*',
};
