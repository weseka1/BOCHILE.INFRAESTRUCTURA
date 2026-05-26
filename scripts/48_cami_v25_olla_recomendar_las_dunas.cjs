// CAMI v2.5 - Cuando preguntan cerca de "la olla", recomendar Las Dunas (complejo MH).
//
// Info del cliente:
//   "Si preguntan algo cerca de la olla, es recomendar Las Dunas, algo asi"
//
// Es decir: Las Dunas (el complejo residencial de MH, no el barrio de BB) es
// el residencial mas pegado del lado de la olla / Camping Americano.
//
// Mapa final de Monte Hermoso (este episodio):
//   [LAS DUNAS + CAMPING AMERICANO + LA OLLA]  ←  Faro Recalada  →  [SAUCE GRANDE]
//        (extremo: residencial Las Dunas                            (extremo opuesto:
//         + zona deportiva la olla)                                   balneario residencial)
//
// Patch: actualizar query sugerida del landmark "la olla" y del Ejemplo 1.

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

// Patch 1: query sugerida del landmark "la olla" -> ahora apunta a Las Dunas MH
const OLD_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos PURO en un extremo de Monte Hermoso (del lado OPUESTO a Sauce Grande - "la olla es River y Sauce Grande es Boca", extremos contrarios separados por el Faro Recalada). Zona deportiva: moto, cuatri, sandboard. Junto al Camping Americano. NO residencial - son dunas puras. | "monte hermoso" general o "camping americano monte hermoso" - **NUNCA ofrezcas Sauce Grande aca, es el extremo opuesto** |
| "camping americano" / "el americano" | Camping en el extremo de MH donde queda la olla. Lindero a las dunas. Lado opuesto a Sauce Grande. | "camping americano monte hermoso" o "monte hermoso" |
`;

const NEW_OLLA_ROW = `| "la olla" / "la olla de monte" | Sector de medanos en un extremo de MH (lado OPUESTO a Sauce Grande - "la olla es River, Sauce Grande es Boca"). Zona deportiva (moto/cuatri/sandboard), NO residencial. Junto a Camping Americano. **El complejo residencial MAS CERCANO es Las Dunas (Monte Hermoso)** - eso es lo que recomendas. | "las dunas monte hermoso" |
| "camping americano" / "el americano" | Camping en el extremo de MH donde queda la olla. Lindero a Las Dunas y a las dunas mismas. Lado opuesto a Sauce Grande. | "las dunas monte hermoso" o "camping americano monte hermoso" |
`;

// Patch 2: Ejemplo 1 razonamiento - ahora recomienda Las Dunas
const OLD_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento: "la olla" = zona dunas deportivas en UN EXTREMO de MH. NO residencial (son dunas puras). "La olla es River, Sauce Grande es Boca" - son extremos OPUESTOS, NO ofrecer Sauce Grande pensando que esta cerca (queda del lado contrario). Lo mejor: ofrecer algo del lado del Camping Americano o Monte Hermoso general, y aclarar al cliente que la olla en si no es residencial.
  Query al Matcher: "camping americano monte hermoso" o "monte hermoso" general
  Respuesta al cliente: "La olla en si son puros medanos, no hay propiedades 😅 || Pero del mismo lado, cerca del Camping Americano, te puedo mostrar opciones en Monte Hermoso || Si te interesa Sauce Grande tambien tengo, pero eso queda del otro lado del faro || ¿Que preferis?"`;

const NEW_EXAMPLE_1 = `Ejemplo 1: Cliente: "Busco algo cerca de la olla"
  Tu razonamiento: "la olla" = zona dunas deportivas (moto/cuatri/sandboard) en UN EXTREMO de MH, NO residencial. "La olla es River, Sauce Grande es Boca" - son extremos OPUESTOS. El complejo residencial mas cercano del lado de la olla es **Las Dunas (Monte Hermoso)**. Recomendarlo directo.
  Query al Matcher: "las dunas monte hermoso"
  Respuesta al cliente: "Dale 👌 || En la olla mismo son puros medanos, pero pegado tenemos el complejo Las Dunas en Monte Hermoso, que es el mas cercano del lado || Te paso opciones || [props del Matcher]"`;

// Patch 3: actualizar la fila de ambiguedad de "Las Dunas" para mencionar el contexto
const OLD_AMBIG_LAS_DUNAS = `| "Las Dunas" | "¿Las Dunas en Monte Hermoso (el complejo costero) o el barrio Las Dunas en Bahia Blanca?" |
`;
const NEW_AMBIG_LAS_DUNAS = `| "Las Dunas" (sin contexto previo) | "¿Las Dunas en Monte Hermoso (el complejo costero pegado a la olla y Camping Americano) o el barrio Las Dunas en Bahia Blanca?" - **Si el cliente vinia hablando de MH o la olla, asumir directamente Las Dunas Monte Hermoso sin preguntar**. |
`;

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
    { name: 'la olla + camping americano -> recomendar Las Dunas MH', old: OLD_OLLA_ROW, new: NEW_OLLA_ROW },
    { name: 'Ejemplo 1: recomendar Las Dunas MH directo', old: OLD_EXAMPLE_1, new: NEW_EXAMPLE_1 },
    { name: 'Ambiguedad Las Dunas: contextual (MH si vino de olla/MH)', old: OLD_AMBIG_LAS_DUNAS, new: NEW_AMBIG_LAS_DUNAS },
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
