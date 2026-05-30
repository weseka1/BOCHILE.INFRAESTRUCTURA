// Refactor CONSERVADOR del systemMessage del CORE:
// 1. Eliminar lineas decorativas "# ====" (22 lineas que no aportan)
// 2. Renombrar segunda "REGLA #0" para que no compita con "REGLA CERO"
// 3. NO tocar contenido. NO consolidar bloques. NO perder informacion.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODR8MDg3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY2 };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${WF}_pre_refactor_conservador_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(w, null, 2));
  console.log('Backup:', bkpPath);

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core?.parameters?.options?.systemMessage || '');
  const before = sm.length;

  // 1. Quitar lineas decorativas "# ====+" (con o sin espacios alrededor)
  const lines = sm.split('\n');
  const cleaned = lines.filter(l => !/^#\s*=+\s*$/.test(l));
  const decorRemoved = lines.length - cleaned.length;
  sm = cleaned.join('\n');

  // Tambien quitar dobles saltos consecutivos creados al borrar decoraciones
  sm = sm.replace(/\n{3,}/g, '\n\n');

  // 2. Renombrar segunda "REGLA #0" para distinguirla
  const oldH = '# REGLA #0 (ABSOLUTA - LA MAS IMPORTANTE)';
  const newH = '# MATCHER FIRST — protocolo anti "no tengo / no manejamos"';
  let renamed = false;
  if (sm.includes(oldH)) {
    sm = sm.replace(oldH, newH);
    renamed = true;
  }

  const after = sm.length;
  console.log(`\nLineas decorativas removidas: ${decorRemoved}`);
  console.log(`Renombrado segundo "REGLA #0" -> "MATCHER FIRST": ${renamed ? '✅' : '⚠️ no encontrado'}`);
  console.log(`Tamano: ${before} -> ${after} chars (ahorro: ${before - after}, ~${Math.round((before - after) / 4)} tokens)`);

  // Guardar el nuevo a archivo para diff visual
  fs.writeFileSync(path.resolve(__dirname, '_sm_nuevo.md'), sm);
  console.log('Nuevo systemMessage en: scripts/_sm_nuevo.md');

  core.parameters.options.systemMessage = sm;

  // PUT + activate
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
