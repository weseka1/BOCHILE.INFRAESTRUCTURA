#!/usr/bin/env node
/**
 * Arregla conexiones que apuntan a nodos viejos (Twilio) cuyo nombre fue cambiado
 * a respond.io. Recorre TODOS los W1-W4 y reescribe conexiones huerfanas:
 *   "Responder al Cliente Twilio"   -> "Responder al Cliente respond.io"
 *   "Avisar Vendedor por WhatsApp Twilio" -> "Avisar Vendedor respond.io"
 *   "WhatsApp Cliente"              -> "WhatsApp respond.io Cliente"
 *   "WhatsApp Vendedor"             -> "WhatsApp respond.io Vendedor"
 *   "WhatsApp Inquilino"            -> "WhatsApp respond.io Inquilino"
 *   "WhatsApp Aviso al Lead"        -> queda igual (mismo nombre)
 *   "Escalar a Camila Pomerich"     -> queda igual
 *   "Audio - Download Twilio"       -> "Audio - Download"
 *   "Imagen - Download Twilio"      -> "Imagen - Download"
 *
 * Estrategia: si una conexion apunta a un nodo que NO existe, buscar si existe
 * un nodo con nombre "X respond.io" o "X" sin "Twilio" y usarlo. Si no, log.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const WORKFLOWS = [
  { id: 'aUMQyupnGJ5IWm5e', tag: 'W1' },
  { id: 'f1CC972kzNPR8ebi', tag: 'W2' },
  { id: 'W327qYVE9SpwQiRi', tag: 'W3' },
  { id: 'wrFto5o6Zk02sZty', tag: 'W4' },
];

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

function findReplacement(brokenName, existingNames) {
  // Heuristicas para mapear nombre viejo a nuevo
  const candidates = [
    brokenName.replace('Twilio', 'respond.io').trim(),
    brokenName.replace(' Twilio', '').trim(),
    'WhatsApp respond.io ' + brokenName.replace(/^WhatsApp\s+/, ''),
    brokenName.replace(/^WhatsApp\s+/, 'WhatsApp respond.io '),
    brokenName.replace(/Twilio/i, 'respond.io').replace(/\s+/g, ' ').trim(),
  ];
  for (const c of candidates) {
    if (existingNames.has(c)) return c;
  }
  // Si tiene "Twilio" probar sin esa palabra
  if (/twilio/i.test(brokenName)) {
    const stripped = brokenName.replace(/\s*Twilio\s*/i, ' ').replace(/\s+/g, ' ').trim();
    if (existingNames.has(stripped)) return stripped;
  }
  return null;
}

async function fixWf(wfMeta) {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${wfMeta.id}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);
  console.log(`\n═════ ${wfMeta.tag} (${wf.name}) ═════`);

  const bk = path.join(__dirname, '_backups',
    `${wfMeta.tag}_pre_fix_orphans_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));

  const names = new Set(wf.nodes.map(n => n.name));
  let renamed = 0;

  for (const [src, branches] of Object.entries(wf.connections || {})) {
    for (const [outType, outArr] of Object.entries(branches)) {
      for (const group of outArr) {
        for (const c of group) {
          if (!names.has(c.node)) {
            const repl = findReplacement(c.node, names);
            if (repl) {
              console.log(`  ✓ ${src} → ${c.node}  =>  ${repl}`);
              c.node = repl;
              renamed++;
            } else {
              console.log(`  ✗ HUERFANA SIN MAPPING: ${src} → ${c.node}`);
            }
          }
        }
      }
    }
    // Source orfana
    if (!names.has(src)) {
      const repl = findReplacement(src, names);
      if (repl && !wf.connections[repl]) {
        console.log(`  ✓ SOURCE ${src} => ${repl}`);
        wf.connections[repl] = wf.connections[src];
        delete wf.connections[src];
        renamed++;
      }
    }
  }

  console.log(`  Total conexiones reescritas: ${renamed}`);

  if (renamed === 0) {
    console.log('  Sin cambios.');
    return;
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${wfMeta.id}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log(`  ↑ ${wfMeta.tag} UPDATED OK`);
}

(async () => {
  for (const w of WORKFLOWS) await fixWf(w);
  console.log('\n═════ LISTO ═════');
})().catch(e => { console.error(e.message); process.exit(1); });
