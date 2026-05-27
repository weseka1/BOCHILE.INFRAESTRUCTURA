// URGENTE FIX: el bloque de bypass Alquileres referenciaba 'innerMessage'
// que estaba fuera de scope (declarado dentro del if(isRespondio) block,
// pero mi bloque corre despues de ese if).
//
// Resultado: cuando entraba un mensaje a Alquileres, el parser tiraba
// "innerMessage is not defined" y se rompia. El mensaje NO se loggeaba.
//
// Fix: usar text_body, media_url, msg_type que SI estan en scope (declarados
// al top del function con let). El parser ya los computa correctamente
// antes de mi bloque.

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

const OLD = `  if (String(channel_id_val) === '508045') {
    // Filtro: ignorar mensajes de bot/IA en Alquileres (requerimiento del cliente)
    if (es_bot_propio) {
      return [{ json: { skip: true, reason: 'canal_alquileres_bot_ignorado' } }];
    }
    const isOut = (evento === 'message.sent' || evento === 'message_sent');
    const dir = isOut ? 'out' : 'in';
    const ag = es_humano ? 'Empleado Alquileres' : '';
    // Compute text_body and media for the snapshot before the if-else block runs
    let snapText = '';
    let snapMediaUrl = '';
    let snapMsgType = 'text';
    if (innerMessage) {
      const att = innerMessage.attachment;
      const etype = String(innerMessage.type || (att && att.type) || 'text').toLowerCase();
      if (etype === 'text') { snapText = String(innerMessage.text || innerMessage.body || ''); snapMsgType = 'text'; }
      else if (etype === 'audio' || etype === 'voice') { snapMsgType = 'audio'; snapMediaUrl = String((att && att.url) || ''); }
      else if (etype === 'image') { snapMsgType = 'image'; snapMediaUrl = String((att && att.url) || ''); snapText = String((att && (att.caption || att.description)) || ''); }
      else { snapMsgType = 'document'; snapMediaUrl = String((att && att.url) || ''); snapText = String((att && (att.caption || att.description)) || ''); }
    }
    const tel = String(from || '');
    const digits = tel.replace(/\\D/g, '');`;

const NEW = `  if (String(channel_id_val) === '508045') {
    // Filtro: ignorar mensajes de bot/IA en Alquileres (requerimiento del cliente)
    if (es_bot_propio) {
      return [{ json: { skip: true, reason: 'canal_alquileres_bot_ignorado' } }];
    }
    const isOut = (evento === 'message.sent' || evento === 'message_sent');
    const dir = isOut ? 'out' : 'in';
    const ag = es_humano ? 'Empleado Alquileres' : '';
    // Usar variables ya computadas por el parser (estan en scope al top del function)
    const snapText = String(text_body || '');
    const snapMediaUrl = String(media_url || '');
    const snapMsgType = String(msg_type || 'text');
    const tel = String(from || '');
    const digits = tel.replace(/\\D/g, '');`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_fix_inner_msg_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) { console.error('No parser'); process.exit(1); }
  let code = parser.parameters?.jsCode || '';

  if (!code.includes('if (innerMessage) {')) {
    console.log('ℹ️  El parser ya esta fixeado (no encuentra el patron viejo)');
    return;
  }

  if (!code.includes(OLD)) {
    console.error('No encontre el patron exacto. El parser cambio?');
    process.exit(2);
  }

  code = code.replace(OLD, NEW);
  parser.parameters.jsCode = code;
  console.log('✅ Bloque alquileres corregido: usa text_body/media_url/msg_type del scope global');

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
