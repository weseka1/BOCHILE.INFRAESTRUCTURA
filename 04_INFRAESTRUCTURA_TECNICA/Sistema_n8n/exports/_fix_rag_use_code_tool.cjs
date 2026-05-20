#!/usr/bin/env node
/**
 * Fix #2: el nodo toolHttpRequest no funciona dentro de un agentTool (sub-agent).
 * El error es: "has supplyData method but no execute method".
 *
 * Solución: reemplazar por un toolCode que internamente hace fetch al RAG.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';
const RAG_URL =
  process.env.RAG_URL || 'http://host.docker.internal:3003/api/search';

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, (resp) => {
      let d = '';
      resp.on('data', (c) => (d += c));
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

const RAG_TOOL_CODE = `// Tool: busca propiedades en el RAG.
// Recibe SOLO un query natural en español del LLM y extrae los filtros con regex.

const RAG_URL = '${RAG_URL}';

// DEBUG: devolver toda la info disponible para entender shape de inputs
const debug = {
  typeofQuery: typeof query,
  queryValue: (typeof query !== 'undefined') ? query : 'undefined',
  hasJson: typeof $json !== 'undefined',
  jsonValue: (typeof $json !== 'undefined') ? $json : 'undefined',
  hasInput: typeof $input !== 'undefined',
  inputKeys: (typeof $input !== 'undefined' && $input.first) ? Object.keys($input.first().json || {}) : [],
  inputJson: (typeof $input !== 'undefined' && $input.first) ? $input.first().json : 'no $input',
};
return 'DEBUG_TOOLCODE: ' + JSON.stringify(debug);

let _q = '';
if (!_q) return 'ERROR: query es obligatorio';

const qLower = _q.toLowerCase();

// === Parser natural de filtros desde el query ===
const filters = { with_image: true };

// Operation
if (/\\b(venta|vender|vende|comprar|compra)\\b/.test(qLower)) filters.operation = 'sale';
else if (/\\b(alquiler|alquilar|alquila|renta|rentar)\\b/.test(qLower)) filters.operation = 'rent';

// Property type (orden importa: galpon antes que generic)
if (/\\b(casa|chalet)\\b/.test(qLower)) filters.property_type = 'casa';
else if (/\\b(depto|departamento|apartament)\\b/.test(qLower)) filters.property_type = 'departamento';
else if (/\\bph\\b/.test(qLower)) filters.property_type = 'ph';
else if (/\\bd[uú]plex\\b/.test(qLower)) filters.property_type = 'duplex';
else if (/\\b(galp[oó]n|dep[oó]sito|industrial)\\b/.test(qLower)) filters.property_type = 'galpon';
else if (/\\b(lote|terreno|parcela|fracci[oó]n)\\b/.test(qLower)) filters.property_type = 'lote';
else if (/\\b(local|comercio|negocio)\\b/.test(qLower)) filters.property_type = 'local';
else if (/\\boficina\\b/.test(qLower)) filters.property_type = 'oficina';
else if (/\\b(cochera|garage)\\b/.test(qLower)) filters.property_type = 'cochera';
else if (/\\b(campo|estancia|chacra|hect[áa]reas?)\\b/.test(qLower)) filters.property_type = 'campo';

// Precio: matches como "200000 USD", "200 mil USD", "200k USD", "USD 200000", "1.5M"
const priceRe1 = /(\\d+(?:[.,]\\d+)?)\\s*(?:mil|k)\\s*(usd|dolares|d[oó]lares|u\\$s)/i;
const priceRe2 = /(\\d+(?:[.,]\\d+)?)\\s*(?:millon|m)\\s*(usd|dolares|d[oó]lares)/i;
const priceRe3 = /(\\d{4,9})\\s*(usd|dolares|d[oó]lares|u\\$s)/i;
const priceReArs = /(\\d{4,12})\\s*(ars|pesos|peso\\b)/i;
const priceReUsdPrefix = /(usd|u\\$s|d[oó]lares?)\\s*\\$?\\s*(\\d{4,9})/i;
let m;
if ((m = qLower.match(priceRe1))) {
  filters.price_max = parseInt(m[1].replace(/[.,]/g, ''), 10) * 1000;
  filters.price_currency = 'USD';
} else if ((m = qLower.match(priceRe2))) {
  filters.price_max = Math.round(parseFloat(m[1].replace(',', '.')) * 1000000);
  filters.price_currency = 'USD';
} else if ((m = qLower.match(priceRe3))) {
  filters.price_max = parseInt(m[1], 10);
  filters.price_currency = 'USD';
} else if ((m = qLower.match(priceReUsdPrefix))) {
  filters.price_max = parseInt(m[2], 10);
  filters.price_currency = 'USD';
} else if ((m = qLower.match(priceReArs))) {
  filters.price_max = parseInt(m[1], 10);
  filters.price_currency = 'ARS';
}

// Ambientes / dormitorios
const ambRe = /(\\d+)\\s*(amb|ambiente|dorm|dormitorio|cuarto)/i;
if ((m = qLower.match(ambRe))) filters.bedrooms_min = parseInt(m[1], 10);
else if (/monoambient/i.test(qLower)) filters.bedrooms_min = 1;

const input = { query: _q, limit: 5, filters };

// n8n toolCode no expone fetch; usamos this.helpers.httpRequest (API nativa de n8n)
let data;
try {
  data = await this.helpers.httpRequest({
    method: 'POST',
    url: RAG_URL,
    headers: { 'Content-Type': 'application/json' },
    body: input,
    json: true,
  });
} catch (err) {
  return 'ERROR_RAG: ' + (err.message || String(err)).slice(0, 200);
}

if (!data || !data.items || data.items.length === 0) {
  return 'SIN_STOCK | criterios: ' + JSON.stringify(input.filters);
}

// Debug: incluir el query recibido y los filtros aplicados
const debug = 'QUERY_RECIBIDO: "' + _q + '"\\nFILTERS_USED: ' + JSON.stringify(input.filters) + '\\n';

const lines = data.items.map(function(p, i) {
  const precio = p.price ? p.price + ' ' + (p.price_currency || '') : (p.price_text || 'Consultar');
  const ubic = (p.barrio && p.barrio !== 'unknown') ? p.barrio : (p.zona || 'Bahia Blanca');
  return (i+1) + '. [' + p.prop_id + '] ' + p.title
    + ' | tipo: ' + (p.property_type || '?')
    + ' | zona: ' + ubic
    + ' | ' + (p.bedrooms ? p.bedrooms + ' amb' : 'amb sin dato')
    + ' | ' + (p.area_m2 ? p.area_m2 + ' m2' : 'm2 sin dato')
    + ' | precio: ' + precio
    + ' | URL: ' + p.url
    + ' | score: ' + p.score;
});

return debug + 'PROPIEDADES_ENCONTRADAS (' + data.items.length + '):\\n' + lines.join('\\n');
`;

async function main() {
  const get = await req({
    host: 'localhost',
    port: 5680,
    path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET',
    headers: { 'X-N8N-API-KEY': API_KEY },
  });
  if (get.status !== 200) throw new Error('GET fail: ' + get.body);
  const wf = JSON.parse(get.body);

  // Backup
  const bk = path.join(
    __dirname,
    '_backups',
    `W1_pre_codetool_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  const idx = wf.nodes.findIndex((n) => n.name === 'Buscar Catalogo RAG');
  if (idx === -1) throw new Error('No se encontró Buscar Catalogo RAG');
  const old = wf.nodes[idx];

  // Reemplazar por toolCode
  wf.nodes[idx] = {
    id: old.id,
    name: 'Buscar Catalogo RAG',
    type: '@n8n/n8n-nodes-langchain.toolCode',
    typeVersion: 1.2,
    position: old.position,
    parameters: {
      name: 'search_catalog',
      description:
        'Busca propiedades del catalogo de Bochile por similaridad semantica + filtros estrictos. Devuelve hasta 5 propiedades reales. Si no hay match, devuelve SIN_STOCK.',
      language: 'javaScript',
      jsCode: RAG_TOOL_CODE,
      specifyInputSchema: true,
      inputSchema: JSON.stringify({
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Descripcion completa en español INCLUYENDO: tipo (casa/depto/lote/...), operacion (venta/alquiler), zona/barrio si lo dijo, ambientes ("3 ambientes"), presupuesto ("hasta 200000 USD" o "hasta 200 mil USD"). Ej: "casa familiar 3 ambientes en Palihue venta hasta 300000 USD con quincho". El sistema parsea estos datos del texto para aplicar filtros estrictos.',
          },
        },
        required: ['query'],
      }),
    },
  };
  console.log('Nodo reemplazado: toolHttpRequest -> toolCode');

  const allowed = [
    'saveExecutionProgress','saveManualExecutions','saveDataErrorExecution',
    'saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'
  ];
  const cleanSettings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) cleanSettings[k] = wf.settings[k];

  const put = await req(
    {
      host: 'localhost',
      port: 5680,
      path: `/api/v1/workflows/${W1_ID}`,
      method: 'PUT',
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: cleanSettings,
    }),
  );
  if (put.status < 200 || put.status >= 300) throw new Error('PUT fail: ' + put.body);
  console.log('OK aplicado');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
