#!/usr/bin/env node
/**
 * Arregla 2 bugs en W1:
 * 1) "Responder al Cliente respond.io" usaba $('Parsear Mensaje').item.json.from
 *    El parser ahora devuelve "telefono", no "from". Lo dejo apuntando a telefono.
 * 2) "OK al Webhook" devolvia TwiML XML (legacy Twilio). Para respond.io es mejor
 *    JSON 200 OK simple.
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
    `W1_pre_fix_responder_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  let fixed = 0;

  // FIX 1: Responder al Cliente respond.io -> usar telefono (no from)
  const responder = wf.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  if (responder) {
    responder.parameters.url =
      "=https://api.respond.io/v2/contact/phone:{{ $('Parsear Mensaje').item.json.telefono.replace(/[^0-9]/g, '') }}/message";
    responder.parameters.jsonBody =
      "={\n  \"channelId\": 503760,\n  \"message\": {\n    \"type\": \"text\",\n    \"text\": \"{{ ($('Vendedor CORE').item.json.output || '').replace(/\\\\/g, '\\\\\\\\').replace(/\"/g, '\\\\\"').replace(/\\n/g, '\\\\n') }}\"\n  }\n}";
    console.log('✓ Responder al Cliente respond.io: arreglado (telefono + escapado JSON)');
    fixed++;
  }

  // FIX 2: OK al Webhook -> JSON simple 200
  const ok = wf.nodes.find(n => n.name === 'OK al Webhook');
  if (ok) {
    ok.parameters.respondWith = 'json';
    ok.parameters.responseBody = '={\n  "ok": true,\n  "received_at": "{{ $now.toISO() }}"\n}';
    delete ok.parameters.options;
    console.log('✓ OK al Webhook: ahora responde JSON 200');
    fixed++;
  }

  console.log(`Total fixes: ${fixed}`);

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');
}

main().catch(e => { console.error(e.message); process.exit(1); });
