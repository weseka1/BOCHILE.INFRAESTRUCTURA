#!/usr/bin/env node
/**
 * Bug CRITICO: "Buscar Propiedades en Catalogo" (toolWorkflow) tiene
 * value: {} y todos los schema fields marcados removed:true. Resultado:
 * cuando el agente llama al tool, NINGUN parametro se pasa al sub-workflow.
 * Los logs muestran query=null, operation=null, etc. → SubAgente Matcher
 * recibe basura → devuelve "ERROR: query es obligatorio" → Cami responde
 * con info inventada/vacía sin saber que hay 91 deptos en venta.
 *
 * Fix: setear value con $fromAI bindings y poner removed:false en cada field.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

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

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_matcher_tool_fix_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  const tool = wf.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
  if (!tool) throw new Error('No encuentro "Buscar Propiedades en Catalogo"');

  // Setear value con $fromAI para cada parametro
  tool.parameters.workflowInputs.value = {
    query: "={{ $fromAI('query', 'Descripcion natural en espanol: TIPO + UBICACION + AMBIENTES + PRESUPUESTO. Ej: \"casa familiar 3 ambientes en Palihue Bahia Blanca hasta 200000 USD\"', 'string') }}",
    operation: "={{ $fromAI('operation', '\"sale\" para venta o \"rent\" para alquiler. Vacio si no se sabe', 'string') }}",
    property_type: "={{ $fromAI('property_type', 'casa, departamento, ph, duplex, lote, local, oficina, cochera. Vacio si no se sabe', 'string') }}",
    price_max: "={{ $fromAI('price_max', 'Precio maximo como numero entero (200000 no \"200k\"). 0 si no se sabe', 'number') }}",
    price_currency: "={{ $fromAI('price_currency', '\"USD\" o \"ARS\". Default USD para venta', 'string') }}",
    bedrooms_min: "={{ $fromAI('bedrooms_min', 'Numero minimo de ambientes. 0 si no se sabe', 'number') }}",
  };

  // Marcar removed:false en cada field del schema
  for (const f of tool.parameters.workflowInputs.schema || []) {
    f.removed = false;
    if (f.id === 'query') f.required = true; // query es obligatorio
  }

  console.log('✓ Buscar Propiedades en Catalogo: $fromAI bindings + schema activado');

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');

  const act = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  console.log('Activate:', act.status === 200 ? 'OK ACTIVO' : act.body.slice(0,200));
}

main().catch(e => { console.error(e.message); process.exit(1); });
