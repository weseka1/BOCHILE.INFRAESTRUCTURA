#!/usr/bin/env node
/**
 * Rollback pragmatico: restaurar el tool de Google Sheets para el Matcher,
 * pero MANTENER los prompts mejorados anti-divagacion del CORE.
 *
 * El Sheet ya tiene datos enriquecidos por el LLM (m2 76%, amb 60%, dir 87%,
 * resumen 98%), asi que el Matcher tiene buen contexto incluso sin RAG.
 *
 * El RAG queda armado en :3003 + documentado, pero deshabilitado hasta
 * resolver el issue del toolCode en agentTool de n8n (fase 2).
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
  // Cargar backup pre-RAG para sacar el nodo original de Google Sheets
  const backupDir = path.join(__dirname, '_backups');
  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('W1_pre_RAG_'))
    .sort();
  if (backups.length === 0) throw new Error('No hay backup pre-RAG');
  const backupPath = path.join(backupDir, backups[backups.length - 1]);
  console.log('Usando backup:', backups[backups.length - 1]);
  const original = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const originalSheetsNode = original.nodes.find((n) => n.name === 'Leer Catalogo Propiedades');
  if (!originalSheetsNode) throw new Error('No encontre nodo original en el backup');
  console.log('Nodo original encontrado: ', originalSheetsNode.type);

  // Cargar workflow actual
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  // Backup pre-rollback
  const bk = path.join(backupDir,
    `W1_pre_rollback_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));

  // Reemplazar Buscar Catalogo RAG por Leer Catalogo Propiedades original
  const idx = wf.nodes.findIndex((n) => n.name === 'Buscar Catalogo RAG');
  if (idx === -1) throw new Error('No esta Buscar Catalogo RAG');
  const current = wf.nodes[idx];
  // Restauramos el nodo del backup pero le mantenemos el id current para no romper connections
  wf.nodes[idx] = {
    ...originalSheetsNode,
    id: current.id,
    position: current.position,
  };

  // Renombrar connection: Buscar Catalogo RAG -> Leer Catalogo Propiedades
  if (wf.connections['Buscar Catalogo RAG']) {
    wf.connections['Leer Catalogo Propiedades'] = wf.connections['Buscar Catalogo RAG'];
    delete wf.connections['Buscar Catalogo RAG'];
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body);
  console.log('OK: tool del Matcher restaurado a Google Sheets (con catalogo enriquecido)');
  console.log('Los prompts mejorados anti-divagacion del CORE y Matcher se MANTUVIERON');
}

main().catch(e => { console.error(e.message); process.exit(1); });
