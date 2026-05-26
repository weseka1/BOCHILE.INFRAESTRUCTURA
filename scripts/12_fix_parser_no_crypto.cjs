// Parser v9: SIN crypto (n8n Render no permite require crypto)
// HMAC validation desactivada; restante igual a v8
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

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

const PARSER_V9 = `// Parser v9 (Render-safe): handoff + buffer SIN crypto (HMAC desactivado)
const raw = $input.first().json;
const body = raw.body || raw;

const isRespondio = !!(body.event_type || body.contact || body.message);
let from = '';
let profile = 'Desconocido';
let text_body = '';
let media_url = '';
let media_type = '';
let msg_type = 'text';
let canal = 'whatsapp';
let contact_id_val = null;
let evento = '';
let es_humano = false;
let es_bot_propio = false;

if (isRespondio) {
  const contact = body.contact || {};
  contact_id_val = contact.id || null;
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;
  const attachment = innerMessage.attachment || null;
  const sender = body.sender || {};
  evento = String(body.event_type || '');

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

  if (evento === 'message.sent' || evento === 'message_sent') {
    const src = String(sender.source || '').toLowerCase();
    if (src === 'user' || src === 'agent' || (sender.userId && src !== 'bot' && src !== 'api')) {
      es_humano = true;
    } else {
      es_bot_propio = true;
    }
  }

  let effectiveType = String(innerMessage.type || 'text').toLowerCase();
  if (effectiveType === 'attachment' && attachment) {
    effectiveType = String(attachment.type || '').toLowerCase();
    if (!effectiveType && attachment.mimeType) {
      const mt = String(attachment.mimeType).toLowerCase();
      if (mt.startsWith('audio/')) effectiveType = 'audio';
      else if (mt.startsWith('image/')) effectiveType = 'image';
      else if (mt.startsWith('video/')) effectiveType = 'video';
      else effectiveType = 'document';
    }
  }

  if (effectiveType === 'text') {
    text_body = String(innerMessage.text || innerMessage.body || '');
    msg_type = 'text';
  } else if (effectiveType === 'image') {
    msg_type = 'image';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'image/jpeg').split(';')[0];
    text_body = String(innerMessage.text || innerMessage.caption || (attachment && attachment.caption) || '');
  } else if (effectiveType === 'audio' || effectiveType === 'voice') {
    msg_type = 'audio';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'audio/ogg').split(';')[0];
    text_body = '';
  } else if (effectiveType === 'video') {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'video/mp4').split(';')[0];
    text_body = String(innerMessage.text || '[video recibido]');
  } else {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'application/octet-stream').split(';')[0];
    text_body = String(innerMessage.text || innerMessage.body || '[adjunto recibido]');
  }
} else {
  const from_raw = body.From || body.from || '';
  from = from_raw.replace('whatsapp:', '').replace(/^\\+/, '');
  profile = body.ProfileName || body.profileName || 'Desconocido';
  text_body = body.Body || body.body || '';
  canal = 'whatsapp_twilio';
}

if (!from) return [{ json: { skip: true, reason: 'sin_from' } }];
if (es_bot_propio) return [{ json: { skip: true, reason: 'bot_propio_no_procesar' } }];
if (es_humano) {
  const digits = from.replace(/\\D/g, '');
  return [{ json: { skip: true, reason: 'humano_respondio', mark_pausa: true, telefono: from, contact_id: contact_id_val, lead_id: 'L-' + digits.slice(-10), msg_humano: text_body.slice(0, 200) } }];
}
if (!text_body && !media_url) return [{ json: { skip: true, reason: 'payload_invalido' } }];

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://rag-bochile.onrender.com/api/buffer/add',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: from, cmid, ts: my_ts, msg_type, text: text_body, media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10) },
    json: true,
  });
} catch (err) { console.log('[parser] buffer/add error:', err.message); }

return [{ json: {
  telefono: from, contact_id: contact_id_val, nombre: profile,
  mensaje_original: text_body, msg_type, media_url, media_type,
  canal, channel_message_id: cmid, lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(), timestamp_iso: new Date().toISOString(), _my_ts: my_ts,
  skip: false, mark_pausa: false
}}];`;

(async () => {
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  const w1 = wfs.find(w => w.name.includes('CORE'));
  const full = JSON.parse((await req('GET', '/api/v1/workflows/' + w1.id)).b);
  const p = full.nodes.find(n => n.name === 'Parsear Mensaje');
  p.parameters.jsCode = PARSER_V9;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';

  const upd = await req('PUT', '/api/v1/workflows/' + w1.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
  const re = await req('POST', '/api/v1/workflows/' + w1.id + '/activate');
  console.log('PUT/activate:', upd.s + '/' + re.s);
  // Verificar
  const v = JSON.parse((await req('GET', '/api/v1/workflows/' + w1.id)).b);
  const p2 = v.nodes.find(n => n.name === 'Parsear Mensaje');
  console.log('Contiene crypto:', p2.parameters.jsCode.includes('crypto'));
  console.log('Linea 2:', p2.parameters.jsCode.split('\\n')[1]);
})();
