#!/usr/bin/env node
/**
 * Cambia el Parser y el Consolidate Or Skip para usar el buffer
 * compartido del RAG server (http://host.docker.internal:3003/api/buffer/*)
 * en vez de staticData de n8n que NO funciona entre execs concurrentes.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';
const BUFFER_HOST = 'http://host.docker.internal:3003';

const NEW_PARSER_CODE = `// Parser v6: parse + escribir al buffer compartido del RAG server
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

if (isRespondio) {
  const contact = body.contact || {};
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;
  const attachment = innerMessage.attachment || null;

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

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
  const num_media = parseInt(body.NumMedia || body.numMedia || '0', 10);
  media_url = body.MediaUrl0 || body.mediaUrl0 || '';
  media_type = body.MediaContentType0 || body.mediaContentType0 || '';
  canal = 'whatsapp_twilio';
  if (num_media > 0 && media_url) {
    if (media_type.startsWith('audio/')) msg_type = 'audio';
    else if (media_type.startsWith('image/')) msg_type = 'image';
    else { msg_type = 'document'; text_body = text_body || '[adjunto recibido]'; }
  }
}

if (!from || (!text_body && !media_url)) {
  return [{ json: { skip: true, reason: 'payload_invalido', raw_keys: Object.keys(body).slice(0,15) } }];
}

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

// Escribir al buffer compartido (RAG server, Map in-memory single-process)
try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://host.docker.internal:3003/api/buffer/add',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: from, cmid, ts: my_ts, msg_type, text: text_body, media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10) },
    json: true,
  });
} catch (err) {
  // Si el buffer service esta caido, seguimos sin batching pero no rompemos el flow
  console.log('[parser] buffer/add error:', err.message);
}

return [{ json: {
  telefono: from,
  telefono_twilio: from,
  nombre: profile,
  mensaje_original: text_body,
  msg_type: msg_type,
  media_url: media_url,
  media_type: media_type,
  canal: canal,
  channel_message_id: cmid,
  lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(),
  _my_ts: my_ts,
  skip: false
}}];`;

const CONSOLIDATE_CODE = `// Consolidate v2: consulta buffer compartido del RAG server
const input = $input.first().json;
const phone = input.telefono;
const my_ts = input._my_ts;

let resp;
try {
  resp = await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://host.docker.internal:3003/api/buffer/consume',
    headers: { 'Content-Type': 'application/json' },
    body: { phone, my_ts },
    json: true,
  });
} catch (err) {
  // Si el buffer service esta caido, procesamos como single msg (no batching)
  console.log('[consolidate] buffer/consume error:', err.message);
  return [{ json: input }];
}

if (resp && resp.skip === true) {
  // No soy el ultimo o buffer vacio → skip silencioso
  return [];
}

// Soy el ultimo y consolide. Si el texto consolidado tiene mas que mi texto,
// pisar el mensaje_original con el consolidado.
const consolidatedText = resp && resp.consolidated_text;
const count = (resp && resp.count) || 1;

return [{
  json: {
    ...input,
    mensaje_original: (input.msg_type === 'text' && consolidatedText) ? consolidatedText : input.mensaje_original,
    _consolidated_count: count,
    _consolidated_msgs: (resp && resp.msgs) || []
  }
}];`;

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, (resp) => {
      let d = '';
      resp.on('data', (c) => (d += c));
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_rag_buffer_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  parser.parameters.jsCode = NEW_PARSER_CODE;
  console.log('✓ Parser v6 con buffer compartido HTTP');

  const cons = wf.nodes.find(n => n.name === 'Consolidate Or Skip');
  cons.parameters.jsCode = CONSOLIDATE_CODE;
  console.log('✓ Consolidate v2 con buffer compartido HTTP');

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');

  const act = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  console.log('Activate:', act.status === 200 ? 'OK ACTIVO' : act.body.slice(0,200));
}

main().catch(e => { console.error(e.message); process.exit(1); });
