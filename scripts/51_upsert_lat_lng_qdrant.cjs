// Upsert lat/lng al payload de Qdrant SIN tocar vectores.
// Hace snapshot full antes (cloud + local) por seguridad.
//
// Pasos:
//   1. Snapshot de la coleccion bochile_properties en Qdrant cloud
//   2. Descargar snapshot a scripts/_qdrant_snapshots/
//   3. setPayload (merge, no replace) con {lat, lng, geo_formatted} en cada prop_id
//   4. Verificar leyendo un sample
//
// IMPORTANTE: setPayload merges - solo agrega/actualiza campos, no destruye
// el resto del payload. El vector queda intacto.
//
// USO: node scripts/51_upsert_lat_lng_qdrant.cjs

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// Cargar env del apps/rag
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

if (!QDRANT_URL || !QDRANT_API_KEY) {
  console.error('Falta QDRANT_URL o QDRANT_API_KEY en apps/rag/.env');
  process.exit(1);
}

function qdrantReq(method, p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, QDRANT_URL);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
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
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          resolve(j);
        } catch (e) {
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: { 'api-key': QDRANT_API_KEY },
      timeout: 120000,
    };
    https.get(opts, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} on snapshot download`));
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(); });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== PASO 1: Snapshot de Qdrant cloud ===');
  const snapshotResp = await qdrantReq('POST', `/collections/${COLLECTION}/snapshots`);
  const snapshotName = snapshotResp.result?.name;
  console.log(`Snapshot creado en cloud: ${snapshotName}`);
  console.log(`  size: ${(snapshotResp.result.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  creation_time: ${snapshotResp.result.creation_time}\n`);

  console.log('=== PASO 2: Descargar snapshot a local ===');
  const localDir = path.resolve(__dirname, '_qdrant_snapshots');
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, snapshotName);
  const downloadUrl = `${QDRANT_URL}/collections/${COLLECTION}/snapshots/${snapshotName}`;
  await downloadFile(downloadUrl, localPath);
  const sizeMB = (fs.statSync(localPath).size / 1024 / 1024).toFixed(2);
  console.log(`Descargado: ${localPath} (${sizeMB} MB)\n`);

  console.log('=== PASO 3: setPayload con lat/lng ===');
  const geocoded = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_geocoded_clean.json'), 'utf8'));
  const propIds = Object.keys(geocoded);
  console.log(`Props a actualizar: ${propIds.length}\n`);

  // Qdrant filter para identificar puntos por prop_id (que es campo del payload, no el id interno)
  let ok = 0, fail = 0;
  const BATCH = 1; // de a 1 para tener control y rate-limit razonable
  for (let i = 0; i < propIds.length; i++) {
    const pid = propIds[i];
    const g = geocoded[pid];
    const payload = {
      lat: g.lat,
      lng: g.lng,
      geo_formatted: g.formatted || null,
      geo_source: 'nominatim-osm',
      // Qdrant payload geo-index requiere field "location" con { lat, lon }
      location: { lat: g.lat, lon: g.lng },
    };
    try {
      const r = await qdrantReq('POST', `/collections/${COLLECTION}/points/payload`, {
        payload,
        filter: {
          must: [{ key: 'prop_id', match: { value: pid } }]
        }
      });
      if (r.status === 'ok' || r.result?.status === 'ok' || r.result?.status === 'acknowledged') {
        ok++;
        if ((i + 1) % 30 === 0) console.log(`  [${i + 1}/${propIds.length}] ok=${ok} fail=${fail}`);
      } else {
        console.log(`  [${pid}] resp: ${JSON.stringify(r).slice(0, 100)}`);
        ok++;
      }
    } catch (e) {
      fail++;
      console.log(`  [${pid}] ERROR: ${e.message.slice(0, 100)}`);
    }
  }
  console.log(`\nResultado: ${ok} ok / ${fail} fail`);

  console.log('\n=== PASO 4: Verificar con sample ===');
  // Buscar un sample prop_id y verificar que tenga lat/lng
  const samplePropId = propIds[0];
  const verify = await qdrantReq('POST', `/collections/${COLLECTION}/points/scroll`, {
    filter: { must: [{ key: 'prop_id', match: { value: samplePropId } }] },
    limit: 1,
    with_payload: true,
  });
  const pt = verify.result?.points?.[0];
  if (pt && pt.payload?.lat) {
    console.log(`✅ Sample ${samplePropId}: lat=${pt.payload.lat}, lng=${pt.payload.lng}`);
    console.log(`   payload keys: ${Object.keys(pt.payload).join(', ')}`);
  } else {
    console.log(`⚠️  No encontre ${samplePropId} con lat en payload. Verificar.`);
  }

  console.log('\nLISTO. Backup en:');
  console.log(`  Cloud: snapshot ${snapshotName}`);
  console.log(`  Local: ${localPath}`);
  console.log('\nPara rollback: restaurar el snapshot desde Qdrant cloud dashboard.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
