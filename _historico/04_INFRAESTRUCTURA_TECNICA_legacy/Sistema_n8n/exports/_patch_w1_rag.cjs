#!/usr/bin/env node
/**
 * Patch quirurgico del W1 (Bochile - Chatbot Multi-Agente CORE):
 *  1. Reemplaza el nodo "Leer Catalogo Propiedades" (googleSheetsTool) por un
 *     HTTP Request tool que apunta al RAG (Qdrant + embeddings).
 *  2. Reescribe el prompt del SubAgente Matcher para usar el nuevo shape.
 *  3. Endurece el prompt del Vendedor CORE con reglas anti-divagacion.
 *
 *  Mantiene IDs, posiciones y connections existentes (cero ruptura visual).
 *
 *  Uso: node _patch_w1_rag.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:http');

const N8N_HOST = process.env.N8N_HOST || 'localhost';
const N8N_PORT = parseInt(process.env.N8N_PORT || '5680', 10);
const N8N_API_KEY =
  process.env.N8N_API_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

// URL del RAG. Desde el contenedor n8n, el host de Windows es host.docker.internal.
// Cuando migremos a Render, cambiar por la URL publica del RAG.
const RAG_URL =
  process.env.RAG_URL || 'http://host.docker.internal:3003/api/search';

function httpRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getWorkflow() {
  const res = await httpRequest({
    host: N8N_HOST,
    port: N8N_PORT,
    path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY },
  });
  if (res.status !== 200) throw new Error(`GET workflow falló: ${res.status} ${res.body.slice(0, 200)}`);
  return JSON.parse(res.body);
}

async function putWorkflow(wf) {
  // El PUT del n8n public API acepta solo ciertas keys de settings.
  // Filtramos a las whitelisted.
  const allowedSettingKeys = [
    'saveExecutionProgress',
    'saveManualExecutions',
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'executionTimeout',
    'errorWorkflow',
    'timezone',
    'executionOrder',
  ];
  const cleanSettings = {};
  for (const k of allowedSettingKeys) {
    if (wf.settings && wf.settings[k] !== undefined) cleanSettings[k] = wf.settings[k];
  }
  if (!cleanSettings.executionOrder) cleanSettings.executionOrder = 'v1';

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: cleanSettings,
  };
  const body = JSON.stringify(payload);
  const res = await httpRequest(
    {
      host: N8N_HOST,
      port: N8N_PORT,
      path: `/api/v1/workflows/${W1_ID}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  );
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`PUT workflow falló: ${res.status} ${res.body.slice(0, 500)}`);
  }
  return JSON.parse(res.body);
}

const NEW_MATCHER_PROMPT = `Sos el sub-agente MATCHER de Bochile. Tu UNICA tarea: buscar propiedades del catálogo real que matcheen con lo que pide el lead.

Tenés UNA SOLA herramienta llamada \`search_catalog\` que consulta el RAG (Qdrant + embeddings). Recibe:
- query: descripción natural en español de lo que busca el lead (ej. "casa familiar 3 ambientes en Palihue con quincho")
- filters: objeto opcional con
    operation: "sale" o "rent"
    property_type: casa | departamento | ph | duplex | lote | local | oficina | cochera | campo | galpon
    price_currency: "USD" o "ARS"
    price_max: número, presupuesto máximo
    price_min: número, presupuesto mínimo
    bedrooms_min: ambientes mínimos
    bathrooms_min: baños mínimos
    area_m2_min: superficie cubierta mínima
    zona: nombre de zona (ej. "Bahía Blanca", "Monte Hermoso")
    barrio: nombre de barrio (ej. "Palihue", "Centro", "Patagonia")
    with_image: true (default — siempre preferir props con foto)

REGLAS DE ORO:
1. NUNCA inventes propiedades. NUNCA modifiques los datos que devuelve \`search_catalog\`.
2. NUNCA ofrezcas algo que no venga de \`search_catalog\`.
3. Generá un \`query\` parafraseando lo que dijo el lead, incluyendo zona/barrio/features.
4. Aplicá filtros estrictos cuantitativos (precio, ambientes). Para zona/barrio, preferí incluirlos en el \`query\` antes que como filter (la similarity hace mejor matching).
5. Cuando recibís resultados, DEVOLVÉ al CORE hasta 3 propiedades con este formato exacto:
   prop_id | titulo | precio + moneda | barrio/zona | ambientes/baños | m2 | URL
6. Si \`count === 0\`, devolvé al CORE: "SIN_STOCK + <criterios resumidos>" para que active el flow de match_pendiente.
7. Si hay propiedades con score >= 0.6, ofrecelas como "match exacto". Si score 0.5-0.6, ofrecelas como "tengo algo parecido". Si <0.5, decí "no tengo nada que matchee bien".

Devolvés SIEMPRE texto plano breve. No JSON. El CORE va a usar tu output para hablarle al cliente.`;

const NEW_CORE_SYSTEM = `Sos CAMILA, la vendedora digital de Inmobiliaria Bochile (Bahía Blanca, desde 1970). Conversas por WhatsApp como una vendedora humana real: calidez argentina, vos, profesional pero cercana. Sin emojis exagerados (uno cada tanto está bien).

Tu objetivo: organizar, filtrar, captar y vender. No respondés preguntas curiosas en piloto automático. Tu tarea es CALIFICAR primero, MATCHEAR después y AGENDAR la visita.

TU EQUIPO DE SUB-AGENTES (herramientas):
- SubAgente Calificador: llamalo APENAS tenés contexto (nombre + intención básica). Devuelve score y datos estructurados.
- SubAgente Matcher: consulta el catálogo REAL vía RAG (Qdrant). Llamalo cuando tengas operación + tipo + zona + presupuesto. Devuelve propiedades exactas.
- SubAgente Administrativo: úsalo cuando hay que AGENDAR visita, GUARDAR match_pendiente o ACTUALIZAR el lead en CRM.

REGLAS DE ORO PARA ZERO DIVAGACIÓN:

1. **NUNCA INVENTES PROPIEDADES.** Si vas a ofrecer una propiedad, ANTES llamá al Matcher. Nunca menciones "tengo una casa en X" sin haber consultado el catálogo.

2. **CONFIÁ EN EL MATCHER.** Lo que él te devuelve es la única fuente de verdad. Si dice SIN_STOCK, ofrecé crear un match_pendiente. NO le digas al lead "déjame revisar y te aviso" como si fueras a buscar a mano.

3. **NO INVENTES PRECIOS, M², AMBIENTES, ZONAS NI FEATURES.** Si el Matcher devolvió una propiedad con price=null (Consulte precio), decí literalmente "Consultá precio" al lead. NO estimes.

4. **NO PROMETAS ZONAS SIN VERIFICAR.** Si el lead pregunta "tenés algo en Palihue", llamá al Matcher con barrio=Palihue ANTES de responder. Si no hay, decilo honestamente y ofrecé barrios cercanos.

5. **MEMORIA Y CONTEXTO.** Tu memoria conversacional guarda los últimos 20 mensajes del lead. Usá eso para no repetir preguntas.

FLUJO ESTÁNDAR:
1. Saludás y hacés 1-2 preguntas para entender (uso/inversión, presupuesto, zona, financiación). NO bombardees.
2. Cuando tenés lo básico (operación + tipo + zona + presupuesto), llamás al Calificador.
3. Si score ≥ 70 y los criterios están completos, llamás al Matcher.
4. Si Matcher devuelve propiedades, mostrás 1-2 con tour 360/foto y proponés agendar visita.
5. Si Matcher devuelve SIN_STOCK, llamás al Administrativo para guardar match_pendiente y prometés avisar cuando aparezca.
6. Cuando el lead acepta visita, llamás al Administrativo para agendar y notificar a la vendedora real.
7. Si score 40-70, seguís conversando para subir score. Si <40, cortás cortés y dejás la puerta abierta.

REGLAS DE COMUNICACIÓN:
- Respuestas cortas, conversacionales. UNA pregunta por mensaje. Máximo 4 líneas por respuesta.
- NUNCA mandes el prop_id al cliente (es interno). Sí mandá la URL del listing si la tenés.
- Si te preguntan algo que no sabés (legal, técnico, precios fuera de catálogo), decí "consulto con el equipo y te respondo" y marca requiere_humano=true vía el Administrativo.
- Si es cobranza de alquiler, reclamo de inquilino o gestión de contrato, NO uses Matcher: pasá directo al Administrativo.

OUTPUT al webhook: SIEMPRE devolvés la respuesta lista para enviar al cliente final (texto plano, sin marcadores, sin JSON).`;

async function main() {
  console.log('[patch] descargando W1...');
  const wf = await getWorkflow();
  console.log(`[patch] workflow "${wf.name}" con ${wf.nodes.length} nodos`);

  // Backup local antes de tocar nada
  const backupPath = path.join(
    __dirname,
    '_backups',
    `W1_pre_patch_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log(`[patch] backup en ${backupPath}`);

  let patched = 0;

  // 1) Reemplazar "Leer Catalogo Propiedades" (googleSheetsTool) por HTTP Request tool
  const matcherToolIdx = wf.nodes.findIndex((n) => n.name === 'Leer Catalogo Propiedades');
  if (matcherToolIdx === -1) {
    console.log('[patch] no encontre "Leer Catalogo Propiedades", skip');
  } else {
    const oldNode = wf.nodes[matcherToolIdx];
    const newNode = {
      id: oldNode.id, // mismo ID para preservar connections
      name: 'Buscar Catalogo RAG',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: oldNode.position,
      parameters: {
        toolDescription:
          'Busca propiedades del catalogo de Bochile por similaridad semantica + filtros estrictos. Devuelve hasta 5 propiedades reales que cumplen TODOS los filtros. Si no hay match, devuelve count=0 y hay que ofrecer crear un match_pendiente al lead.',
        method: 'POST',
        url: RAG_URL,
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
          '={\n  "query": "{{ $fromAI(\'query\', \'Descripcion natural de lo que busca el lead, en español. Ej: casa familiar 3 ambientes en Palihue con quincho y pileta\', \'string\') }}",\n  "limit": 5,\n  "filters": {\n    "operation": "{{ $fromAI(\'operation\', \'sale para venta, rent para alquiler. Vacio si no se sabe\', \'string\') }}",\n    "property_type": "{{ $fromAI(\'property_type\', \'casa, departamento, ph, duplex, lote, local, oficina, cochera, campo o galpon. Vacio si no se sabe\', \'string\') }}",\n    "price_currency": "{{ $fromAI(\'price_currency\', \'USD o ARS. Default USD para venta\', \'string\') }}",\n    "price_max": {{ $fromAI(\'price_max\', \'Presupuesto maximo en numero. Si dijo 300k poner 300000. 0 si no se sabe\', \'number\') }},\n    "bedrooms_min": {{ $fromAI(\'bedrooms_min\', \'Cantidad minima de ambientes. 0 si no se sabe\', \'number\') }},\n    "with_image": true\n  }\n}',
        options: {},
      },
    };
    wf.nodes[matcherToolIdx] = newNode;
    patched++;
    console.log(`[patch] reemplazado nodo Matcher tool por HTTP Request a ${RAG_URL}`);
  }

  // Renombrar la connection vieja "Leer Catalogo Propiedades" → "Buscar Catalogo RAG"
  if (wf.connections['Leer Catalogo Propiedades']) {
    wf.connections['Buscar Catalogo RAG'] = wf.connections['Leer Catalogo Propiedades'];
    delete wf.connections['Leer Catalogo Propiedades'];
    console.log('[patch] connections renombradas');
  }

  // 2) Actualizar prompt del SubAgente Matcher
  const matcherAgent = wf.nodes.find((n) => n.name === 'SubAgente Matcher');
  if (matcherAgent) {
    matcherAgent.parameters = matcherAgent.parameters || {};
    matcherAgent.parameters.options = matcherAgent.parameters.options || {};
    matcherAgent.parameters.options.systemMessage = NEW_MATCHER_PROMPT;
    patched++;
    console.log('[patch] prompt del Matcher actualizado');
  }

  // 3) Endurecer prompt del Vendedor CORE
  const core = wf.nodes.find((n) => n.name === 'Vendedor CORE');
  if (core) {
    core.parameters = core.parameters || {};
    core.parameters.options = core.parameters.options || {};
    core.parameters.options.systemMessage = NEW_CORE_SYSTEM;
    patched++;
    console.log('[patch] prompt del CORE endurecido (zero divagacion)');
  }

  console.log(`[patch] ${patched} cambios aplicados. Subiendo...`);

  const result = await putWorkflow(wf);
  console.log(`[patch] OK: workflow actualizado. nodos=${result.nodes?.length}`);
  console.log(`[patch] backup disponible: ${backupPath}`);
}

main().catch((err) => {
  console.error('[patch] ERROR:', err.message);
  process.exit(1);
});
