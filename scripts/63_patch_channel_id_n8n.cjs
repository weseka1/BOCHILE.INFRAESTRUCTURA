// Patch al workflow n8n para capturar channel_id de respond.io.
//
// Cambios:
//   1. "Parsear Mensaje" code node: extrae body.channel.id y lo propaga al output
//   2. "Log Mensaje Entrante", "Log Mensaje Saliente", "Log Mensaje Humano":
//      agregar mapping de columna channel_id
//
// Idempotente. Backup automatico.

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

  // Backup
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${WF}_pre_channel_id_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(w, null, 2));
  console.log('Backup:', bkpPath);

  // ===== 1. Patch Parsear Mensaje =====
  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) { console.error('No Parsear Mensaje'); process.exit(1); }
  let code = parser.parameters?.jsCode || '';

  if (code.includes('channel_id_val')) {
    console.log('ℹ️  Parsear Mensaje ya tiene channel_id (idempotente)');
  } else {
    // 1a. Declarar variable channel_id_val al inicio (despues de contact_id_val)
    code = code.replace(
      'let contact_id_val = null;',
      'let contact_id_val = null;\nlet channel_id_val = null;'
    );
    // 1b. Extraer body.channel.id justo despues de extraer contact_id
    code = code.replace(
      'contact_id_val = contact.id || null;',
      'contact_id_val = contact.id || null;\n  const channelObj = body.channel || {};\n  channel_id_val = channelObj.id || body.channelId || null;'
    );
    // 1c. Agregar channel_id al return success final
    code = code.replace(
      "telefono: from, contact_id: contact_id_val, nombre: profile,",
      "telefono: from, contact_id: contact_id_val, channel_id: channel_id_val, nombre: profile,"
    );
    // 1d. Agregar channel_id al return early de humano
    code = code.replace(
      "lead_id: 'L-' + digits.slice(-10), msg_humano: text_body.slice(0, 200)",
      "lead_id: 'L-' + digits.slice(-10), msg_humano: text_body.slice(0, 200), channel_id: channel_id_val"
    );
    parser.parameters.jsCode = code;
    console.log('✅ Parsear Mensaje patcheado (extrae body.channel.id)');
  }

  // ===== 2. Patch los 3 Log nodes =====
  const LOG_NODES = ['Log Mensaje Entrante', 'Log Mensaje Saliente', 'Log Mensaje Humano'];
  for (const name of LOG_NODES) {
    const node = w.nodes.find(n => n.name === name);
    if (!node) { console.log(`⚠️  Nodo "${name}" no encontrado, skip`); continue; }

    const cols = node.parameters?.columns;
    if (!cols || !cols.value) { console.log(`⚠️  "${name}" no tiene columns.value`); continue; }
    if (cols.value.channel_id) {
      console.log(`ℹ️  "${name}" ya tiene channel_id (idempotente)`);
      continue;
    }
    // Agregar channel_id mapping
    cols.value.channel_id = "={{ $('Parsear Mensaje').item.json.channel_id || '' }}";
    console.log(`✅ "${name}" agrega columna channel_id`);
  }

  // ===== 3. PUT + activate =====
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
