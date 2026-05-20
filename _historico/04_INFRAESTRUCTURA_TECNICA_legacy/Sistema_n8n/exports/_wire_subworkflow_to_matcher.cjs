#!/usr/bin/env node
/**
 * Conecta el sub-workflow "Bochile RAG Search" al W1 SubAgente Matcher
 * via un nodo toolWorkflow. Reemplaza el "Leer Catalogo Propiedades" (Google
 * Sheets tool) por este toolWorkflow.
 *
 * Tambien actualiza el prompt del Matcher para usar el nuevo formato.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';
const SUB_WF_ID = '6Dk2umeJDNViv9yb';

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

const NEW_MATCHER_PROMPT = `Sos el sub-agente MATCHER de Bochile. Tu UNICA tarea: buscar propiedades del catalogo real usando la herramienta \`search_catalog\`.

REGLA: cada vez que te llamen, invocas search_catalog UNA VEZ con TODOS los parametros que puedas extraer del lead:
- query: descripcion natural en español completa (ej. "casa familiar 3 ambientes en barrio Centro Bahia Blanca hasta 200000 USD")
- operation: "sale" para venta, "rent" para alquiler
- property_type: casa, departamento, ph, duplex, lote, local, oficina, cochera, campo, galpon
- price_max: numero entero (300000, no "300k")
- price_currency: "USD" o "ARS"
- bedrooms_min: numero entero (3 si dijo "3 ambientes")

DESPUES de recibir resultado:
- Si dice "PROPIEDADES_ENCONTRADAS": devolve al CORE las 3 mejores con formato:
  PROP_1: prop_id | titulo | precio + moneda | barrio/zona | ambientes | m2 | URL
  PROP_2: ...
- Si dice "SIN_STOCK": devolve "SIN_STOCK + <criterios>" al CORE para que active match_pendiente.
- NUNCA inventes propiedades. NUNCA modifiques datos. NUNCA respondas sin haber llamado a search_catalog.`;

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  // Backup
  const bk = path.join(__dirname, '_backups',
    `W1_pre_wiretoolwf_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // Reemplazar nodo Leer Catalogo Propiedades por toolWorkflow
  const idx = wf.nodes.findIndex(n => n.name === 'Leer Catalogo Propiedades');
  if (idx === -1) throw new Error('No esta Leer Catalogo Propiedades');
  const old = wf.nodes[idx];

  wf.nodes[idx] = {
    id: old.id,
    name: 'Buscar Propiedades en Catalogo',
    type: '@n8n/n8n-nodes-langchain.toolWorkflow',
    typeVersion: 2.2,
    position: old.position,
    parameters: {
      name: 'search_catalog',
      description: 'Busca propiedades en el catalogo real de Bochile (Qdrant + filtros estrictos). Devuelve hasta 5 propiedades que cumplen TODOS los filtros, o SIN_STOCK. NUNCA inventa.',
      workflowId: { __rl: true, value: SUB_WF_ID, mode: 'id' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          query: "={{ $fromAI('query', 'Descripcion natural en español de lo que busca el lead, ej: casa familiar 3 ambientes en Palihue con quincho hasta 300 mil USD', 'string') }}",
          operation: "={{ $fromAI('operation', 'sale o rent. sale para venta, rent para alquiler. Vacio si no se sabe', 'string') }}",
          property_type: "={{ $fromAI('property_type', 'casa, departamento, ph, duplex, lote, local, oficina, cochera, campo o galpon. Vacio si no se sabe', 'string') }}",
          price_max: "={{ $fromAI('price_max', 'Presupuesto maximo numero entero. Si dijo 300k poner 300000', 'number') }}",
          price_currency: "={{ $fromAI('price_currency', 'USD o ARS. Default USD para venta', 'string') }}",
          bedrooms_min: "={{ $fromAI('bedrooms_min', 'Cantidad minima de ambientes', 'number') }}",
        },
        schema: [
          { id: 'query', displayName: 'query', required: true, type: 'string' },
          { id: 'operation', displayName: 'operation', required: false, type: 'string' },
          { id: 'property_type', displayName: 'property_type', required: false, type: 'string' },
          { id: 'price_max', displayName: 'price_max', required: false, type: 'number' },
          { id: 'price_currency', displayName: 'price_currency', required: false, type: 'string' },
          { id: 'bedrooms_min', displayName: 'bedrooms_min', required: false, type: 'number' },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
    },
  };

  // Renombrar connection key
  if (wf.connections['Leer Catalogo Propiedades']) {
    wf.connections['Buscar Propiedades en Catalogo'] = wf.connections['Leer Catalogo Propiedades'];
    delete wf.connections['Leer Catalogo Propiedades'];
  }

  // Asegurar que el tool está conectado al SubAgente Matcher (no al CORE)
  wf.connections['Buscar Propiedades en Catalogo'] = {
    ai_tool: [[{ node: 'SubAgente Matcher', type: 'ai_tool', index: 0 }]],
  };

  // Update prompt del Matcher
  const matcher = wf.nodes.find(n => n.name === 'SubAgente Matcher');
  if (matcher) {
    matcher.parameters = matcher.parameters || {};
    matcher.parameters.options = matcher.parameters.options || {};
    matcher.parameters.options.systemMessage = NEW_MATCHER_PROMPT;
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body);
  console.log('OK: toolWorkflow conectado al SubAgente Matcher');
}

main().catch(e => { console.error(e.message); process.exit(1); });
