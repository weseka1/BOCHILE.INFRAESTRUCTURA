// BUG CRITICO: el nodo "Responder al Cliente respond.io" lee
//   $('Vendedor CORE').item.json.output
// en vez de
//   $('Sanitize Output').item.json.output
// Por eso el sanitizer es inutil — limpia el texto pero el cliente
// recibe el RAW del LLM con corchetes [Ver mas], ¿¡ apertura, etc.
//
// Fix: cambiar la referencia para que use el Sanitize Output.

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
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_responder_sanitize_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const resp = w.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  if (!resp) { console.error('No encontre Responder al Cliente'); process.exit(1); }

  const oldBody = resp.parameters.jsonBody || '';
  console.log('BODY ANTES:');
  console.log(' ', oldBody);

  // Reemplazar la referencia: $('Vendedor CORE').item.json.output -> $('Sanitize Output').item.json.output
  const NEW = oldBody.replace(/\$\('Vendedor CORE'\)\.item\.json\.output/g, "$('Sanitize Output').item.json.output");

  if (NEW === oldBody) {
    console.log('No encontre el patron, body sin cambios');
    process.exit(2);
  }

  resp.parameters.jsonBody = NEW;
  console.log('');
  console.log('BODY AHORA:');
  console.log(' ', NEW);

  // Tambien actualizar el "Log Mensaje Saliente" si usa Vendedor CORE
  const log = w.nodes.find(n => n.name === 'Log Mensaje Saliente');
  if (log && log.parameters?.columns?.value?.mensaje) {
    const oldM = log.parameters.columns.value.mensaje;
    const newM = oldM.replace(/\$\('Vendedor CORE'\)\.item\.json\.output/g, "$('Sanitize Output').item.json.output");
    if (newM !== oldM) {
      log.parameters.columns.value.mensaje = newM;
      console.log('');
      console.log('Log Mensaje Saliente: tambien actualizado para guardar el output sanitizado');
    }
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + WF, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('');
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + WF + '/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
