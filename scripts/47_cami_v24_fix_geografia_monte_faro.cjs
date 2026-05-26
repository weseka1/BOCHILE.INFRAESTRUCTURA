// CAMI v2.4 - FIX geografia este/oeste de Monte Hermoso.
//
// Cliente aclaro CLARO:
//   "La Olla es River y Sauce Grande es Boca" — son polos OPUESTOS de MH.
//   "La olla esta del otro lado del Faro" — la olla esta de un lado, Sauce Grande
//   del otro, y el Faro Recalada esta entre medio.
//
// Mapa correcto de Monte Hermoso (eje este-oeste de la costa):
//
//   [LA OLLA + CAMPING AMERICANO]  ←  Faro Recalada  →  [SAUCE GRANDE]
//          (sector dunas)              (hito divisor)         (balneario)
//                                                                |
//                              MONTE HERMOSO centro              Monte del Este
//
//   La Olla = dunas deportivas (moto/cuatri/sandboard), NO residencial.
//   Sauce Grande = balneario residencial, PROPIEDADES SI HAY.
//   Son extremos opuestos: ofrecer Sauce Grande cuando piden "la olla" es
//   como ofrecer La Boca a uno de River. NO sirve.
//
// Implicancia para Cami:
//   Si cliente pide "cerca de la olla": no hay propiedades residenciales
//   pegadas. Lo mejor: ofrecer Monte Hermoso general o preguntar si le
//   sirve algo del centro de MH (no Sauce Grande que es el extremo opuesto).
//
// Patch quirurgico.

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

// Fix 1: la olla NO es vecina a Sauce Grande, son EXTREMOS opuestos
const OLD_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos DEL OTRO LADO de Sauce Grande (al este, mas alla del balneario). Zona deportiva: moto, cuatri, sandboard. Cerca del Camping Americano. NO residencial - son dunas puras. | "sauce grande monte hermoso" (lo mas cercano que tiene catalogo) |
| "camping americano" / "el americano" | Camping al este de Monte Hermoso, lindero a la olla y Sauce Grande. | "sauce grande monte hermoso" |
`;

const NEW_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos PURO en un extremo de Monte Hermoso (del lado OPUESTO a Sauce Grande - "la olla es River y Sauce Grande es Boca", extremos contrarios separados por el Faro Recalada). Zona deportiva: moto, cuatri, sandboard. Junto al Camping Americano. NO residencial - son dunas puras. | "monte hermoso" general o "camping americano monte hermoso" - **NUNCA ofrezcas Sauce Grande aca, es el extremo opuesto** |
| "camping americano" / "el americano" | Camping en el extremo de MH donde queda la olla. Lindero a las dunas. Lado opuesto a Sauce Grande. | "camping americano monte hermoso" o "monte hermoso" |
`;

// Fix 2: sauce grande - aclarar que esta del OTRO lado opuesto a la olla
const OLD_SG_ROW = `| "sauce grande" | Balneario Sauce Grande (mismo partido MH) | "sauce grande monte hermoso" |
`;
const NEW_SG_ROW = `| "sauce grande" / "el sauce" | Balneario residencial en un extremo de MH, lado OPUESTO a la olla y al Camping Americano. "Sauce Grande es Boca, la olla es River" (extremos opuestos). El Faro Recalada los separa. | "sauce grande monte hermoso" |
`;

// Fix 3: faro recalada - es el hito ENTRE los dos extremos
const OLD_FARO_ROW = `| "el faro" / "faro recalada" | Sector Faro Recalada | "faro recalada monte hermoso" |
`;
const NEW_FARO_ROW = `| "el faro" / "faro recalada" | Faro Recalada - HITO DIVISOR entre los dos extremos de MH: de un lado la olla + camping americano, del otro lado Sauce Grande. Quien pregunta "del otro lado del faro" puede referirse a cualquiera de los dos extremos (preguntar). | "faro recalada monte hermoso" |
`;

// Fix 4: Ejemplo 1 - razonamiento correcto + NO ofrecer Sauce Grande
const OLD_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento: "la olla" = zona de medanos deportiva (moto/cuatri/sandboard) DEL OTRO LADO de Sauce Grande, cerca del Camping Americano. NO es zona residencial - en la olla no hay propiedades porque son dunas puras. Las propiedades CERCANAS estan en Sauce Grande (lo mas pegado a la olla que tenemos en catalogo).
  Query al Matcher: "sauce grande monte hermoso"
  Respuesta al cliente: "Dale, en la olla mismo no tenemos porque son puros medanos 😅 || Pero pegado, en Sauce Grande, te tiro opciones || [props]"`;

const NEW_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento: "la olla" = zona dunas deportivas en UN EXTREMO de MH. NO residencial (son dunas puras). "La olla es River, Sauce Grande es Boca" - son extremos OPUESTOS, NO ofrecer Sauce Grande pensando que esta cerca (queda del lado contrario). Lo mejor: ofrecer algo del lado del Camping Americano o Monte Hermoso general, y aclarar al cliente que la olla en si no es residencial.
  Query al Matcher: "camping americano monte hermoso" o "monte hermoso" general
  Respuesta al cliente: "La olla en si son puros medanos, no hay propiedades 😅 || Pero del mismo lado, cerca del Camping Americano, te puedo mostrar opciones en Monte Hermoso || Si te interesa Sauce Grande tambien tengo, pero eso queda del otro lado del faro || ¿Que preferis?"`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;
  let changes = 0;

  const patches = [
    { name: 'la olla + camping americano (extremo opuesto a SG)', old: OLD_OLLA_ROW, new: NEW_OLLA_ROW },
    { name: 'sauce grande (extremo opuesto a la olla)', old: OLD_SG_ROW, new: NEW_SG_ROW },
    { name: 'faro recalada (hito ENTRE los extremos)', old: OLD_FARO_ROW, new: NEW_FARO_ROW },
    { name: 'Ejemplo 1 razonamiento (River vs Boca)', old: OLD_EXAMPLE_1, new: NEW_EXAMPLE_1 },
  ];

  for (const p of patches) {
    if (msg.includes(p.old)) {
      msg = msg.replace(p.old, p.new);
      console.log(`✅ Patched: ${p.name}`);
      changes++;
    } else {
      console.log(`⚠️  No encontre version vieja: ${p.name}`);
    }
  }

  console.log(`\nsystemMessage: ${before} -> ${msg.length} chars (delta ${msg.length - before})`);
  if (changes === 0) { console.log('Nada que cambiar.'); return; }

  core.parameters.options.systemMessage = msg;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
