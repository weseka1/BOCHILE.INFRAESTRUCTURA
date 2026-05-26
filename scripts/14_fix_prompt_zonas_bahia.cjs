// Agrega al systemMessage del Vendedor CORE:
// 1. Zonificación real de Bahia Blanca (Centro abarca Plaza Rivadavia, Microcentro, etc.)
// 2. Regla absoluta: si Matcher devuelve propiedades, MOSTRARLAS (no decir "no tengo")
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

const ZONAS_BLOCK = `
================================================================
ZONIFICACION DE BAHIA BLANCA (CRITICO - leelo bien)
================================================================
Bahia Blanca tiene barrios bien definidos. NO te confundas:

CENTRO / MICROCENTRO (lo mismo, todo abarca lo siguiente):
- Plaza Rivadavia y alrededor
- Calles principales: Alem, San Martin, Estomba, Soler, O'Higgins, Mitre, Belgrano, 12 de Octubre, Italia, Zelarrayan, Donado, Tucuman, Brown, Lavalle
- Tambien: Microcentro, Zona Centro, casco historico

UNIVERSITARIO: zona de la UNS, alrededor de 12 de Octubre y Alem
PALIHUE: zona residencial alta al sur
VILLA MITRE / VILLA BELGRANO: barrios residenciales
PARQUE NORTE: norte de la ciudad
PATAGONIA: zona alejada

REGLA: Si el cliente pide "centro", incluye TODAS las propiedades en las calles del centro listadas arriba, sin importar que el campo "barrio" diga "unknown" o "Microcentro" o "Centro". TODAS son centro.

================================================================
REGLA ABSOLUTA: NO DECIR "NO TENGO" SI EL MATCHER DEVOLVIO PROPIEDADES
================================================================
Cuando el sub-agente Matcher te devuelva propiedades (incluso 1 sola), DEBES mostrarlas al cliente. NUNCA digas "no tengo nada" si Matcher devolvio algo.

MAL: "En el centro no tengo nada hasta 90 mil"
BIEN: "Mira, en el centro tengo varias opciones que entran en tu presupuesto. Te tiro las mejores: [propiedad 1, propiedad 2]"

Si Matcher devuelve 0 (SIN_STOCK), recien ahi podes decir que no tenes. Pero JAMAS sin antes haber llamado al Matcher.

REGLA EXTRA: ignora propiedades cuyo titulo mencione otra ciudad (La Plata, Buenos Aires, etc.). Bochile es solo Bahia Blanca y alrededores.
`;

(async () => {
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  const w1 = wfs.find(w => w.name.includes('CORE'));
  const full = JSON.parse((await req('GET', '/api/v1/workflows/' + w1.id)).b);
  const core = full.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;

  const MARK = '## ZONIFICACION DE BAHIA BLANCA';
  if (!sm.includes(MARK)) {
    sm = sm + '\n\n' + ZONAS_BLOCK;
    core.parameters.options.systemMessage = sm;
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';

  const upd = await req('PUT', '/api/v1/workflows/' + w1.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
  const re = await req('POST', '/api/v1/workflows/' + w1.id + '/activate');
  console.log('PUT/activate:', upd.s + '/' + re.s);
  console.log('systemMessage length:', sm.length);
})();
