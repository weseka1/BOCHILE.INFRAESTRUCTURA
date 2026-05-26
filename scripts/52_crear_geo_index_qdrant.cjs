// Crea el indice geo en Qdrant sobre el campo "location" del payload.
// Sin este indice, las queries geo_radius hacen scan completo (lento).
// Con el indice, son near-instantaneas.
//
// Idempotente: si ya existe, no falla.
//
// USO: node scripts/52_crear_geo_index_qdrant.cjs

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../apps/rag/.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = loadEnv();
const QDRANT_URL = env.QDRANT_URL;
const QDRANT_API_KEY = env.QDRANT_API_KEY;
const COLLECTION = env.QDRANT_COLLECTION || 'bochile_properties';

function qdrantReq(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, QDRANT_URL);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
      headers: { 'api-key': QDRANT_API_KEY, 'Accept': 'application/json' },
      timeout: 30000,
    };
    if (data) { opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          const j = JSON.parse(text);
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          resolve(j);
        } catch (e) {
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          resolve({ raw: text });
        }
      });
    });
    x.on('error', reject);
    x.on('timeout', () => x.destroy(new Error('TIMEOUT')));
    if (data) x.write(data);
    x.end();
  });
}

(async () => {
  console.log('=== PASO 1: Verificar collection info ===');
  const info = await qdrantReq('GET', `/collections/${COLLECTION}`);
  const indexedFields = info.result?.payload_schema || {};
  console.log('Indexed payload fields:', Object.keys(indexedFields));
  console.log('');

  if (indexedFields.location) {
    console.log('ℹ️  Ya existe indice en "location":', JSON.stringify(indexedFields.location));
    return;
  }

  console.log('=== PASO 2: Crear indice geo en field "location" ===');
  try {
    const r = await qdrantReq('PUT', `/collections/${COLLECTION}/index`, {
      field_name: 'location',
      field_schema: 'geo',
    });
    console.log('✅ Indice geo creado:', JSON.stringify(r.result || r).slice(0, 200));
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('ℹ️  Indice ya existia (race condition):', e.message.slice(0, 100));
    } else {
      throw e;
    }
  }

  console.log('\n=== PASO 3: Smoke test - query geo_radius ===');
  // Buscar props en 2km del centro de BB (-38.7191, -62.2724)
  const test = await qdrantReq('POST', `/collections/${COLLECTION}/points/scroll`, {
    filter: {
      must: [{
        key: 'location',
        geo_radius: {
          center: { lat: -38.7191, lon: -62.2724 },
          radius: 2000, // 2km en metros
        }
      }]
    },
    limit: 5,
    with_payload: true,
  });
  const pts = test.result?.points || [];
  console.log(`Encontradas ${pts.length} props en 2km del centro de BB:`);
  for (const p of pts.slice(0, 5)) {
    console.log(`  ${p.payload?.prop_id} | ${p.payload?.address} | ${p.payload?.lat}, ${p.payload?.lng}`);
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
