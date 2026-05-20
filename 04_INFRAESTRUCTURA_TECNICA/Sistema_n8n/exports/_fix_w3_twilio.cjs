#!/usr/bin/env node
/**
 * Arregla el ultimo nodo Twilio que quedo en W3 (WhatsApp Aviso al Lead).
 * Lo convierte a HTTP Request a respond.io.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W3_ID = 'W327qYVE9SpwQiRi';
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

function twilioToRespondioNode(old) {
  const tel = '{{ $json.telefono }}';
  const msg = '{{ ($json.mensaje || "").replace(/\\\\/g, "\\\\\\\\").replace(/"/g, "\\\\\\"").replace(/\\n/g, "\\\\n") }}';
  return {
    parameters: {
      method: 'POST',
      url: `=https://api.respond.io/v2/contact/phone:${tel}/message`,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={\n  "channelId": ${CHANNEL_ID},\n  "message": {\n    "type": "text",\n    "text": "${msg}"\n  }\n}`,
      options: { response: { response: { neverError: true, responseFormat: 'json' } } },
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
    },
    id: old.id,
    name: old.name.replace(/Twilio/i, 'respond.io').trim(),
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: old.position,
    credentials: { httpHeaderAuth: { id: CRED_ID, name: 'respond.io API' } },
  };
}

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W3_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W3_pre_fix_twilio_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  let patched = 0;
  const oldNameToNew = {};
  wf.nodes = wf.nodes.map((n) => {
    if ((n.type || '').toLowerCase().includes('twilio') || (n.credentials && n.credentials.twilioApi)) {
      const newNode = twilioToRespondioNode(n);
      console.log('✓', n.name, '→', newNode.name);
      if (n.name !== newNode.name) oldNameToNew[n.name] = newNode.name;
      patched++;
      return newNode;
    }
    return n;
  });

  if (Object.keys(oldNameToNew).length) {
    const newConns = {};
    for (const [src, branches] of Object.entries(wf.connections || {})) {
      const newSrc = oldNameToNew[src] || src;
      newConns[newSrc] = {};
      for (const [outType, outArr] of Object.entries(branches)) {
        newConns[newSrc][outType] = outArr.map((conns) =>
          conns.map((c) => ({ ...c, node: oldNameToNew[c.node] || c.node })),
        );
      }
    }
    wf.connections = newConns;
  }

  console.log(`Total nodos convertidos: ${patched}`);

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W3_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W3 UPDATED OK');
}

main().catch(e => { console.error(e.message); process.exit(1); });
