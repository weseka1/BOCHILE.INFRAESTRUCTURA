#!/usr/bin/env node
/**
 * Fix: el tool "Buscar Catalogo RAG" estaba conectado al Vendedor CORE,
 * pero debe estar conectado al SubAgente Matcher (que es quien lo usa).
 *
 * Solo arregla la connection, no toca nada mas.
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
    `W1_pre_fix_connection_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // Fix: la connection actual va al Vendedor CORE, debe ir al SubAgente Matcher
  const old = wf.connections['Buscar Catalogo RAG'];
  console.log('Connection ANTES:', JSON.stringify(old));

  wf.connections['Buscar Catalogo RAG'] = {
    ai_tool: [
      [
        {
          node: 'SubAgente Matcher',
          type: 'ai_tool',
          index: 0,
        },
      ],
    ],
  };
  console.log('Connection DESPUES:', JSON.stringify(wf.connections['Buscar Catalogo RAG']));

  const allowed = [
    'saveExecutionProgress',
    'saveManualExecutions',
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'executionTimeout',
    'errorWorkflow',
    'timezone',
    'executionOrder',
  ];
  const cleanSettings = { executionOrder: 'v1' };
  if (wf.settings) {
    for (const k of allowed) {
      if (wf.settings[k] !== undefined) cleanSettings[k] = wf.settings[k];
    }
  }

  const put = await req(
    {
      host: 'localhost',
      port: 5680,
      path: `/api/v1/workflows/${W1_ID}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: cleanSettings,
    }),
  );
  if (put.status < 200 || put.status >= 300) throw new Error('PUT fail: ' + put.body);
  console.log('OK: connection fix aplicado');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
