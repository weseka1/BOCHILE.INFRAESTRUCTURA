// CAMI v2.2 - FIX puntual del landmark "la olla".
//
// Correccion de info real del cliente:
//   "la olla" NO es el Estadio Olimpo de BB.
//   "la olla" es un sector de los MEDANOS en Monte Hermoso (formacion dunaria).
//   Jerga local de MH, no de BB.
//
// Cambios en el prompt:
//   1. Sacar fila "la olla" de la tabla LANDMARKS DE BAHIA BLANCA.
//   2. Agregar fila "la olla" en LANDMARKS DE MONTE HERMOSO.
//   3. Reemplazar Ejemplo 1 (que usaba "la olla" como BB) por la version MH.
//
// Validado contra RAG: "la olla monte hermoso medanos" devuelve 4 props MH
// (Terrazas del Este, Sauce Grande, Las Dunas casa, Stella Maris) con scores 0.42-0.45.
//
// Hace patch quirurgico sobre el prompt vivo (load -> str.replace -> PUT). No reescribe 16k chars.
//
// USO: node scripts/45_cami_v22_fix_la_olla_monte_hermoso.cjs

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

const OLD_BB_OLLA_ROW = `| "la olla" / "la olla de estomba" / "estadio olimpo" | Estadio Olimpo, Villa Mitre/Belgrano. Eje: Estomba + Garibaldi + Donado | "estomba villa mitre" o "garibaldi villa mitre" |
`;

const NEW_MH_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos (formacion dunaria) en Monte Hermoso. Jerga local de MH. | "medanos monte hermoso" o "la olla monte hermoso" |
`;

const OLD_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento (NO se lo digas al cliente): "la olla" = Estadio Olimpo = Villa Mitre, Estomba/Garibaldi
  Query al Matcher: "estomba villa mitre" o "garibaldi villa mitre"
  Respuesta al cliente: "Dale, te paso opciones cerca del estadio en Villa Mitre 👌"`;

const NEW_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento (NO se lo digas al cliente): "la olla" = sector de medanos en Monte Hermoso (NO confundir con olla de Estomba/Olimpo en BB - el cliente usa jerga de MH).
  Query al Matcher: "medanos monte hermoso" o "la olla monte hermoso"
  Respuesta al cliente: "Dale, te paso opciones cerca de la olla en Monte Hermoso 🌊"`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No encontre Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;

  // Patch 1: sacar la fila "la olla" de BB
  if (msg.includes(OLD_BB_OLLA_ROW)) {
    msg = msg.replace(OLD_BB_OLLA_ROW, '');
    console.log('✅ Removido: fila "la olla" de tabla LANDMARKS DE BAHIA BLANCA');
  } else {
    console.log('ℹ️  La fila vieja "la olla" en BB no esta presente (quiza ya se removio).');
  }

  // Patch 2: insertar fila "la olla" al final de MH landmarks
  // Buscamos el final de la tabla MH: la fila "terrazas del este" termina con "|"
  const mhAnchor = `| "terrazas del este" | Complejo en Monte del Este | "terrazas del este monte hermoso" |\n`;
  if (msg.includes(mhAnchor) && !msg.includes('"la olla" / "la olla de monte"')) {
    msg = msg.replace(mhAnchor, mhAnchor + NEW_MH_OLLA_ROW);
    console.log('✅ Agregado: fila "la olla" a tabla LANDMARKS DE MONTE HERMOSO');
  } else if (msg.includes('"la olla" / "la olla de monte"')) {
    console.log('ℹ️  La fila "la olla" en MH ya existe (idempotente).');
  } else {
    console.log('⚠️  No encontre el anchor de la tabla MH para insertar.');
  }

  // Patch 3: reemplazar Ejemplo 1
  if (msg.includes(OLD_EXAMPLE_1)) {
    msg = msg.replace(OLD_EXAMPLE_1, NEW_EXAMPLE_1);
    console.log('✅ Reemplazado: Ejemplo 1 (la olla = MH, ya no BB)');
  } else {
    console.log('ℹ️  El ejemplo 1 viejo no esta presente (quiza ya se actualizo).');
  }

  console.log(`\nsystemMessage: ${before} chars -> ${msg.length} chars (delta: ${msg.length - before})`);

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
