// URGENTE: desconectar "Cerrar Conversacion" del SubAgente Administrativo.
//
// Bug: el nodo "Cerrar Conversacion" tiene type n8n-nodes-base.googleSheets
// (un nodo normal de escritura). Estaba conectado como ai_tool al SubAgente
// Administrativo, pero los nodos non-tool no tienen el metodo supplyData()
// requerido por agentes LLM.
//
// Cuando Cami invoca SubAgente Administrativo y este intenta listar/usar
// sus tools, el flow crashea con:
//   "Node does not have a 'supplyData' method defined"
//
// Resultado en produccion: Cami quedaba sin responder al cliente.
// La clienta esperaba respuesta -> mando audio enojado.
//
// Fix minimo: quitar la conexion ai_tool de "Cerrar Conversacion" hacia
// SubAgente Administrativo. Las otras 2 tools (Leer Agenda Vendedor y
// Avisar Vendedor respond.io) siguen funcionando.
//
// Mejora futura: cambiar el type del nodo a googleSheetsTool con name y
// description para que sea invocable, pero NO es urgente.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

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

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_fix_cerrar_conv_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  // Buscar la conexion ai_tool de "Cerrar Conversacion" hacia "SubAgente Administrativo"
  const cerrarConns = w.connections['Cerrar Conversacion'];
  if (!cerrarConns?.ai_tool) {
    console.log('ℹ️  "Cerrar Conversacion" ya no tiene conexiones ai_tool (idempotente)');
    return;
  }

  let modificado = false;
  for (let i = 0; i < (cerrarConns.ai_tool || []).length; i++) {
    const branch = cerrarConns.ai_tool[i] || [];
    const before = branch.length;
    cerrarConns.ai_tool[i] = branch.filter(item => item.node !== 'SubAgente Administrativo');
    if (cerrarConns.ai_tool[i].length < before) modificado = true;
  }

  // Si quedaron sin items, limpiar la key
  if (cerrarConns.ai_tool.every(b => !b || b.length === 0)) {
    delete cerrarConns.ai_tool;
  }
  if (Object.keys(cerrarConns).length === 0) {
    delete w.connections['Cerrar Conversacion'];
  }

  if (!modificado) {
    console.log('ℹ️  Conexion ya no existia (idempotente)');
    return;
  }

  console.log('✅ Desconectado: "Cerrar Conversacion" ya no es ai_tool del SubAgente Administrativo');
  console.log('   El nodo sigue existiendo, solo se quito la conexion problematica.');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\nSubAgente Administrativo ahora con 2 tools funcionales:');
  console.log('  - Leer Agenda Vendedor (googleSheetsTool)');
  console.log('  - Avisar Vendedor respond.io (toolHttpRequest)');
  console.log('\nCami deberia volver a responder normalmente.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
