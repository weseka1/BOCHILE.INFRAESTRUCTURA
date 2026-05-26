// Fix CRITICO: la tool 'Buscar Propiedades en Catalogo' referencia el ID viejo (local 6Dk2umeJDNViv9yb)
// El real en Render es mKKIYx7pA2Kr7t4L. Actualizar en TODOS los workflows que la usen.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

const OLD_ID = '6Dk2umeJDNViv9yb';
const NEW_ID = 'mKKIYx7pA2Kr7t4L';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

(async () => {
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  for (const meta of wfs) {
    const full = JSON.parse((await req('GET', '/api/v1/workflows/' + meta.id)).b);
    let changed = 0;
    for (const n of (full.nodes || [])) {
      // Buscar referencias al ID viejo en cualquier campo workflowId
      const wfId = n.parameters?.workflowId;
      if (wfId && typeof wfId === 'object' && wfId.value === OLD_ID) {
        n.parameters.workflowId.value = NEW_ID;
        changed++;
        console.log('  Fixed node:', n.name, 'in', full.name);
      }
      // Tambien posibles referencias en raw JSON string del nodo
      const asStr = JSON.stringify(n.parameters || {});
      if (asStr.includes(OLD_ID)) {
        const fixed = JSON.parse(asStr.replace(new RegExp(OLD_ID, 'g'), NEW_ID));
        n.parameters = fixed;
        changed++;
        console.log('  Fixed (raw) node:', n.name, 'in', full.name);
      }
    }
    if (changed === 0) continue;
    const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
    const s = {};
    if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
    if (!s.executionOrder) s.executionOrder = 'v1';
    s.timezone = 'America/Argentina/Buenos_Aires';
    const upd = await req('PUT', '/api/v1/workflows/' + full.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
    await req('POST', '/api/v1/workflows/' + full.id + '/activate');
    console.log('  PUT:', upd.s, '| name:', full.name);
  }
  console.log('Done.');
})();
