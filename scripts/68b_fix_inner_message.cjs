// URGENTE: reemplazar solo el if (innerMessage) {...} por uso directo de
// text_body/media_url/msg_type que ya estan en scope.

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
    path.join(bkpDir, `${WF}_pre_inner_msg_fix_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  let code = parser.parameters.jsCode;

  // Buscamos exactamente el bloque problematico (con regex porque hay variaciones)
  // Patron: desde "let snapText = '';" hasta el cierre del "if (innerMessage) {"

  const oldRegex = /(\s*)\/\/ Compute text_body and media for the snapshot before the if-else block runs\n\s*let snapText = '';\n\s*let snapMediaUrl = '';\n\s*let snapMsgType = 'text';\n\s*if \(innerMessage\) \{[\s\S]*?\n\s*\}/;

  if (!oldRegex.test(code)) {
    console.error('No encontre el patron viejo via regex');
    // Quizas ya fue fixeado
    if (code.includes('const snapText = String(text_body')) {
      console.log('ℹ️  Ya fixeado (uso de text_body directo)');
      return;
    }
    process.exit(2);
  }

  const replacement = `$1// Reusar variables ya computadas por el parser (text_body, media_url, msg_type estan en scope)
    const snapText = String(text_body || '');
    const snapMediaUrl = String(media_url || '');
    const snapMsgType = String(msg_type || 'text');`;

  code = code.replace(oldRegex, replacement);
  parser.parameters.jsCode = code;
  console.log('✅ Reemplazo aplicado');

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
