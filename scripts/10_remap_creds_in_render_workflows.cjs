// Reasigna credenciales en todos los workflows del n8n Render.
// Mapea las credenciales referenciadas por nombre con los IDs nuevos del Render.
const https = require('node:https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const HOST = 'weseka.onrender.com';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: HOST, port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

(async () => {
  // 1) Listar credenciales actuales en Render
  const credsR = await req('GET', '/api/v1/credentials?limit=100');
  const creds = JSON.parse(credsR.b).data || [];
  console.log('Credenciales en Render:');
  const credsByName = {};  // name -> { id, type, realName }
  const credsByType = {};  // type -> { id, name }  (fallback case-insensitive)
  for (const c of creds) {
    credsByName[c.name] = { id: c.id, type: c.type, realName: c.name };
    // index case-insensitive
    credsByName[c.name.toLowerCase()] = { id: c.id, type: c.type, realName: c.name };
    // also by type (if unique)
    if (!credsByType[c.type]) credsByType[c.type] = { id: c.id, name: c.name };
    else credsByType[c.type] = null;  // multiple, can't auto-pick
    console.log('  ' + c.name + ' -> id=' + c.id + ' type=' + c.type);
  }

  // 2) Listar workflows
  const wfsR = await req('GET', '/api/v1/workflows?limit=50');
  const wfs = JSON.parse(wfsR.b).data || [];

  let updated = 0, missing = new Set();

  for (const wfMeta of wfs) {
    // Get full workflow
    const full = await req('GET', '/api/v1/workflows/' + wfMeta.id);
    const wf = JSON.parse(full.b);

    let changes = 0;
    for (const node of (wf.nodes || [])) {
      if (!node.credentials) continue;
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        const wantName = credInfo.name;
        // Buscar por nombre exacto, luego case-insensitive, luego por tipo
        let found = credsByName[wantName];
        if (!found) found = credsByName[wantName.toLowerCase()];
        if (!found && credsByType[credType]) found = credsByType[credType];
        if (!found) {
          missing.add(wantName + ' [' + credType + ']');
          continue;
        }
        if (credInfo.id !== found.id) {
          // Usar el nombre REAL de la credencial existente
          const realName = found.realName || found.name || wantName;
          node.credentials[credType] = { id: found.id, name: realName };
          changes++;
        }
      }
    }

    if (changes === 0) { console.log('  [skip] ' + wf.name + ' (0 changes)'); continue; }

    // PUT update
    const ALLOWED_SETTINGS = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
    const settings = {};
    if (wf.settings) for (const k of ALLOWED_SETTINGS) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];
    if (!settings.executionOrder) settings.executionOrder = 'v1';

    const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
    const upd = await req('PUT', '/api/v1/workflows/' + wf.id, payload);
    console.log('  [' + (upd.s === 200 ? 'OK' : 'FAIL ' + upd.s) + '] ' + wf.name + ' (' + changes + ' creds remapped)');
    if (upd.s !== 200) console.log('    body:', upd.b.slice(0, 200));
    if (upd.s === 200) updated++;
  }

  console.log('\nResumen: ' + updated + ' workflows actualizados');
  if (missing.size > 0) {
    console.log('\n⚠ CREDENCIALES FALTANTES (crearlas en la UI):');
    for (const m of missing) console.log('  - ' + m);
  } else {
    console.log('\n✓ Todas las credenciales mapeadas');
  }
})();
