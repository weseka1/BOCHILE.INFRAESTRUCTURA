#!/usr/bin/env node
/**
 * Conecta los 2 nodos respond.io del W1 a la credencial real (ID que devolvió
 * la API al crearla) y reemplaza el placeholder del CHANNEL_ID por el valor
 * concreto (503760).
 *
 * Para el piloto hardcodeamos el channel ID. Cuando migremos a Render lo pasamos
 * a env var.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';
const CRED_ID = 'ZKhcvjnvP6IpEK6w';
const CHANNEL_ID = '503760';

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
    `W1_pre_linkcreds_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));

  let patched = 0;
  for (const n of wf.nodes) {
    if (n.credentials?.httpHeaderAuth?.id === 'PLACEHOLDER_RESPONDIO_CRED_ID') {
      n.credentials.httpHeaderAuth.id = CRED_ID;
      patched++;
    }
    // Reemplazar {{$env.RESPONDIO_CHANNEL_ID}} por el valor hardcoded
    if (n.parameters?.jsonBody && typeof n.parameters.jsonBody === 'string') {
      const before = n.parameters.jsonBody;
      n.parameters.jsonBody = n.parameters.jsonBody.replace(/\{\{\$env\.RESPONDIO_CHANNEL_ID\}\}/g, CHANNEL_ID);
      if (before !== n.parameters.jsonBody) console.log('  Channel ID hardcoded en', n.name);
    }
  }
  console.log(`Credenciales reasignadas en ${patched} nodos`);

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 300));
  console.log('OK: W1 conectado a credencial respond.io (' + CRED_ID + ') + channel ' + CHANNEL_ID);
}

main().catch(e => { console.error(e.message); process.exit(1); });
