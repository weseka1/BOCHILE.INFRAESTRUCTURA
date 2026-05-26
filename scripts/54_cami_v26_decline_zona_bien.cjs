// CAMI v2.6 - Fix respuesta cuando se declina una zona no operada (La Plata, MdP, etc).
//
// Bug detectado en conversacion real (Maria, L-2215028537, 26-may):
//   Cliente: "Me interesa el depto de Calle 43 N°888, La Plata, hola con cochera"
//   Cami:    "Operamos en la zona sur de Buenos Aires, como Bahia Blanca y Monte
//            Hermoso. No tengo informacion especifica sobre La Plata. Te interesa
//            algo en nuestras localidades?"
//
// 3 problemas en la respuesta:
//   1. Solo listo 2 de 6 localidades (falto PA, Pehuen Co, Sierras, Villarino)
//   2. "No tengo informacion especifica" suena a sistema tecnico
//   3. Pivot debil "te interesa algo?" sin pedir presupuesto/tipo/calificar lead
//
// Patch: reemplazar la seccion "PROVINCIAS QUE NO OPERAMOS" con un guion claro
// que (a) declina humanamente, (b) lista TODAS las 6 localidades, (c) pivotea.

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

// Hay 2 versiones del bloque viejo que pueden estar segun script aplicado.
const OLD_BLOCK_V1 = `# ====================================================
# PROVINCIAS QUE NO OPERAMOS
# ====================================================
Capital Federal, GBA, La Plata, **Mar del Plata ciudad (no el barrio BB)**, Cordoba,
Mendoza, Rosario, Neuquen, Bariloche.
"Operamos zona sur de Buenos Aires: BB, Monte Hermoso, Punta Alta, Pehuen Co, Sierras,
Villarino. Si queres te oriento por aca."`;

const OLD_BLOCK_V2 = `# ====================================================
# PROVINCIAS QUE NO OPERAMOS
# ====================================================
Capital Federal, GBA, La Plata, **Mar del Plata (la CIUDAD costera, no el barrio BB)**,
Cordoba, Mendoza, Rosario, Neuquen, Bariloche.
Si el cliente pide eso, decile: "Ojo, nosotros operamos solo zona sur de Buenos Aires
(Bahia Blanca, Monte Hermoso y region). Si queres te oriento por aca, sino te puedo
recomendar gente de tu zona".`;

const NEW_BLOCK = `# ====================================================
# ZONAS QUE NO OPERAMOS - como declinar BIEN
# ====================================================
**Zonas que NO operamos**: Capital Federal, GBA, La Plata, Mar del Plata CIUDAD costera
(NO el barrio Mar del Plata de BB), Cordoba, Mendoza, Rosario, Neuquen, Bariloche,
provincias del norte, exterior.

**Como declinar (3 pasos OBLIGATORIOS, NO te saltes ninguno)**:

PASO 1: Declinar humanamente la zona pedida.
  ✅ "En La Plata no operamos, lamentablemente 😔"
  ❌ NO digas: "no tengo informacion especifica sobre X" (suena a robot)
  ❌ NO digas: "no me especializo en X" (suena a IA)

PASO 2: Listar **LAS 6 LOCALIDADES COMPLETAS** que SI operamos. NUNCA saltees ninguna:
  "Trabajamos toda la zona sur de Buenos Aires: **Bahia Blanca, Monte Hermoso, Punta
  Alta, Pehuen Co, Sierra de la Ventana y Villarino** (campos y pueblos)".

PASO 3: Pivotear el lead - intentar reconvertirlo:
  "Si te flexibilizas con la zona, contame presupuesto, tipo de propiedad y ambientes,
  y te tiro opciones donde si tenemos catalogo || Sino, te puedo recomendar gente
  posta de [zona pedida]".

**FORMATO COMPLETO ejemplo (separado en burbujas con ||):**
"En La Plata no operamos, lamentablemente 😔 ||
Trabajamos toda la zona sur de Buenos Aires: Bahia Blanca, Monte Hermoso, Punta Alta,
Pehuen Co, Sierra de la Ventana y Villarino ||
Si te flexibilizas con la zona contame presupuesto y ambientes, te tiro opciones |
Sino te puedo recomendar gente de La Plata posta"

**EXCEPCION**: si el cliente menciona calle/numero ambiguo (ej "Calle 43" - tipico
La Plata pero MH tambien tiene calles numericas 12, 16, 22, 28, 34, 38), preguntar
ANTES de declinar: "Por casualidad estas mirando Monte Hermoso? Aca tambien hay calles
numericas como la 12, 28, 34...".`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;
  let patched = false;

  if (msg.includes(OLD_BLOCK_V1)) {
    msg = msg.replace(OLD_BLOCK_V1, NEW_BLOCK);
    console.log('✅ Patched: PROVINCIAS QUE NO OPERAMOS (v1 -> guion 3 pasos)');
    patched = true;
  } else if (msg.includes(OLD_BLOCK_V2)) {
    msg = msg.replace(OLD_BLOCK_V2, NEW_BLOCK);
    console.log('✅ Patched: PROVINCIAS QUE NO OPERAMOS (v2 -> guion 3 pasos)');
    patched = true;
  } else if (msg.includes('ZONAS QUE NO OPERAMOS - como declinar BIEN')) {
    console.log('ℹ️  El nuevo bloque ya esta presente (idempotente).');
  } else {
    console.error('⚠️  No encontre bloque viejo de "PROVINCIAS QUE NO OPERAMOS". Buscalo manualmente.');
    process.exit(2);
  }

  console.log(`\nsystemMessage: ${before} -> ${msg.length} chars (delta ${msg.length - before})`);
  if (!patched) return;

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
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
