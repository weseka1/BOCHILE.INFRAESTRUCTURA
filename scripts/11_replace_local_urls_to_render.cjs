// Reemplaza URLs internas locales en los workflows de Render por URLs de bochile-rag.onrender.com
const https = require('node:https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const RAG = 'https://bochile-rag.onrender.com';

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
  const wfsR = await req('GET', '/api/v1/workflows?limit=50');
  const wfs = JSON.parse(wfsR.b).data || [];

  for (const wfMeta of wfs) {
    const full = await req('GET', '/api/v1/workflows/' + wfMeta.id);
    const wf = JSON.parse(full.b);

    // Convertir todo el workflow a JSON string para hacer replaces masivos
    const before = JSON.stringify(wf.nodes);
    let after = before
      .replace(/http:\/\/host\.docker\.internal:3003/g, RAG)
      .replace(/http:\/\/localhost:3003/g, RAG)
      .replace(/http:\/\/host\.docker\.internal:6333/g, 'https://e68bfd5f-f3d0-4dcd-84e4-b49dc149a088.us-east-1-1.aws.cloud.qdrant.io')
      .replace(/http:\/\/localhost:6333/g, 'https://e68bfd5f-f3d0-4dcd-84e4-b49dc149a088.us-east-1-1.aws.cloud.qdrant.io');

    if (before === after) {
      console.log('  [skip] ' + wf.name + ' (sin cambios)');
      continue;
    }

    wf.nodes = JSON.parse(after);

    // PUT
    const ALLOWED = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
    const settings = {};
    if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];
    if (!settings.executionOrder) settings.executionOrder = 'v1';

    const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
    const upd = await req('PUT', '/api/v1/workflows/' + wf.id, payload);
    console.log('  [' + (upd.s === 200 ? 'OK' : 'FAIL ' + upd.s) + '] ' + wf.name);
    if (upd.s !== 200) console.log('    body:', upd.b.slice(0, 200));
  }

  console.log('\nListo. URLs internas apuntando a Render.');
})();
