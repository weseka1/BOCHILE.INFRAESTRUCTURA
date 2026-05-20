#!/usr/bin/env node
/**
 * Fix CRITICO post-test-Yamil (exec 3265-3294):
 *
 * BUG 1 — DUPLICADOS:
 *   Webhook usa responseMode=responseNode pero "OK al Webhook" esta al FINAL
 *   del flow. respond.io espera ~30s, asume fail, hace retry → 2 ejecuciones
 *   por mensaje. Esto a su vez rompe la memoria (2 buffers paralelos con la
 *   misma sessionKey=telefono).
 *
 *   FIX: cambiar Webhook a responseMode="onReceived" que devuelve 200
 *   inmediato sin esperar el flow. respond.io ya no reintenta. Conexion al
 *   nodo "OK al Webhook" final queda inutil pero no estorba.
 *
 * BUG 2 — PIERDE CONTEXTO / SALUDA 2 VECES:
 *   Consecuencia del BUG 1. Al arreglar duplicados, la memoria queda limpia.
 *
 * BUG 3 — PARSER LEE MAL EL TEXTO:
 *   El payload real de respond.io trae message.message.text (nested), no
 *   message.text. El parser v1 ponia el objeto entero como mensaje_original.
 *   FIX: nueva version del parser que lee nested correctamente.
 *
 * DEFENSA EN PROFUNDIDAD: dedupe por channelMessageId con cache 2 min en
 * staticData. Si llega un evento con channelMessageId repetido, return skip.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

const NEW_PARSER_CODE = `// Parser dual v3: respond.io (nested message.message) + Twilio (legacy) + DEDUPE
const raw = $input.first().json;
const body = raw.body || raw;

// ===== DEDUPE: bloquear si llega 2 veces el mismo channelMessageId en < 2 min =====
const staticData = $getWorkflowStaticData('global');
staticData.seenMsgIds = staticData.seenMsgIds || {};
const now = Date.now();
// Cleanup mensajes viejos (> 2 min)
for (const id of Object.keys(staticData.seenMsgIds)) {
  if (now - staticData.seenMsgIds[id] > 120000) delete staticData.seenMsgIds[id];
}
const cmid = (body.message && body.message.channelMessageId) || null;
if (cmid) {
  if (staticData.seenMsgIds[cmid]) {
    return [{ json: { skip: true, reason: 'duplicate_channelMessageId', channelMessageId: cmid } }];
  }
  staticData.seenMsgIds[cmid] = now;
}

// ===== Detectar formato =====
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
    media_url = String((innerMessage.attachment && innerMessage.attachment.url) || innerMessage.url || (innerMessage.image && innerMessage.image.url) || '');
    media_type = 'image/jpeg';
    text_body = String(innerMessage.text || innerMessage.caption || '');
  } else if (mType === 'audio' || mType === 'voice' || mType === 'attachment_audio') {
    msg_type = 'audio';
    media_url = String((innerMessage.attachment && innerMessage.attachment.url) || innerMessage.url || (innerMessage.audio && innerMessage.audio.url) || '');
    media_type = 'audio/ogg';
    text_body = '';
  } else if (mType === 'video') {
    msg_type = 'document';
    media_url = String((innerMessage.attachment && innerMessage.attachment.url) || innerMessage.url || '');
    media_type = 'video/mp4';
    text_body = String(innerMessage.text || '[video recibido]');
  } else {
    msg_type = 'document';
    media_url = String((innerMessage.attachment && innerMessage.attachment.url) || innerMessage.url || '');
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
  channel_message_id: cmid,
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
    `W1_pre_dedupe_and_immediate_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // FIX 1: Webhook responde inmediato
  const wh = wf.nodes.find(n => n.name === 'Webhook Twilio');
  if (!wh) throw new Error('No encuentro Webhook Twilio');
  wh.parameters.responseMode = 'onReceived';
  wh.parameters.responseData = 'noData';
  wh.parameters.responseCode = 200;
  if (wh.parameters.options) delete wh.parameters.options.responseHeaders;
  console.log('✓ Webhook → responseMode=onReceived (200 inmediato, sin esperar flow)');

  // FIX 2: Parser nuevo con dedupe + nested message
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) throw new Error('No encuentro Parsear Mensaje');
  parser.parameters.jsCode = NEW_PARSER_CODE;
  console.log('✓ Parser v3 con dedupe por channelMessageId + nested message.message');

  // OK al Webhook ya no se necesita pero lo dejamos (no estorba)
  console.log('  Nota: "OK al Webhook" queda en el flow pero ya no responde HTTP (el Webhook ya lo hizo).');

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');
  console.log('');
  console.log('IMPORTANTE: W1 quedo DESACTIVADO. Reactivar manualmente cuando confirmemos test.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
