// Bug: cliente dijo "Alem 127" en audio. Whisper transcribio "M127" (sin
// contexto, fonetizo "el-Alem" como "M"). Bot interpreto literal y respondio
// "coordinar visita al M127" — quedaba ridiculo.
//
// Fix: agregar parametro "prompt" a Whisper con vocabulario tipico del
// negocio inmobiliario Bochile (direcciones, zonas, nombres). Whisper usa
// el prompt como hint para resolver ambiguedades foneticas. Esto hace que
// "Alem 127" se transcriba bien en vez de "M127".

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

// Whisper acepta hasta 224 tokens en el prompt. Empacamos el vocabulario
// mas critico de Bochile sin pasarnos.
const WHISPER_PROMPT = 'Conversacion en espanol argentino sobre propiedades inmobiliarias de Bochile en Bahia Blanca, Monte Hermoso, Punta Alta, Pehuen Co, Sierra de la Ventana y Villarino. Vendedora: Cami, Camila Pomerich. Direcciones tipicas: Alem 127, Witcomb 65, Las Heras, Soler, San Martin, Sarmiento, Estomba, Avenida Colon, Villa Mitre, Palihue, Patagonia, Bulevar, Don Bosco. Zonas: centro, costa, Las Dunas, Barrio Universitario. Tipo de propiedad: departamento, semipiso, casa, PH, terreno, local, cochera. Operaciones: venta, alquiler, alquiler temporario. Moneda: dolares, pesos, USD, ARS.';

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_whisper_prompt_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const node = w.nodes.find(n => n.name === 'Audio - Whisper');
  if (!node) { console.error('No encontre Audio - Whisper'); process.exit(1); }

  node.parameters = node.parameters || {};
  node.parameters.options = node.parameters.options || {};
  if (node.parameters.options.prompt === WHISPER_PROMPT) {
    console.log('ℹ️  Ya estaba aplicado');
    return;
  }
  node.parameters.options.prompt = WHISPER_PROMPT;
  // Asegurar que language y temperature estan bien (cero invento)
  node.parameters.options.language = 'es';
  console.log('✅ Whisper ahora tiene prompt de vocabulario Bochile');
  console.log('   Prompt:', WHISPER_PROMPT.slice(0, 120) + '...');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Probar de nuevo el audio "Alem 127" ===');
  console.log('Mandate un audio diciendo "Alem 127". Whisper deberia transcribirlo bien ahora.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
