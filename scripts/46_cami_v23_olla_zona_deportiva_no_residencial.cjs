// CAMI v2.3 - Refina contexto de "la olla" en Monte Hermoso.
//
// Info nueva del cliente:
//   "la olla" = sector de medanos DEL OTRO LADO DE SAUCE GRANDE (al este, mas alla
//   del balneario Sauce Grande). Donde se va a andar en moto, cuatri, sandboard.
//   Cerca del Camping Americano.
//
// Implicancia clave:
//   La olla NO es zona residencial. NO hay casas/deptos EN la olla (son dunas puras).
//   Las propiedades CERCANAS estan en:
//     - Sauce Grande (justo antes de la olla viniendo desde MH centro - mejor match RAG: 0.50)
//     - Monte del Este (sector residencial este, antes de Sauce Grande)
//
// Cami debe contextualizar al cliente: "la olla es zona deportiva de medanos,
// no hay propiedades alli pero te muestro lo cercano en Sauce Grande / oeste MH".
//
// Tambien agrego "camping americano" como landmark propio.
//
// Patch quirurgico via str.replace sobre el systemMessage vivo.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

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

// Patch 1: refinar la fila "la olla" en MH landmarks
const OLD_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos (formacion dunaria) en Monte Hermoso. Jerga local de MH. | "medanos monte hermoso" o "la olla monte hermoso" |
`;
const NEW_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos DEL OTRO LADO de Sauce Grande (al este, mas alla del balneario). Zona deportiva: moto, cuatri, sandboard. Cerca del Camping Americano. NO residencial - son dunas puras. | "sauce grande monte hermoso" (lo mas cercano que tiene catalogo) |
| "camping americano" / "el americano" | Camping al este de Monte Hermoso, lindero a la olla y Sauce Grande. | "sauce grande monte hermoso" |
`;

// Patch 2: refinar el Ejemplo 1 con contexto deportivo + offer alternativo
const OLD_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento (NO se lo digas al cliente): "la olla" = sector de medanos en Monte Hermoso (NO confundir con olla de Estomba/Olimpo en BB - el cliente usa jerga de MH).
  Query al Matcher: "medanos monte hermoso" o "la olla monte hermoso"
  Respuesta al cliente: "Dale, te paso opciones cerca de la olla en Monte Hermoso 🌊"`;

const NEW_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento: "la olla" = zona de medanos deportiva (moto/cuatri/sandboard) DEL OTRO LADO de Sauce Grande, cerca del Camping Americano. NO es zona residencial - en la olla no hay propiedades porque son dunas puras. Las propiedades CERCANAS estan en Sauce Grande (lo mas pegado a la olla que tenemos en catalogo).
  Query al Matcher: "sauce grande monte hermoso"
  Respuesta al cliente: "Dale, en la olla mismo no tenemos porque son puros medanos 😅 || Pero pegado, en Sauce Grande, te tiro opciones || [props]"`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No encontre Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;
  let changes = 0;

  if (msg.includes(OLD_OLLA_ROW)) {
    msg = msg.replace(OLD_OLLA_ROW, NEW_OLLA_ROW);
    console.log('✅ Refinada fila "la olla" + agregado "camping americano" en LANDMARKS MH');
    changes++;
  } else if (msg.includes('"camping americano"')) {
    console.log('ℹ️  Ya estaba la fila refinada (idempotente)');
  } else {
    console.log('⚠️  No encontre la fila vieja de "la olla" en MH (formato cambio?)');
  }

  if (msg.includes(OLD_EXAMPLE_1)) {
    msg = msg.replace(OLD_EXAMPLE_1, NEW_EXAMPLE_1);
    console.log('✅ Refinado Ejemplo 1: contexto deportivo + offer alternativo Sauce Grande');
    changes++;
  } else if (msg.includes('en la olla mismo no tenemos porque son medanos')) {
    console.log('ℹ️  Ejemplo 1 ya refinado (idempotente)');
  } else {
    console.log('⚠️  No encontre el ejemplo 1 viejo (formato cambio?)');
  }

  console.log(`\nsystemMessage: ${before} chars -> ${msg.length} chars (delta: ${msg.length - before})`);

  if (changes === 0) {
    console.log('Nada que cambiar. Salgo.');
    return;
  }

  core.parameters.options.systemMessage = msg;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('\nPUT workflow:', upd.s);
  const act = await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
