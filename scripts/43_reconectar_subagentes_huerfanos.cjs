// Fix: reconecta los nodos huerfanos al Vendedor CORE.
//
// Bugs encontrados con script 42:
//   1. SubAgente Administrativo: tiene su GPT y sus tools (Leer Agenda, Avisar Vendedor,
//      Cerrar Conversacion) pero NO se conecta al Vendedor CORE como ai_tool.
//      Resultado: Cami no puede invocar acciones administrativas.
//   2. Crear Visita en CRM: isla total. Cami no puede agendar visitas.
//
// Fix: agregar ambos como ai_tool del Vendedor CORE.
//
// USO: node scripts/43_reconectar_subagentes_huerfanos.cjs

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const TARGET_AGENT = 'Vendedor CORE';
const NODES_TO_CONNECT = [
  'SubAgente Administrativo',
  'Crear Visita en CRM',
];

function addAiTool(connections, sourceName, targetName) {
  if (!connections[sourceName]) connections[sourceName] = {};
  if (!connections[sourceName].ai_tool) connections[sourceName].ai_tool = [[]];
  const branch = connections[sourceName].ai_tool[0];
  // dedupe
  if (branch.some(it => it.node === targetName && it.type === 'ai_tool')) {
    return false; // ya estaba
  }
  branch.push({ node: targetName, type: 'ai_tool', index: 0 });
  return true;
}

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s, r.b.slice(0,200)); process.exit(1); }
  const w = JSON.parse(r.b);

  // Backup primero
  const fs = require('node:fs');
  const path = require('node:path');
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpFile = path.join(bkpDir, `TEdlfSBCc5ENVslp_pre_reconect_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpFile, JSON.stringify(w, null, 2));
  console.log(`Backup en: ${bkpFile}\n`);

  // Validar que los nodos existen
  const names = new Set(w.nodes.map(n => n.name));
  if (!names.has(TARGET_AGENT)) { console.error(`No existe ${TARGET_AGENT}`); process.exit(1); }
  for (const n of NODES_TO_CONNECT) {
    if (!names.has(n)) console.error(`⚠️  No existe nodo "${n}"`);
  }

  // Aplicar conexiones
  let cambios = 0;
  for (const src of NODES_TO_CONNECT) {
    if (!names.has(src)) continue;
    const added = addAiTool(w.connections, src, TARGET_AGENT);
    if (added) {
      console.log(`✅ Conectado: ${src} ─[ai_tool]→ ${TARGET_AGENT}`);
      cambios++;
    } else {
      console.log(`ℹ️  Ya estaba: ${src} → ${TARGET_AGENT}`);
    }
  }

  if (cambios === 0) {
    console.log('\nNada que hacer. Salgo.');
    return;
  }

  // Settings preservadas
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', {
    name: w.name, nodes: w.nodes, connections: w.connections, settings: s,
  });
  console.log(`\nPUT workflow: ${upd.s}`);
  const act = await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log(`Activate: ${act.s}`);

  console.log('\nLISTO. Ahora Cami va a poder:');
  console.log('  • Invocar SubAgente Administrativo → leer agenda + avisar vendedor humano + cerrar conv');
  console.log('  • Crear visitas en el Sheet directamente');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
