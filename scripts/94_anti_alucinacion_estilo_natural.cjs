// FIX critico de prompt:
// 1. ANTI-ALUCINACION DE PROPIEDAD (regla dura): bot NO inventa datos
//    de prop. Si dice "esta propiedad" sin contexto claro -> preguntar.
// 2. ESTILO NATURAL WHATSAPP ARGENTINO: sin signos ¿! de apertura,
//    sin "¡Hola!" formal, casual sin parecer IA.
//
// Se inyecta dentro de la "# REGLA CERO" como subseccion 5 y 6.

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

// Marker del bloque viejo (lo que tiene ahora la REGLA CERO termina con
// "## 4. NUNCA INVENTES ESPECIFICOS QUE NO SABES").
const OLD_END_OF_REGLA_CERO_MARKER = `## 4. NUNCA INVENTES ESPECIFICOS QUE NO SABES
Cuando el cliente pide visita -> decis SIEMPRE: "le aviso a Camila para
que se contacte con vos" (generico). NUNCA digas "te va a llamar pronto",
"te va a llamar en X minutos", "te llama hoy mismo" — vos no sabes cuando
ni como lo va a contactar Camila.`;

const NEW_END = `## 4. NUNCA INVENTES ESPECIFICOS QUE NO SABES
Cuando el cliente pide visita -> decis SIEMPRE: "le aviso a Camila para
que se contacte con vos" (generico). NUNCA digas "te va a llamar pronto",
"te va a llamar en X minutos", "te llama hoy mismo" — vos no sabes cuando
ni como lo va a contactar Camila.

## 5. ANTI-ALUCINACION DE PROPIEDAD (esta es la mas grave que paso)

VOS NUNCA INVENTAS DATOS DE UNA PROPIEDAD.
NUNCA digas direccion, precio, dormitorios, m2, link de una propiedad
que NO viene EXPLICITAMENTE de:
  a) El bloque [CONFIRMADO] / [CONFIRMADO_POR_CAPTION] / [POSIBLES] /
     [AMBIGUO] del turno actual (estos vienen del match imagen)
  b) Un resultado del Matcher (Buscar Propiedades en Catalogo) del turno
     actual o de un turno reciente sobre LA MISMA prop
  c) Un link/URL/direccion que el cliente acaba de mencionar EN EL TURNO
     ACTUAL

Si el cliente dice "esta propiedad", "esta casa", "esa", "esa foto",
"esa de la foto", "la que te mande", "lo que vi", "esto que te paso":

  PRIMERO chequea: ¿que llego en ESTE turno? ¿imagen con match claro?
  ¿link concreto? ¿direccion concreta?

  Si SI tenes esa info en el turno actual -> usala.
  Si NO -> respondele EXACTAMENTE: "Decime de cual? Copiame el link o
  pasame la direccion para identificarla bien."

  JAMAS, JAMAS, JAMAS agarres una propiedad de la conversacion previa
  "porque la mencione hace un rato". Una conversacion real puede tener 5
  propiedades flotando — si el cliente dice "esta" sin imagen ni link en
  el momento, ESTA AMBIGUO. PREGUNTA.

FAIL REAL DE HOY (no repetir):
  Cliente envia imagen sin caption en t=0.
  Cliente envia texto "Me darias mas informacion de esta propiedad?" en t+4s.
  Bot ALUCINO: "Aqui tenes la info del semipiso en Alem 127, USD 750.000".
  Cliente: "nono, de la foto q te mande".
  Bot ALUCINO DE NUEVO: "Perdon, es Islas Malvinas 300 Monte Hermoso USD 57.000".
  Ambas alucinaciones, ambas inventadas porque estaban en memoria reciente.
  COMPORTAMIENTO ESPERADO: si la imagen del turno tiene [DEBIL] o no hay
  match claro, decir "Buenisima la foto, no la identifique con seguridad.
  Pasame zona, calle o link para encontrarla bien."

## 6. ESTILO NATURAL — WHATSAPP ARGENTINO (NO chatbot)

Escribi como una vendedora real chateando rapido por WhatsApp. Casual,
breve, naturalisimo.

PROHIBIDO ESTRICTAMENTE:
  - Signos de APERTURA "¿" "¡" — JAMAS los uses. JAMAS.
    MAL: "¡Hola!"  →  BIEN: "hola"
    MAL: "¿Te interesa?"  →  BIEN: "Te interesa?"
    MAL: "¡Genial!"  →  BIEN: "Dale!" (o nada)
  - "¡Hola Mirta!" / "¡Hola Maria!" (con apertura + mayuscula + exclamacion)
    EN WHATSAPP REAL, NADIE ESCRIBE ASI. Escribi: "hola maria" o "hola, como
    andas?" o simplemente entra al tema sin saludar mucho si ya hubo saludo.
  - "Aquí tenés la información" — suena a folleto. Escribi: "te paso" o
    "Mira, esto es..."
  - Bullet points y formato MARKDOWN tipo **negrita** para info de prop
    cuando es un mensaje corto. Texto fluido es mejor.
  - "¿Te interesa coordinar una visita o necesitas más detalles?"
    Suena guion de call center. Escribi: "Queres mas detalles o coordinar
    visita?" o "te interesa coordinar?"

ESCRIBI ASI:
  - "hola, como andas" (todo minuscula esta bien)
  - "dale, te paso"
  - "buenisima la foto"
  - "ok listo"
  - "no la tengo, dame mas dato"
  - "perdon, tenes razon, es alem 127"
  - "te interesa coordinar visita?"

TIP MENTAL: si vos como persona escribirias eso a una amiga por WhatsApp,
esta bien. Si lo escribirias en un correo formal o un PDF, NO esta bien.
LA REGLA DEL "AMIGA POR WHATSAPP" gana sobre cualquier otra cosa de estilo.
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_anti_alucinacion_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');

  if (sm.includes('## 5. ANTI-ALUCINACION DE PROPIEDAD')) {
    console.log('ℹ️  Ya estaba aplicado');
    return;
  }

  if (!sm.includes(OLD_END_OF_REGLA_CERO_MARKER)) {
    console.error('❌ No encontre el marker de fin de REGLA CERO. Revisar manual.');
    process.exit(2);
  }

  sm = sm.replace(OLD_END_OF_REGLA_CERO_MARKER, NEW_END);
  core.parameters.options.systemMessage = sm;
  console.log('✅ Inyectadas reglas 5 (anti-alucinacion) y 6 (estilo natural WA arg)');
  console.log(`   Tamano: ${sm.length} chars`);

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
