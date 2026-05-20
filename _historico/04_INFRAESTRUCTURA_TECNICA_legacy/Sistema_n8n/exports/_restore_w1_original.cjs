#!/usr/bin/env node
/**
 * Restaura el W1 al estado del backup pre-RAG. Vuelve al flow que funcionaba
 * la ejecucion 2771 del 15 may. El catalogo en el Sheet ahora esta enriquecido
 * por el LLM, asi que Camila tiene mucho mejor contexto sin tocar el W1.
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
  const backupPath = path.join(__dirname, '_backups', 'W1_pre_RAG_20260516_160215.json');
  const original = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log('Restaurando desde:', backupPath);
  console.log('Nodos en backup:', original.nodes.length);

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (original.settings) for (const k of allowed) if (original.settings[k] !== undefined) settings[k] = original.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({
    name: original.name,
    nodes: original.nodes,
    connections: original.connections,
    settings,
  }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body);
  console.log('OK: W1 restaurado al estado original (pre-RAG)');
  console.log('El Matcher vuelve a usar Google Sheets directo (catalogo enriquecido por LLM)');
}

main().catch(e => { console.error(e.message); process.exit(1); });
