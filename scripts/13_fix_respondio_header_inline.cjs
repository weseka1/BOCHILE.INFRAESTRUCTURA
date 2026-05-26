const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjgwODMsInNwYWNlSWQiOjQxMzkwNSwib3JnSWQiOjM4MzM3OSwidHlwZSI6ImFwaSIsImlhdCI6MTc3OTA0MTM4MH0.a6AM8Vke1istn3GzLCKoB30MFppgexf570BQqFb9vxc';

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
    let ch = 0;
    for (const n of (full.nodes || [])) {
      const url = String(n.parameters?.url || '');
      if (n.type === 'n8n-nodes-base.httpRequest' && url.includes('api.respond.io')) {
        n.parameters.authentication = 'none';
        if (n.credentials) delete n.credentials;
        n.parameters.sendHeaders = true;
        n.parameters.headerParameters = { parameters: [{ name: 'Authorization', value: 'Bearer ' + TOKEN }] };
        ch++;
        console.log('  Fixed:', n.name, '@', full.name);
      }
    }
    if (ch === 0) continue;
    const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
    const s = {};
    if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
    if (!s.executionOrder) s.executionOrder = 'v1';
    await req('PUT', '/api/v1/workflows/' + full.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
    await req('POST', '/api/v1/workflows/' + full.id + '/activate');
  }
  console.log('Done.');
})();
