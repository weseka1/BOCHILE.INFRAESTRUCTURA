// Ajustar horarios exactos del saludo segun el cliente:
// - Buen dia: 6:00 - 12:59
// - Buenas tardes: 13:00 - 20:00
// - Buenas noches: 20:01 - 5:59 (la noche + madrugada)

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

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters.options.systemMessage || '');

  // Reemplazar la linea de horarios vieja con los horarios correctos del cliente
  const OLD = [
    '  - 00:00 a 12:00 -> "Buen día"',
    '  - 12:00 a 19:00 -> "Buenas tardes"',
    '  - 19:00 a 23:59 -> "Buenas noches"'
  ].join('\n');

  const NEW = [
    '  - 06:00 a 12:59 -> "Buen día"',
    '  - 13:00 a 20:00 -> "Buenas tardes"',
    '  - 20:01 a 05:59 -> "Buenas noches" (incluye madrugada)'
  ].join('\n');

  if (sm.includes(OLD)) {
    sm = sm.replace(OLD, NEW);
    console.log('Horarios actualizados a los del cliente');
  } else if (sm.includes('06:00 a 12:59')) {
    console.log('Ya estaba con horarios del cliente');
  } else {
    console.log('No encontre el patron exacto, buscando alternativa...');
    // Patron alternativo: la "SEGUN HORA" line
    const altMarker = 'SEGUN HORA (zona horaria Argentina GMT-3):';
    const idx = sm.indexOf(altMarker);
    if (idx >= 0) {
      const lineEnd = sm.indexOf('\n\nSIEMPRE', idx);
      if (lineEnd >= 0) {
        sm = sm.slice(0, idx) + altMarker + '\n' + NEW + sm.slice(lineEnd);
        console.log('Bloque de horarios reemplazado via marker alternativo');
      }
    }
  }

  core.parameters.options.systemMessage = sm;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + WF, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + WF + '/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
