#!/usr/bin/env node
/**
 * Crea un sub-workflow "Bochile RAG Search" que:
 *  1. Recibe params via Execute Workflow Trigger (query, operation, ...)
 *  2. Hace HTTP POST al RAG (Qdrant + filtros estrictos)
 *  3. Formatea respuesta para el LLM
 *  4. Devuelve al caller
 *
 * Este sub-workflow se usa desde el W1 SubAgente Matcher via un toolWorkflow.
 */
const http = require('node:http');
const crypto = require('node:crypto');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

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

const FORMAT_CODE = `// Recibe del trigger: { query, operation, property_type, price_max, price_currency, bedrooms_min }
// Hace POST al RAG y devuelve string formateado al caller.

const RAG_URL = 'http://host.docker.internal:3003/api/search';
const inp = $input.first().json || {};
const q = String(inp.query || '').trim();
if (!q) return [{ json: { result: 'ERROR: query es obligatorio' } }];

// Mapear español a enum
const opMap = { venta:'sale', vender:'sale', vende:'sale', comprar:'sale', sale:'sale',
  alquiler:'rent', alquilar:'rent', alquila:'rent', renta:'rent', rent:'rent' };
const ptMap = { depto:'departamento', dept:'departamento', terreno:'lote',
  deposito:'galpon', 'depósito':'galpon', chacra:'campo', estancia:'campo',
  garage:'cochera' };

const filters = { with_image: true };
const op = (opMap[String(inp.operation || '').toLowerCase()] || inp.operation || '').toString();
if (op === 'sale' || op === 'rent') filters.operation = op;
const pt = (ptMap[String(inp.property_type || '').toLowerCase()] || inp.property_type || '').toString();
if (pt) filters.property_type = pt;
const pc = String(inp.price_currency || '').toUpperCase();
if (pc === 'USD' || pc === 'ARS') filters.price_currency = pc;
if (Number(inp.price_max) > 0) filters.price_max = Number(inp.price_max);
if (Number(inp.bedrooms_min) > 0) filters.bedrooms_min = Number(inp.bedrooms_min);

const body = { query: q, limit: 5, filters };

let data;
try {
  data = await this.helpers.httpRequest({
    method: 'POST',
    url: RAG_URL,
    headers: { 'Content-Type': 'application/json' },
    body,
    json: true,
  });
} catch (err) {
  return [{ json: { result: 'ERROR_RAG: ' + (err.message || err).slice(0, 200) } }];
}

if (!data || !data.items || data.items.length === 0) {
  return [{ json: { result: 'SIN_STOCK | criterios: ' + JSON.stringify(filters) } }];
}

const lines = data.items.map(function(p, i) {
  const precio = p.price ? p.price + ' ' + (p.price_currency || '') : (p.price_text || 'Consultar');
  const ubic = (p.barrio && p.barrio !== 'unknown') ? p.barrio : (p.zona || 'Bahia Blanca');
  return (i+1) + '. [' + p.prop_id + '] ' + p.title
    + ' | ' + (p.property_type || '?')
    + ' | ' + ubic
    + ' | ' + (p.bedrooms ? p.bedrooms + ' amb' : 'amb ?')
    + ' | ' + (p.area_m2 ? p.area_m2 + ' m2' : 'm2 ?')
    + ' | ' + precio
    + ' | URL: ' + p.url
    + ' | score: ' + p.score;
});

return [{ json: { result: 'FILTERS_USED: ' + JSON.stringify(filters) + '\\nPROPIEDADES_ENCONTRADAS (' + data.items.length + '):\\n' + lines.join('\\n') } }];`;

const subWorkflow = {
  name: 'Bochile RAG Search (sub-workflow para Matcher)',
  nodes: [
    {
      id: crypto.randomUUID(),
      name: 'When Executed by Another Workflow',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [240, 300],
      parameters: {
        inputSource: 'jsonExample',
        jsonExample: JSON.stringify({
          query: 'casa familiar 3 ambientes en Palihue Bahia Blanca hasta 200000 USD',
          operation: 'sale',
          property_type: 'casa',
          price_max: 200000,
          price_currency: 'USD',
          bedrooms_min: 3,
        }, null, 2),
      },
    },
    {
      id: crypto.randomUUID(),
      name: 'Call RAG and Format',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [520, 300],
      parameters: {
        language: 'javaScript',
        jsCode: FORMAT_CODE,
      },
    },
  ],
  connections: {
    'When Executed by Another Workflow': {
      main: [[{ node: 'Call RAG and Format', type: 'main', index: 0 }]],
    },
  },
  settings: { executionOrder: 'v1' },
};

async function main() {
  // Crear el sub-workflow via POST
  const post = await req({
    host: 'localhost', port: 5680, path: '/api/v1/workflows',
    method: 'POST', headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify(subWorkflow));
  if (post.status >= 300) throw new Error('POST: ' + post.body);
  const created = JSON.parse(post.body);
  console.log('Sub-workflow creado: id=' + created.id + ' name="' + created.name + '"');
  console.log('IMPORTANTE: activalo manualmente en n8n UI o via API');
  console.log('');
  console.log('Usar este ID en el toolWorkflow del Matcher:', created.id);

  // Activar via PATCH /workflows/:id/activate (si esta API lo soporta)
  const activate = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${created.id}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  console.log('Activate status:', activate.status, activate.body.slice(0, 100));
}

main().catch(e => { console.error(e.message); process.exit(1); });
