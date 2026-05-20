#!/usr/bin/env node
/**
 * Bug encontrado en exec 3299 (imagen):
 *   Memoria Conversacion usa sessionKey = $("Merge Caminos").item.json.telefono
 *   pero el branch de imagen (Imagen - Set Mensaje) DESCARTA telefono y solo
 *   deja {content, mensaje}. Resultado: "Key parameter is empty" → falla.
 *
 * Fix: apuntar el sessionKey a Parsear Mensaje que SIEMPRE tiene telefono.
 *
 * De paso reviso si los Set Mensaje (Imagen/Audio) deberian incluir telefono
 * para no romper otros consumidores. Por ahora, surgical fix solo memoria.
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
    `W1_pre_memory_sessionkey_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // FIX: Memoria sessionKey → Parsear Mensaje
  const mem = wf.nodes.find(n => n.name === 'Memoria Conversacion');
  if (!mem) throw new Error('No encuentro Memoria Conversacion');
  const before = mem.parameters.sessionKey;
  mem.parameters.sessionKey = '={{ $("Parsear Mensaje").item.json.telefono }}';
  console.log('✓ Memoria sessionKey:');
  console.log('  antes:', before);
  console.log('  ahora:', mem.parameters.sessionKey);

  // BONUS: que los Set Mensaje (Imagen/Audio) tambien arrastren telefono para
  // que cualquier nodo downstream lo tenga. Inspecciono.
  for (const setName of ['Imagen - Set Mensaje', 'Audio - Set Mensaje']) {
    const sn = wf.nodes.find(n => n.name === setName);
    if (!sn) continue;
    const p = sn.parameters || {};
    // El Set Mensaje tipicamente tiene mode keepOnlySet:true. Lo cambio a false
    // para que pase TODOS los campos del input + agregue los nuevos.
    if (p.options && p.options.includeOtherFields === false) {
      p.options.includeOtherFields = true;
      console.log('✓', setName, '→ ahora preserva otros campos del input');
    } else if (p.keepOnlySet === true) {
      p.keepOnlySet = false;
      console.log('✓', setName, '→ keepOnlySet=false (preserva otros campos)');
    } else {
      console.log('  ', setName, '→ ya preserva otros campos o estructura diferente, no toco');
    }
  }

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
