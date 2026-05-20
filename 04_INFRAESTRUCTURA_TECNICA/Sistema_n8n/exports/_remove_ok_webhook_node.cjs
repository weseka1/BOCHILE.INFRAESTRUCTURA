#!/usr/bin/env node
/**
 * El cambio de Webhook a responseMode=onReceived hace que el nodo
 * "OK al Webhook" (respondToWebhook) quede huerfano y n8n rechaza
 * ejecutar el workflow con: "Unused Respond to Webhook node found".
 *
 * Solucion: borrar el nodo y todas las conexiones que llegan a el.
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
    `W1_pre_remove_okwebhook_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  const targetName = 'OK al Webhook';
  const before = wf.nodes.length;
  wf.nodes = wf.nodes.filter(n => n.name !== targetName);
  console.log(`✓ Nodos eliminados: ${before - wf.nodes.length} (${targetName})`);

  // Limpiar conexiones que apuntan al nodo borrado
  let removedConns = 0;
  for (const [src, branches] of Object.entries(wf.connections || {})) {
    for (const [outType, outArr] of Object.entries(branches)) {
      for (let i = 0; i < outArr.length; i++) {
        const filtered = outArr[i].filter(c => {
          if (c.node === targetName) { removedConns++; return false; }
          return true;
        });
        outArr[i] = filtered;
      }
    }
  }
  // Eliminar source orfana
  if (wf.connections[targetName]) {
    delete wf.connections[targetName];
    console.log(`  Tambien borrada source orfana ${targetName}`);
  }
  console.log(`✓ Conexiones que apuntaban a ${targetName} eliminadas: ${removedConns}`);

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');

  // Reactivar
  const act = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  console.log('Activate:', act.status === 200 ? 'OK ACTIVO' : act.body.slice(0,200));
}

main().catch(e => { console.error(e.message); process.exit(1); });
