// Fix #1: Validacion HMAC de respond.io en el Parser.
// Modo WARN inicialmente: loggea match/mismatch pero NO rechaza.
// Una vez confirmado que matchea (ver logs en n8n console), pasar a ENFORCE.
const http = require('node:http');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(method, path, body){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host:'localhost',port:5680,path,method,headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

const HMAC_SECRET = 'n1Jxiri0SdH9CC3a66x2m3ot32pAiJTS8iLAmO6iHIQ=';

const PARSER_V8 = `// Parser v8: HMAC validation (modo WARN) + handoff + buffer
const crypto = require('crypto');
const raw = $input.first().json;
const body = raw.body || raw;
const headers = raw.headers || {};

// HMAC validation (WARN mode - solo loggea)
const HMAC_SECRET = '${HMAC_SECRET}';
const receivedSig = String(headers['x-webhook-signature'] || '');
let sigOk = false;
let sigMode = 'no_header';
if (receivedSig) {
  try {
    // Probar distintos formatos para encontrar el correcto
    const bodyStr = JSON.stringify(body);
    const h1 = crypto.createHmac('sha256', HMAC_SECRET).update(bodyStr).digest('base64');
    const h2 = crypto.createHmac('sha256', Buffer.from(HMAC_SECRET, 'base64')).update(bodyStr).digest('base64');
    if (h1 === receivedSig) { sigOk = true; sigMode = 'sha256_secret_string'; }
    else if (h2 === receivedSig) { sigOk = true; sigMode = 'sha256_secret_b64decoded'; }
    else { sigMode = 'mismatch_h1=' + h1.slice(0,12) + '_h2=' + h2.slice(0,12) + '_recv=' + receivedSig.slice(0,12); }
  } catch (e) { sigMode = 'error_' + e.message.slice(0,50); }
}
console.log('[HMAC]', sigMode, '| receivedSig=' + receivedSig.slice(0,20));

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

if (!from) { return [{ json: { skip: true, reason: 'sin_from', sig_mode: sigMode } }]; }
if (es_bot_propio) { return [{ json: { skip: true, reason: 'bot_propio_no_procesar', sig_mode: sigMode } }]; }
if (es_humano) {
  const digits = from.replace(/\\D/g, '');
  return [{ json: { skip: true, reason: 'humano_respondio', mark_pausa: true, telefono: from, contact_id: contact_id_val, lead_id: 'L-' + digits.slice(-10), msg_humano: text_body.slice(0, 200), sig_mode: sigMode } }];
}
if (!text_body && !media_url) { return [{ json: { skip: true, reason: 'payload_invalido', sig_mode: sigMode } }]; }

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://host.docker.internal:3003/api/buffer/add',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: from, cmid, ts: my_ts, msg_type, text: text_body, media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10) },
    json: true,
  });
} catch (err) { console.log('[parser] buffer/add error:', err.message); }

return [{ json: {
  telefono: from, contact_id: contact_id_val, nombre: profile,
  mensaje_original: text_body, msg_type: msg_type, media_url: media_url, media_type: media_type,
  canal: canal, channel_message_id: cmid, lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(), timestamp_iso: new Date().toISOString(), _my_ts: my_ts,
  skip: false, mark_pausa: false, sig_mode: sigMode
}}];`;

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  parser.parameters.jsCode = PARSER_V8;

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);
})();
