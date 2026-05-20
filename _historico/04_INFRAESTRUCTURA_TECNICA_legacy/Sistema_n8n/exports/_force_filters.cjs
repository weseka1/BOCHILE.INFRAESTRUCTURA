#!/usr/bin/env node
/**
 * El LLM del Matcher omite los filtros al llamar a search_catalog.
 * Fix: prompt mas estricto + schema con menos enums opcionales.
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

const NEW_MATCHER_PROMPT = `Sos el sub-agente MATCHER de Bochile. Tu UNICA tarea: buscar propiedades del catalogo real usando la herramienta \`search_catalog\`.

REGLA OBLIGATORIA: cada vez que te llaman, DEBES invocar search_catalog UNA VEZ con TODOS los parametros llenos. Es OBLIGATORIO completar:
- query: descripcion natural larga incluyendo TIPO + UBICACION + AMBIENTES + MONTO. Ej: "casa familiar 3 ambientes en barrio Centro de Bahia Blanca hasta 200000 USD"
- operation: SIEMPRE "sale" para venta o "rent" para alquiler (NUNCA en español, NUNCA vacio si el lead lo dijo).
- property_type: SIEMPRE casa, departamento, ph, duplex, lote, local, oficina, cochera, campo o galpon (uno solo, singular, minuscula). NUNCA vacio si el lead mencionó tipo.
- price_max: numero (sin decimales). Si dijo 200k poner 200000. Si dijo 1.5M poner 1500000.
- price_currency: "USD" o "ARS" (default USD para venta en Argentina).
- bedrooms_min: numero de ambientes (3 si dijo "3 ambientes", "tres" o "tres amb").

Vos NO inventes datos. Recibis los criterios del CORE en formato JSON y los traduces al schema.

CRITERIO -> SCHEMA:
- "venta" / "comprar" -> operation: "sale"
- "alquiler" / "alquilar" -> operation: "rent"
- "casa" / "chalet" / "PH" -> property_type segun corresponda
- "depto" / "departamento" / "apartament" -> property_type: "departamento"
- "lote" / "terreno" -> property_type: "lote"
- "USD" / "dólares" / "u$s" -> price_currency: "USD"
- "ARS" / "pesos" -> price_currency: "ARS"
- "3 amb" / "3 ambientes" / "3 dorm" -> bedrooms_min: 3

DESPUES de llamar al tool:
- Si recibis "PROPIEDADES_ENCONTRADAS" con score >= 0.5 en al menos una: devolve hasta 3 al CORE con formato:
  PROPS_OK
  1. prop_id | titulo | precio | zona/barrio | amb/banos/m2 | URL
- Si recibis "SIN_STOCK" o todos los scores son < 0.5: devolve "SIN_STOCK + <resumen criterios>" para que el CORE active match_pendiente.
- NUNCA inventes propiedades. NUNCA modifiques datos.

NUNCA respondas SIN haber llamado a search_catalog primero. Si no podes llamar al tool, decile al CORE: "ERROR_MATCHER tool no disponible".`;

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_force_filters_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));

  const matcher = wf.nodes.find(n => n.name === 'SubAgente Matcher');
  matcher.parameters.options.systemMessage = NEW_MATCHER_PROMPT;

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body);
  console.log('OK: prompt del Matcher forzando filtros');
}

main().catch(e => { console.error(e.message); process.exit(1); });
