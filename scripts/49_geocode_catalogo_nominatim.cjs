// Geocodifica las 239 propiedades del catalogo usando Nominatim (OSM, gratis).
// Politicas Nominatim respetadas:
//   - 1 request/segundo (rate limit estricto)
//   - User-Agent identificable
//   - countrycodes=ar para acotar a Argentina
//
// OUTPUT: scripts/_geocoded_addresses.json con formato:
//   {
//     "prop_id_123": {
//       lat, lng, formatted, source_query, confidence
//     }, ...
//   }
//
// Idempotente: si existe el archivo, solo geocodifica las props que faltan.
// Resumable: si se corta a mitad, retomalo donde quedo.
//
// USO: node scripts/49_geocode_catalogo_nominatim.cjs

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const OUTPUT = path.resolve(__dirname, '_geocoded_addresses.json');
const USER_AGENT = 'Bochile-RAG-Geocoder/1.0 (yamil@weseka.ai)';
const RATE_MS = 1100; // Nominatim policy: max 1 req/sec, vamos a 1.1s safe

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    mod.get(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}, body: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`)); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(new Error('TIMEOUT')); });
  });
}

// Construye queries en orden de specificidad descendente.
// Si la primera no devuelve nada, probamos con menos info.
function buildQueries(prop) {
  const dir = (prop.direccion || '').trim();
  const zona = (prop.zona || '').trim();
  const barrio = (prop.barrio || '').trim();
  if (!dir) return [];

  // Limpiar dir: sacar "esquina", "y" entre calles puede ser problematico para Nominatim
  // Ej "Granada esquina Pueyrredón" -> probar tambien solo "Granada"
  const dirSimple = dir.replace(/\s+(esquina|esq\.?|y)\s+.*$/i, '').trim();

  const queries = [];
  if (zona && zona !== 'unknown') {
    queries.push(`${dir}, ${zona}, Argentina`);
    if (dirSimple !== dir) queries.push(`${dirSimple}, ${zona}, Argentina`);
  }
  if (barrio && barrio !== 'unknown' && barrio !== 'null' && barrio !== zona) {
    queries.push(`${dir}, ${barrio}, Argentina`);
  }
  // Fallback: solo direccion sin contexto
  queries.push(`${dir}, Argentina`);
  if (dirSimple !== dir) queries.push(`${dirSimple}, Argentina`);
  return queries;
}

async function geocodeOne(prop) {
  const queries = buildQueries(prop);
  if (queries.length === 0) return { error: 'no direccion' };

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ar&addressdetails=1`;
    try {
      const arr = await fetchJson(url);
      await sleep(RATE_MS); // rate limit antes del proximo intento sea cual sea el resultado
      if (Array.isArray(arr) && arr.length > 0) {
        const r = arr[0];
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          formatted: r.display_name,
          source_query: q,
          confidence: r.importance ?? null,
          osm_type: r.osm_type,
          osm_id: r.osm_id,
        };
      }
      // intento siguiente
    } catch (e) {
      console.error(`  [err] ${q}: ${e.message.slice(0, 80)}`);
      await sleep(RATE_MS);
    }
  }
  return { error: 'sin resultado', queries_tried: queries };
}

(async () => {
  // Load existing
  let cache = {};
  if (fs.existsSync(OUTPUT)) {
    cache = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    console.log(`Cache existente: ${Object.keys(cache).length} props ya geocodificadas`);
  }

  // Fetch props from local dashboard-api
  console.log('Fetcheando propiedades del Sheet via dashboard-api...');
  const props = await fetchJson('http://localhost:3002/api/propiedades');
  console.log(`Total props: ${props.length}`);

  const pending = props.filter(p =>
    p.direccion && p.direccion !== 'unknown' && p.direccion !== 'null' &&
    !cache[p.prop_id]
  );
  console.log(`Pendientes de geocodificar: ${pending.length}`);
  console.log(`Estimado: ~${Math.ceil(pending.length * RATE_MS / 1000 / 60)} min\n`);

  let ok = 0, fail = 0;
  const startMs = Date.now();
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    process.stdout.write(`[${i + 1}/${pending.length}] ${String(p.prop_id).padEnd(8)} ${(p.direccion || '').slice(0, 35).padEnd(35)} `);
    const result = await geocodeOne(p);
    if (result.error) {
      fail++;
      console.log(`❌ ${result.error}`);
    } else {
      ok++;
      console.log(`✅ ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
    }
    cache[p.prop_id] = { ...result, prop_id: p.prop_id, direccion: p.direccion, zona: p.zona, barrio: p.barrio };

    // Save cada 20 (resumable)
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2));
    }
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2));

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\nLISTO en ${elapsed}s: ${ok} geocodificados / ${fail} fallaron`);
  console.log(`Output: ${OUTPUT}`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
