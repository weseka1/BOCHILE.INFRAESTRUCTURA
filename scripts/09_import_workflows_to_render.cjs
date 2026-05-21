// Importa los 7 workflows JSON al n8n de Render via API REST.
// Para cada workflow:
//   1. POST /api/v1/workflows con el JSON (sin nodos/credenciales todavia, solo metadata)
//   2. PUT /api/v1/workflows/:id con todos los nodos
//   3. Reemplaza URLs hardcoded de localhost a Render
//   4. activa el workflow
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const N8N_HOST = 'weseka.onrender.com';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

const RAG_RENDER_URL = 'https://bochile-rag.onrender.com';  // futuro, todavia no existe pero ya lo configuramos

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');

function req(method, p, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'X-N8N-API-KEY': N8N_API_KEY };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request({ host: N8N_HOST, port: 443, path: p, method, headers }, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (data) r.write(data);
    r.end();
  });
}

function replaceLocalUrlsInWorkflow(wf) {
  // Reemplaza host.docker.internal:3003 y localhost:3003 a Render
  const json = JSON.stringify(wf);
  const replaced = json
    .replace(/http:\/\/host\.docker\.internal:3003/g, RAG_RENDER_URL)
    .replace(/http:\/\/localhost:3003/g, RAG_RENDER_URL);
  return JSON.parse(replaced);
}

(async () => {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json')).sort();
  console.log('Workflows a importar:', files.length);

  // Listar existentes para skip duplicados
  const existing = await req('GET', '/api/v1/workflows?limit=100');
  const existingNames = new Set((JSON.parse(existing.body).data || []).map(w => w.name));

  for (const f of files) {
    console.log('\n=== ' + f + ' ===');
    const fullJson = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8'));
    const cleaned = replaceLocalUrlsInWorkflow(fullJson);

    if (existingNames.has(cleaned.name)) {
      console.log('  SKIP: ya existe workflow con nombre "' + cleaned.name + '"');
      continue;
    }

    // POST create (settings: filtrar propiedades no aceptadas por la API)
    const ALLOWED_SETTINGS = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
    const settingsClean = {};
    if (cleaned.settings) for (const k of ALLOWED_SETTINGS) if (cleaned.settings[k] !== undefined) settingsClean[k] = cleaned.settings[k];
    if (Object.keys(settingsClean).length === 0) settingsClean.executionOrder = 'v1';
    const payload = {
      name: cleaned.name,
      nodes: cleaned.nodes,
      connections: cleaned.connections,
      settings: settingsClean,
    };
    const cr = await req('POST', '/api/v1/workflows', payload);
    if (cr.status !== 200 && cr.status !== 201) {
      console.log('  CREATE FAIL:', cr.status, cr.body.slice(0, 300));
      continue;
    }
    const created = JSON.parse(cr.body);
    console.log('  CREATED id=' + created.id + ' name="' + created.name + '" nodes=' + (created.nodes?.length || cleaned.nodes.length));
  }

  // Listar finales
  const final = await req('GET', '/api/v1/workflows?limit=100');
  const list = JSON.parse(final.body).data || [];
  console.log('\nTotal workflows en n8n Render ahora:', list.length);
  for (const w of list) console.log('  - ' + w.id + ' | ' + w.name + ' | active=' + w.active);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
