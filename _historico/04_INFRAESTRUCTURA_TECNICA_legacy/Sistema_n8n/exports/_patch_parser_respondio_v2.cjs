#!/usr/bin/env node
/**
 * v2: arregla bug detectado en exec 3265.
 *
 * Estructura REAL de respond.io webhook (descubierta en prod):
 *   body.message = { messageId, channelMessageId, contactId, channelId,
 *                    traffic, timestamp, message: { type, text, ... } }
 *
 * El outer "message" es metadata del wrapper; el contenido REAL esta en
 * message.message. Mi parser v1 leia message.type/text directo y
 * terminaba pasando un objeto como mensaje_original.
 *
 * Esta v2 lee message.message correctamente Y mantiene fallback al
 * formato anterior (por si respond.io cambia o tenemos test con shape
 * simplificado).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

const NEW_JS_CODE = `// Parser dual v2: acepta payload de respond.io (produccion) y Twilio (legacy)
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
  // ---- respond.io ----
  const contact = body.contact || {};
  // El payload real de respond.io tiene la estructura:
  //   body.message = { messageId, channelId, ..., message: { type, text } }
  // El contenido real esta en message.message (nested). Fallback a message
  // directo por si el shape cambia o usamos un payload simplificado.
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

  const mType = String(innerMessage.type || 'text').toLowerCase();
  if (mType === 'text') {
    text_body = String(innerMessage.text || innerMessage.body || '');
    msg_type = 'text';
  } else if (mType === 'image' || mType === 'attachment_image' || mType === 'attachment') {
    msg_type = 'image';
    media_url = String(
      (innerMessage.attachment && innerMessage.attachment.url) ||
      innerMessage.url ||
      (innerMessage.image && innerMessage.image.url) || ''
    );
    media_type = 'image/jpeg';
    text_body = String(innerMessage.text || innerMessage.caption || '');
  } else if (mType === 'audio' || mType === 'voice' || mType === 'attachment_audio') {
    msg_type = 'audio';
    media_url = String(
      (innerMessage.attachment && innerMessage.attachment.url) ||
      innerMessage.url ||
      (innerMessage.audio && innerMessage.audio.url) || ''
    );
    media_type = 'audio/ogg';
    text_body = '';
  } else if (mType === 'video') {
    msg_type = 'document';
    media_url = String(
      (innerMessage.attachment && innerMessage.attachment.url) ||
      innerMessage.url || ''
    );
    media_type = 'video/mp4';
    text_body = String(innerMessage.text || '[video recibido]');
  } else {
    msg_type = 'document';
    media_url = String(
      (innerMessage.attachment && innerMessage.attachment.url) ||
      innerMessage.url || ''
    );
    text_body = String(innerMessage.text || innerMessage.body || '[adjunto recibido]');
  }
} else {
  // ---- Twilio (legacy) ----
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

const digits_only = from.replace(/\\D/g, '');

return [{ json: {
  telefono: from,
  telefono_twilio: from,
  nombre: profile,
  mensaje_original: text_body,
  msg_type: msg_type,
  media_url: media_url,
  media_type: media_type,
  canal: canal,
  lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(),
  skip: false
}}];`;

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
    `W1_pre_parser_v2_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) throw new Error('No encuentro "Parsear Mensaje"');
  parser.parameters.jsCode = NEW_JS_CODE;
  console.log('✓ Parser v2: lee message.message (nested) + fallbacks');

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');

  // Re-activar (los PUT a veces desactivan)
  const act = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  console.log('Activate:', act.status === 200 ? 'OK' : act.body.slice(0,200));
}

main().catch(e => { console.error(e.message); process.exit(1); });
